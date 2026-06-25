"""Public chain endpoints — proof lookups + on-chain status."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.chain.anchor import anchor_batch, event_leaf
from nagarik.chain.badges import MILESTONES, mint_for, tier_for_xp
from nagarik.chain.settings import get_chain_settings
from nagarik.db import get_db
from nagarik.models import AgentEvent, Citizen

router = APIRouter(prefix="/chain", tags=["chain"])


@router.get("/status")
def status() -> dict:
    cs = get_chain_settings()
    return {
        "enabled": cs.chain_enabled,
        "network": "polygon-amoy" if cs.chain_id == 80002 else f"chain-{cs.chain_id}",
        "anchor_contract": cs.anchor_contract or None,
        "badge_contract": cs.badge_contract or None,
        "milestones": [{"xp": m[0], "tier": m[1]} for m in MILESTONES],
    }


@router.post("/anchor/flush")
def flush_anchor(db: Session = Depends(get_db)) -> dict:
    """Hash the next un-anchored batch of agent events and write its Merkle root.

    Production wires this to a Cloud Scheduler job every N events; here it's
    manual so judges can fire it on stage.
    """
    cs = get_chain_settings()
    events = db.scalars(
        select(AgentEvent).order_by(AgentEvent.created_at.asc()).limit(cs.anchor_batch_size)
    ).all()
    if not events:
        raise HTTPException(400, "no events to anchor")

    payload = [
        {
            "id": str(e.id),
            "issue_id": str(e.issue_id),
            "agent": e.agent,
            "status": e.status,
            "payload": e.payload,
            "duration_ms": e.duration_ms,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]
    result = anchor_batch(payload)
    return {
        "enabled": result.enabled,
        "merkle_root": result.root_hex,
        "batch_id": result.batch_id,
        "tx_hash": result.tx_hash,
        "leaf_count": len(events),
        "anchored_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/proof/{event_id}")
def proof_for_event(event_id: str, db: Session = Depends(get_db)) -> dict:
    """Return the leaf hash for a single AgentEvent — the auditor recomputes
    the proof + verifies inclusion against the on-chain root."""
    ev = db.get(AgentEvent, event_id)
    if ev is None:
        raise HTTPException(404, "event not found")
    payload = {
        "id": str(ev.id),
        "issue_id": str(ev.issue_id),
        "agent": ev.agent,
        "status": ev.status,
        "payload": ev.payload,
        "duration_ms": ev.duration_ms,
        "created_at": ev.created_at.isoformat(),
    }
    return {
        "event": payload,
        "leaf_hex": "0x" + event_leaf(payload).hex(),
    }


@router.post("/badge/check/{citizen_id}")
def check_and_mint_badge(citizen_id: str, db: Session = Depends(get_db)) -> dict:
    """Mint the highest-eligible badge for a citizen if not already minted.

    Production runs this on every XP change; here it's manual.
    """
    citizen = db.get(Citizen, citizen_id)
    if citizen is None:
        raise HTTPException(404, "citizen not found")

    milestone = tier_for_xp(citizen.xp)
    if milestone is None:
        return {"minted": False, "reason": f"xp={citizen.xp} below first milestone"}

    result = mint_for(citizen.phone, citizen.xp)
    if result.enabled and result.tier != "none":
        citizen.badge = result.tier
        db.commit()
    return {
        "minted": result.enabled,
        "shadow_mode": not result.enabled,
        "tier": result.tier,
        "wallet": result.wallet,
        "token_id": result.token_id,
        "tx_hash": result.tx_hash,
        "xp": citizen.xp,
    }


@router.get("/wallet/{citizen_id}")
def wallet(citizen_id: str, db: Session = Depends(get_db)) -> dict:
    """Citizen-facing wallet view — current XP, derived address, every milestone
    they've earned (and the next tier they're working toward)."""
    from nagarik.chain.badges import MILESTONES, derive_wallet, tier_for_xp
    from nagarik.chain.settings import get_chain_settings

    citizen = db.get(Citizen, citizen_id)
    if citizen is None:
        raise HTTPException(404, "citizen not found")

    cs = get_chain_settings()
    wallet_addr = derive_wallet(citizen.phone, cs.chain_signer_pk or "demo-secret")
    earned = tier_for_xp(citizen.xp)
    earned_tiers = {m[1] for m in MILESTONES if citizen.xp >= m[0]}

    # Find the next tier above current XP.
    next_tier = next(((xp, name, img) for (xp, name, img) in MILESTONES if xp > citizen.xp), None)

    return {
        "citizen": {
            "id": str(citizen.id),
            "name": citizen.name or "Anonymous",
            "phone_masked": citizen.phone[:3] + "****" + citizen.phone[-3:],
            "xp": citizen.xp,
            "current_badge": citizen.badge,
        },
        "wallet_address": wallet_addr,
        "chain": {
            "enabled": cs.chain_enabled,
            "network": "polygon-amoy" if cs.chain_id == 80002 else f"chain-{cs.chain_id}",
            "badge_contract": cs.badge_contract or None,
            "explorer_base": "https://amoy.polygonscan.com/address/" if cs.chain_id == 80002 else None,
        },
        "earned_count": len(earned_tiers),
        "badges": [
            {
                "tier": name,
                "xp_threshold": xp,
                "image": image,
                "earned": name in earned_tiers,
                "is_current": earned is not None and earned[1] == name,
            }
            for xp, name, image in MILESTONES
        ],
        "next_tier": (
            {
                "tier": next_tier[1],
                "xp_threshold": next_tier[0],
                "xp_to_go": next_tier[0] - citizen.xp,
                "progress_pct": round(100 * citizen.xp / next_tier[0], 1),
            }
            if next_tier
            else None
        ),
    }
