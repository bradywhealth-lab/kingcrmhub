#!/usr/bin/env python3
"""Generate public/og-home.png (1200x630) in the locked landing palette.
Palette (from src/app/welcome/page.tsx, Gate v3):
  Ink #0C111B (bg), Paper #F4F0E6 (text), Signal Teal #18B897 (accent on ink).

Runs on macOS, Linux (DejaVu), and Windows (Arial) — first available font wins;
falls back to PIL's default bitmap font if nothing is found.
Output path is resolved relative to the repo root (this script lives in scripts/).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = REPO_ROOT / "public" / "og-home.png"

# Font candidates by role (bold, regular), cross-platform.
BOLD_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",  # macOS
    "C:/Windows/Fonts/arialbd.ttf",                        # Windows
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
]
REG_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(candidates, size):
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    # Last resort: PIL default (bitmap) — still renders, just less pretty.
    return ImageFont.load_default(size)

W, H = 1200, 630
INK = (12, 17, 27)
PAPER = (244, 240, 230)
TEAL = (24, 184, 151)
MUTED = (244, 240, 230, 150)

img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img, "RGBA")

f_kicker = load_font(REG_CANDIDATES, 26)
f_title = load_font(BOLD_CANDIDATES, 78)
f_title2 = load_font(BOLD_CANDIDATES, 78)
f_sub = load_font(REG_CANDIDATES, 34)
f_url = load_font(REG_CANDIDATES, 26)

# subtle teal glow bottom-left (radial approximation)
for r in range(420, 0, -12):
    alpha = int(26 * (1 - r / 420))
    d.ellipse([-r // 2, H - r // 2, r * 1.2, H + r * 0.7], fill=(TEAL[0], TEAL[1], TEAL[2], alpha))

# teal rule
d.rectangle([90, 96, 210, 104], fill=TEAL)

d.text((90, 130), "K I N G   C R M   H U B", font=f_kicker, fill=MUTED)
d.text((90, 180), "The client pipeline", font=f_title, fill=PAPER)
d.text((90, 272), "for one-person businesses", font=f_title2, fill=PAPER)

d.text((90, 400), "Leads, follow-ups, bookings, and AI guidance —", font=f_sub, fill=MUTED)
d.text((90, 448), "one workspace. Flat pricing, no per-seat tax.", font=f_sub, fill=MUTED)

d.text((90, 552), "kingcrmhub.net", font=f_url, fill=TEAL)

img.save(OUT_PATH, optimize=True)
print("og-home.png written:", OUT_PATH, img.size)
