"""Seed the 7 departments + a demo supervisor + crew-lead per department.

Idempotent — re-running updates the row instead of duplicating it. Pulls the
department list from agents/guardrails.SOP_TABLE so the source of truth never
diverges. Demo credentials for /dept-login are printed at the end.

Run:
    PYTHONPATH=. python -m scripts.seed_departments
"""

from __future__ import annotations

import uuid
from collections import OrderedDict

from sqlalchemy import select

from nagarik.agents.guardrails import SOP_TABLE
from nagarik.auth import hash_password
from nagarik.db import SessionLocal
from nagarik.models import Department, DepartmentUser

# Channel + contact-info config keyed by department name (matches SOP_TABLE values).
# For the demo two depts get realistic outbound channels (whatsapp, email) so
# judges see different delivery paths in /supervisor.
DEPT_CONFIG: dict[str, dict[str, str | None]] = {
    "BBMP Roads": {
        "code": "BBMP_ROADS",
        "primary_channel": "whatsapp",
        "whatsapp_number": "+91-80-2266-0000",
        "email": "roads@bbmp.gov.in",
        "supervisor_name": "Ravi Shankar",
        "supervisor_phone": "+91-98860-12345",
    },
    "BBMP SWM": {
        "code": "BBMP_SWM",
        "primary_channel": "whatsapp",
        "whatsapp_number": "+91-80-2266-0100",
        "email": "swm@bbmp.gov.in",
        "supervisor_name": "Sunitha Devi",
        "supervisor_phone": "+91-98860-23456",
    },
    "BESCOM Streetlight": {
        "code": "BESCOM_STREETLIGHT",
        "primary_channel": "email",
        "whatsapp_number": None,
        "email": "streetlight@bescom.org",
        "supervisor_name": "Mohan Kumar",
        "supervisor_phone": "+91-98860-34567",
    },
    "BWSSB": {
        "code": "BWSSB",
        "primary_channel": "email",
        "whatsapp_number": None,
        "email": "complaints@bwssb.gov.in",
        "supervisor_name": "Anita Rao",
        "supervisor_phone": "+91-98860-45678",
    },
    "BBMP Horticulture": {
        "code": "BBMP_HORTICULTURE",
        "primary_channel": "webhook",
        "whatsapp_number": None,
        "email": "horticulture@bbmp.gov.in",
        "webhook_url": "https://webhook.site/demo-bbmp-horticulture",
        "supervisor_name": "Vinod K",
        "supervisor_phone": "+91-98860-56789",
    },
    "BBMP Town Planning": {
        "code": "BBMP_TOWN_PLANNING",
        "primary_channel": "inapp_only",
        "whatsapp_number": None,
        "email": "townplanning@bbmp.gov.in",
        "supervisor_name": "Pradeep S",
        "supervisor_phone": "+91-98860-67890",
    },
    "BBMP Helpdesk": {
        "code": "BBMP_HELPDESK",
        "primary_channel": "inapp_only",
        "whatsapp_number": "+91-1533",
        "email": "helpdesk@bbmp.gov.in",
        "supervisor_name": "Kavitha N",
        "supervisor_phone": "+91-98860-78901",
    },
}

# Default password for every seeded dept user. Hackathon-only — surfaced on /dept-login.
DEMO_PASSWORD = "supervisor2026"


def main() -> None:
    # Collect unique departments from SOP_TABLE preserving insertion order.
    unique_depts: "OrderedDict[str, None]" = OrderedDict()
    for _, (dept_name, _sla) in SOP_TABLE.items():
        unique_depts.setdefault(dept_name, None)

    print(f"Seeding {len(unique_depts)} departments from SOP_TABLE...")
    pw_hash = hash_password(DEMO_PASSWORD)
    demo_credentials: list[tuple[str, str, str]] = []

    with SessionLocal() as db:
        for dept_name in unique_depts:
            cfg = DEPT_CONFIG.get(dept_name, {})
            code = str(cfg.get("code") or dept_name.replace(" ", "_").upper())

            existing = db.scalar(select(Department).where(Department.code == code))
            if existing is None:
                dept = Department(
                    id=uuid.uuid4(),
                    code=code,
                    name=dept_name,
                    primary_channel=str(cfg.get("primary_channel") or "inapp_only"),
                    whatsapp_number=cfg.get("whatsapp_number"),
                    email=cfg.get("email"),
                    webhook_url=cfg.get("webhook_url"),
                    supervisor_name=cfg.get("supervisor_name"),
                    supervisor_phone=cfg.get("supervisor_phone"),
                    is_active=True,
                )
                db.add(dept)
                db.flush()
                print(f"  + {code:24s} via {dept.primary_channel}")
            else:
                # Update mutable fields so config changes take effect on re-run.
                existing.primary_channel = str(cfg.get("primary_channel") or existing.primary_channel)
                existing.whatsapp_number = cfg.get("whatsapp_number") or existing.whatsapp_number
                existing.email = cfg.get("email") or existing.email
                existing.webhook_url = cfg.get("webhook_url") or existing.webhook_url
                existing.supervisor_name = cfg.get("supervisor_name") or existing.supervisor_name
                existing.supervisor_phone = cfg.get("supervisor_phone") or existing.supervisor_phone
                dept = existing
                print(f"  · {code:24s} updated")

            # Seed one supervisor + one crew_lead per department.
            for role in ("supervisor", "crew_lead"):
                slug = code.lower()
                username = f"{slug}_{role}"
                existing_user = db.scalar(select(DepartmentUser).where(DepartmentUser.username == username))
                if existing_user is None:
                    db.add(DepartmentUser(
                        id=uuid.uuid4(),
                        username=username,
                        password_hash=pw_hash,
                        department_id=dept.id,
                        role=role,
                        name=f"{dept.supervisor_name or dept_name} ({role.replace('_', ' ').title()})",
                        phone=dept.supervisor_phone,
                        is_active=True,
                    ))
                else:
                    existing_user.password_hash = pw_hash  # keep demo pw consistent across re-seeds
                    existing_user.department_id = dept.id
                demo_credentials.append((dept_name, role, username))

        db.commit()

    print(f"\nDemo credentials — password for everyone: {DEMO_PASSWORD!r}")
    print("=" * 72)
    print(f"{'Department':24s} {'Role':12s} Username")
    print("-" * 72)
    for dept_name, role, username in demo_credentials:
        print(f"{dept_name:24s} {role:12s} {username}")
    print("=" * 72)
    print("\nSign in at /dept-login.")


if __name__ == "__main__":
    main()
