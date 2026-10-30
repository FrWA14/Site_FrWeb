#!/usr/bin/env python3
"""Génère la bannière et la vignette de la page « Horloge CD4060 ».

    python3 _sources/horloge_cd4060/images.py

Produit pages/electronique/horloge_cd4060/assets/images/{banniere,vignette}.jpg
aux couleurs du site : afficheurs 7 segments, CD4060 et quartz.
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "pages", "electronique", "horloge_cd4060", "assets", "images")

BG, DOT, BODY, BORDER = "#0a0f0f", "#1a2424", "#121a1a", "#3d7a7a"
PIN, ACCENT, ORANGE = "#a8b5b5", "#4ecdc4", "#e67e22"
SEG_ON, SEG_OFF = "#ff3b3b", "#2a0d0d"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

# Segments a..g dans une case 60 × 84 (mêmes tracés que le simulateur)
SEGS = [
    [(14, 6), (46, 6), (41, 12), (19, 12)],
    [(48, 8), (42, 14), (42, 36), (48, 40)],
    [(48, 44), (42, 48), (42, 70), (48, 76)],
    [(14, 78), (46, 78), (41, 72), (19, 72)],
    [(12, 44), (18, 48), (18, 70), (12, 76)],
    [(12, 8), (18, 14), (18, 36), (12, 40)],
    [(15, 42), (20, 38), (40, 38), (45, 42), (40, 46), (20, 46)],
]
MASK = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7C, 0x07, 0x7F, 0x67]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def digit(d, x, y, k, n):
    for i, poly in enumerate(SEGS):
        on = MASK[n] >> i & 1
        d.polygon([(x + px * k, y + py * k) for px, py in poly], fill=rgb(SEG_ON if on else SEG_OFF))


def chip(d, x0, y0, w, h, label, font):
    pp = h / 8.5
    for i in range(8):
        py = y0 + pp * (i + 0.75)
        d.rectangle([x0 - w * 0.1, py, x0, py + pp * 0.4], fill=rgb(PIN))
        d.rectangle([x0 + w, py, x0 + w * 1.1, py + pp * 0.4], fill=rgb(PIN))
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=w * 0.06, fill=rgb(BODY), outline=rgb(BORDER), width=max(2, int(w / 60)))
    d.ellipse([x0 + w * 0.1, y0 + w * 0.1, x0 + w * 0.2, y0 + w * 0.2], fill=rgb(ORANGE))
    d.text((x0 + w / 2, y0 + h / 2), label, font=font, fill=rgb(ACCENT), anchor="mm")


def scene(W, H, path):
    img = Image.new("RGB", (W, H), rgb(BG))
    d = ImageDraw.Draw(img)
    step = max(12, W // 80)
    for x in range(step // 2, W, step):
        for y in range(step // 2, H, step):
            d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=rgb(DOT))
    # Afficheur 12:34 dans un cadre
    k = W / 620
    dw, gap = 60 * k, 10 * k
    total = 4 * dw + 3 * gap + 30 * k
    x0, y0 = (W - total) / 2, H * 0.12
    d.rounded_rectangle([x0 - 24 * k, y0 - 18 * k, x0 + total + 24 * k, y0 + 84 * k + 18 * k],
                        radius=10 * k, fill=rgb("#0b0d0d"), outline=rgb(BORDER), width=max(2, int(2 * k)))
    x = x0
    for i, n in enumerate([1, 2, 3, 4]):
        digit(d, x, y0, k, n)
        x += dw + gap
        if i == 1:
            cx = x + 5 * k
            for cy in (y0 + 28 * k, y0 + 58 * k):
                d.ellipse([cx - 5 * k, cy - 5 * k, cx + 5 * k, cy + 5 * k], fill=rgb(SEG_ON))
            x += 30 * k
    # CD4060 + quartz sous l'afficheur
    font = ImageFont.truetype(FONT, max(12, int(W / 45)))
    cw, ch = W * 0.2, H * 0.2
    cx0, cy0 = W * 0.5 - cw / 2, H * 0.68
    chip(d, cx0, cy0, cw, ch, "CD4060", font)
    qx, qy = cx0 - cw * 0.55, cy0 + ch / 2
    lw = max(2, int(W / 400))
    d.line([qx - cw * 0.12, qy - ch * 0.28, qx + cw * 0.12, qy - ch * 0.28], fill=rgb(PIN), width=lw)
    d.line([qx - cw * 0.12, qy + ch * 0.28, qx + cw * 0.12, qy + ch * 0.28], fill=rgb(PIN), width=lw)
    d.rectangle([qx - cw * 0.08, qy - ch * 0.18, qx + cw * 0.08, qy + ch * 0.18], outline=rgb(PIN), width=lw)
    d.line([qx, qy - ch * 0.28, qx, qy - ch * 0.45, cx0 - cw * 0.1, qy - ch * 0.45], fill=rgb(ACCENT), width=lw)
    d.line([qx, qy + ch * 0.28, qx, qy + ch * 0.45, cx0 - cw * 0.1, qy + ch * 0.45], fill=rgb(ACCENT), width=lw)
    small = ImageFont.truetype(FONT, max(10, int(W / 70)))
    d.text((qx, qy + ch * 0.62), "32,768 kHz", font=small, fill=rgb(PIN), anchor="mm")
    # liaison vers l'afficheur
    d.line([cx0 + cw * 1.1, cy0 + ch / 2, W * 0.78, cy0 + ch / 2, W * 0.78, y0 + 102 * k], fill=rgb("#f7e36a"), width=lw)
    d.text((W * 0.8, cy0 + ch / 2 - H * 0.05), "Q14 : 2 Hz", font=small, fill=rgb("#f7e36a"), anchor="lm")
    img.save(path, "JPEG", quality=85, optimize=True, progressive=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    scene(1600, 900, os.path.join(OUT, "banniere.jpg"))
    scene(560, 336, os.path.join(OUT, "vignette.jpg"))
    print("Images générées dans", OUT)
