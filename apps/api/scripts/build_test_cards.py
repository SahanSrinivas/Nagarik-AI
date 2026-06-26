"""Generate 12 visually-distinctive test-card JPEGs for the 6 non-pothole
categories — 2 per category (one as the citizen 'before' photo, one as
the crew 'after' photo). Output: apps/web/public/test-photos/cat_*.jpg.

Each card is 640×480, has a category-themed background colour, a stylised
icon, and the category label in big text. They aren't real photographs —
deliberately labelled as 'synthetic test card' on the /test-photos page —
but they're enough to drive the demo flow for every category without
asking the user to source real photos for each one.

For real photo testing the user can:
  - keep using the case_a..case_e real pothole pairs we already shipped
  - or paste a URL to any real photo in the Photo URL field on /report

Run:
    PYTHONPATH=. python -m scripts.build_test_cards
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[3] / "apps" / "web" / "public" / "test-photos"

W, H = 640, 480
SUFFIX = {"reported": "before · damaged", "resolved": "after · fixed"}

# Per-category palette + iconography:  (bg_top, bg_bottom, icon_color, accent)
PALETTES = {
    "garbage":      ("#3b2a1f", "#5b412d", "#a3a3a3", "#fbbf24"),  # earthy / brown
    "streetlight":  ("#0f172a", "#1e293b", "#fde047", "#fbbf24"),  # night sky
    "water_leak":   ("#0c4a6e", "#075985", "#bae6fd", "#22d3ee"),  # blue
    "sewage":       ("#1c1917", "#292524", "#16a34a", "#65a30d"),  # dark + algae
    "tree_fall":    ("#365314", "#3f6212", "#a3e635", "#84cc16"),  # leafy
    "encroachment": ("#374151", "#4b5563", "#fb7185", "#f97316"),  # cement + orange cart
}

# Per-category icon drawn programmatically (no external assets).
def draw_icon(d: ImageDraw.ImageDraw, cat: str, fill: str, accent: str, fixed: bool) -> None:
    cx, cy = W // 2, H // 2 - 40
    if cat == "garbage":
        # Trash bags / bin
        if not fixed:
            for ox in (-90, 0, 90):
                d.rounded_rectangle([cx + ox - 50, cy - 30, cx + ox + 50, cy + 90], radius=12, fill=fill)
                d.line([cx + ox - 20, cy - 30, cx + ox - 20, cy - 60], fill=accent, width=6)
                d.line([cx + ox + 20, cy - 30, cx + ox + 20, cy - 60], fill=accent, width=6)
        else:
            d.rounded_rectangle([cx - 60, cy - 40, cx + 60, cy + 90], radius=14, fill="#6b7280")
            d.line([cx - 50, cy - 60, cx + 50, cy - 60], fill=accent, width=8)
            d.text((cx - 40, cy + 10), "EMPTY", fill="#ffffff", font=_font(36))
    elif cat == "streetlight":
        # Pole + lamp
        d.rectangle([cx - 6, cy - 100, cx + 6, cy + 140], fill="#94a3b8")
        d.rectangle([cx - 80, cy - 100, cx + 6, cy - 92], fill="#94a3b8")
        if not fixed:
            d.ellipse([cx - 110, cy - 130, cx - 60, cy - 80], outline=fill, width=4, fill="#1e293b")
            d.line([cx - 95, cy - 115, cx - 75, cy - 95], fill="#475569", width=4)  # cracked
        else:
            d.ellipse([cx - 110, cy - 130, cx - 60, cy - 80], fill=fill)
            for r in (140, 170, 200):
                d.ellipse([cx - r - 25, cy - r - 25, cx - r + 25, cy - r + 25], outline=accent, width=1)
    elif cat == "water_leak":
        # Pipe + gushing water
        d.rectangle([cx - 140, cy - 20, cx + 140, cy + 20], fill="#475569")
        if not fixed:
            for i in range(8):
                y = cy + 30 + i * 18
                d.line([cx - 60 - i * 6, y, cx + 60 + i * 6, y], fill=fill, width=10)
            d.ellipse([cx - 30, cy - 8, cx + 30, cy + 8], fill="#0f172a")  # hole
        else:
            d.rectangle([cx - 35, cy - 8, cx + 35, cy + 8], fill="#22c55e")  # patch
            d.text((cx - 36, cy + 40), "PATCHED", fill=accent, font=_font(28))
    elif cat == "sewage":
        # Manhole
        if not fixed:
            d.ellipse([cx - 100, cy - 60, cx + 100, cy + 100], fill="#0f172a")  # open hole
            d.ellipse([cx - 110, cy - 70, cx + 110, cy + 110], outline=fill, width=8)
        else:
            d.ellipse([cx - 100, cy - 60, cx + 100, cy + 100], fill="#374151")
            for r in (30, 60, 90):
                d.ellipse([cx - r, cy + 20 - r, cx + r, cy + 20 + r], outline="#4b5563", width=3)
            d.text((cx - 50, cy + 110), "COVERED", fill=accent, font=_font(28))
    elif cat == "tree_fall":
        # Trunk
        if not fixed:
            d.polygon([(cx - 30, cy - 100), (cx + 30, cy - 100), (cx + 80, cy + 140), (cx - 80, cy + 140)], fill="#78350f")
            d.ellipse([cx - 130, cy - 200, cx - 30, cy - 100], fill=fill)
            d.ellipse([cx - 70, cy - 240, cx + 70, cy - 140], fill=fill)
            d.ellipse([cx - 30, cy - 200, cx + 70, cy - 100], fill=fill)
        else:
            d.rectangle([cx - 200, cy + 130, cx + 200, cy + 150], fill="#6b7280")  # cleared road
            d.text((cx - 40, cy - 40), "CLEARED", fill=accent, font=_font(28))
    elif cat == "encroachment":
        # Pushcart
        if not fixed:
            d.rounded_rectangle([cx - 110, cy - 40, cx + 110, cy + 70], radius=10, fill=fill)
            d.rectangle([cx - 90, cy - 70, cx + 90, cy - 40], fill="#fb7185")
            d.ellipse([cx - 90, cy + 60, cx - 40, cy + 110], fill="#1f2937")
            d.ellipse([cx + 40, cy + 60, cx + 90, cy + 110], fill="#1f2937")
        else:
            d.text((cx - 80, cy - 20), "CLEARED", fill=accent, font=_font(40))
            d.line([cx - 200, cy + 80, cx + 200, cy + 80], fill="#6b7280", width=8)


def _font(size: int) -> ImageFont.ImageFont:
    # Pillow ships a default font; that's enough for cards.
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size=size)
    except OSError:
        return ImageFont.load_default()


def _gradient(top: str, bottom: str) -> Image.Image:
    img = Image.new("RGB", (W, H), top)
    d = ImageDraw.Draw(img)
    tr, tg, tb = ImageColor(top)
    br, bg, bb = ImageColor(bottom)
    for y in range(H):
        f = y / (H - 1)
        r = int(tr + (br - tr) * f)
        g = int(tg + (bg - tg) * f)
        b = int(tb + (bb - tb) * f)
        d.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def ImageColor(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def render(category: str, phase: str) -> Image.Image:
    top, bot, ic, accent = PALETTES[category]
    img = _gradient(top, bot)
    d = ImageDraw.Draw(img)
    fixed = phase == "resolved"
    draw_icon(d, category, ic, accent, fixed)
    # Big label.
    label = category.replace("_", " ").upper()
    font_big = _font(58)
    bbox = d.textbbox((0, 0), label, font=font_big)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((W - tw) // 2, H - th - 60), label, fill="#ffffff", font=font_big)
    # Phase tag.
    tag = SUFFIX[phase]
    font_sm = _font(22)
    bbox = d.textbbox((0, 0), tag, font=font_sm)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((W - tw) // 2, H - th - 25), tag, fill="#94a3b8", font=font_sm)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for cat in PALETTES:
        for phase in ("reported", "resolved"):
            img = render(cat, phase)
            path = OUT / f"cat_{cat}_{phase}.jpg"
            img.save(path, "JPEG", quality=84, optimize=True)
            n += 1
    print(f"wrote {n} test cards to {OUT}")


if __name__ == "__main__":
    main()
