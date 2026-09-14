#!/usr/bin/env python3
"""Generate public/og-home.png (1200x630) in the locked landing palette.
Palette (from src/app/welcome/page.tsx, Gate v3):
  Ink #0C111B (bg), Paper #F4F0E6 (text), Signal Teal #18B897 (accent on ink).
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INK = (12, 17, 27)
PAPER = (244, 240, 230)
TEAL = (24, 184, 151)
MUTED = (244, 240, 230, 150)

img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img, "RGBA")

BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
f_kicker = ImageFont.truetype(REG, 26)
f_title = ImageFont.truetype(BOLD, 78)
f_title2 = ImageFont.truetype(BOLD, 78)
f_sub = ImageFont.truetype(REG, 34)
f_url = ImageFont.truetype(REG, 26)

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

img.save("/Users/bradywilson/kc-seo/public/og-home.png", optimize=True)
print("og-home.png written:", img.size)
