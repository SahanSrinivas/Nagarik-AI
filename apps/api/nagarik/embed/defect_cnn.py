"""Pothole defect CNN — proof-of-fix verifier for ResolutionAgent.

Architecture (from community-hero/data/defect_cnn.json):
    3x conv(16,32,64) + GAP + FC, 64x64 RGB, from scratch, ~92% test accuracy
    Trained on real potholes (michelpf/dataset-pothole) vs synthetic repairs.

Inference:
    p_defect ∈ [0,1]  ← softmax probability that the photo still shows a pothole.
    Used as: a high p_defect on the AFTER photo rejects the closure as fraud.

The whole module is lazily loaded — torch + the .pt file are only touched
when ResolutionAgent actually scores a photo. Saves ~700MB of RAM on cold
boot and lets the rest of the API run torch-free.
"""

from __future__ import annotations

import io
import logging
from functools import lru_cache
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

from nagarik.paths import data_root as _data_root
DEFAULT_CKPT = _data_root() / "processed" / "defect_cnn.pt"
INPUT_SIZE = 64


def _build_model():
    """Reconstruct the architecture that matches the checkpoint state-dict.

    Layer naming `f.{i}.0 / f.{i}.1` indicates Sequential blocks of
    Conv + BatchNorm. ReLU + MaxPool are stateless, so they're not in the
    state dict but must be added to the forward graph.
    """
    import torch
    import torch.nn as nn

    def block(c_in: int, c_out: int) -> nn.Sequential:
        return nn.Sequential(
            nn.Conv2d(c_in, c_out, kernel_size=3, padding=1),
            nn.BatchNorm2d(c_out),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
        )

    class DefectCNN(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.f = nn.Sequential(
                block(3, 16),
                block(16, 32),
                block(32, 64),
            )
            self.gap = nn.AdaptiveAvgPool2d(1)
            self.head = nn.Linear(64, 2)

        def forward(self, x):  # noqa: ANN001 — torch.Tensor
            x = self.f(x)
            x = self.gap(x).flatten(1)
            return self.head(x)

    return DefectCNN()


@lru_cache(maxsize=1)
def _load_model(ckpt_path: str = str(DEFAULT_CKPT)):
    import torch

    model = _build_model()
    state = torch.load(ckpt_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    log.info("defect_cnn loaded from %s", ckpt_path)
    return model


def _preprocess(image_bytes: bytes):
    """RGB → 64x64 → 0-1 normalised tensor of shape (1,3,64,64)."""
    import torch
    from PIL import Image
    from torchvision import transforms

    tx = transforms.Compose([
        transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
        transforms.ToTensor(),                          # → (3,H,W), [0,1]
    ])
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    return tx(img).unsqueeze(0)


def defect_probability_bytes(image_bytes: bytes) -> float:
    """Returns p(defect_present) ∈ [0,1] for a single image's bytes."""
    import torch

    model = _load_model()
    x = _preprocess(image_bytes)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=-1).squeeze(0)
    # Index 1 = "defect present" per the binary head (no_defect, defect).
    return float(probs[1].item())


def defect_probability_url(url: str, *, timeout: float = 20.0) -> float:
    with httpx.Client(follow_redirects=True, timeout=timeout) as client:
        r = client.get(url, headers={"User-Agent": "NagarikAI-Defect/0.1"})
        r.raise_for_status()
        return defect_probability_bytes(r.content)


def cnn_available(ckpt_path: str = str(DEFAULT_CKPT)) -> bool:
    """Lightweight probe — true iff torch is importable AND the .pt exists."""
    if not Path(ckpt_path).exists():
        return False
    try:
        import torch  # noqa: F401
        return True
    except ImportError:
        return False
