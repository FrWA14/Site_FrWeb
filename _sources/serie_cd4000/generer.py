#!/usr/bin/env python3
"""Génère la page « Série CD4000 » et ses 47 fiches de circuits.

    python3 _sources/serie_cd4000/generer.py

Produit, dans pages/electronique/serie_cd4000/ :
  - Serie_CD4000.html + assets/images/ (bannière, vignette, brochages)
  - un dossier par circuit : cd4017/CD4017.html + assets/images/cd4017.svg
Puis relancer ./generate-navigation.sh.

Les textes et les brochages sont dans chips.py ; la simulation est faite par
src/js/ui/logic-sim.js (attribut data-lsim des fiches).
"""
import html
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chips import CHIPS, HC_EQUIV  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "pages", "electronique", "serie_cd4000")

# Palette du site (variables.css, thème sombre)
BG, BODY, BORDER = "#1e2a2a", "#121a1a", "#3d7a7a"
PIN, TEXT, ACCENT, ORANGE, MUTED = "#a8b5b5", "#e8f0f0", "#4ecdc4", "#e67e22", "#6a7a7a"
WIRE, GATE_FILL, GATE_STROKE = "#4ecdc4", "#173332", "#c8d5d5"


# ===========================================================================
# Brochage SVG avec logique interne
# ===========================================================================
PITCH, BX, BW, TOP, W = 26, 92, 200, 56, 384


def label_svg(lbl):
    if lbl.startswith("~"):
        return f'<tspan text-decoration="overline">{html.escape(lbl[1:])}</tspan>'
    if "/~" in lbl:
        a, b = lbl.split("/~")
        return f'{html.escape(a)}/<tspan text-decoration="overline">{html.escape(b)}</tspan>'
    return html.escape(lbl)


def label_html(lbl):
    if lbl.startswith("~"):
        return f'<span class="over">{html.escape(lbl[1:])}</span>'
    if "/~" in lbl:
        a, b = lbl.split("/~")
        return f'{html.escape(a)}/<span class="over">{html.escape(b)}</span>'
    return html.escape(lbl)


def color_for(lbl):
    return {"VDD": ORANGE, "VSS": ACCENT, "VEE": ACCENT, "NC": MUTED}.get(lbl, TEXT)


class Pkg:
    def __init__(self, pins):
        self.pins = pins
        self.n = len(pins)
        self.half = self.n // 2
        self.bh = self.half * PITCH + 14
        self.H = TOP + self.bh + 28
        self.s = []

    def Y(self, r):
        return TOP + 7 + PITCH / 2 + r * PITCH

    def pin_pos(self, p):
        """(x_bord, y) d'une broche, en coordonnées absolues."""
        if p <= self.half:
            return BX, self.Y(p - 1)
        return BX + BW, self.Y(self.n - p)

    def X(self, x):
        return BX + x

    def line(self, pts, color=WIRE, dash=False, width=1.6):
        d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        extra = ' stroke-dasharray="4 3"' if dash else ""
        self.s.append(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
                      f'stroke-linejoin="round"{extra}/>')

    def wire_in(self, pin, xk, yin, xin):
        x0, y0 = self.pin_pos(pin)
        self.line([(x0, y0), (self.X(xk), y0), (self.X(xk), yin), (self.X(xin), yin)])

    def wire_out(self, xtip, ytip, xo, pin):
        x1, y1 = self.pin_pos(pin)
        self.line([(self.X(xtip), ytip), (self.X(xo), ytip), (self.X(xo), y1), (x1, y1)])


def gate_shape(gtype, schmitt, nin):
    """Contour d'une porte orientée vers la droite, entrée à x=0, centrée en y=0.
    Renvoie (éléments svg, x de la sortie, demi-hauteur, x d'entrée)."""
    h = {1: 22, 2: 30, 3: 34, 4: 42}[nin]
    hh = h / 2
    w = 34 if nin > 1 else 26
    parts = []
    inv = gtype in ("nand", "nor", "xnor", "not")
    base = gtype.replace("n", "", 1) if gtype in ("nand", "nor") else gtype
    if gtype == "xnor":
        base = "xor"
    x_in = 0
    if base == "and":
        parts.append(f'<path d="M0,{-hh} H{w - hh} A{hh},{hh} 0 0 1 {w - hh},{hh} H0 Z"/>')
        tip = w
    elif base in ("or", "xor"):
        off = 5 if base == "xor" else 0
        parts.append(f'<path d="M{off},{-hh} Q{off + w * 0.55},{-hh} {off + w},0 Q{off + w * 0.55},{hh} {off},{hh} '
                     f'Q{off + hh * 0.55},0 {off},{-hh} Z"/>')
        if base == "xor":
            parts.append(f'<path d="M0,{-hh} Q{hh * 0.55},0 0,{hh}" fill="none"/>')
        tip = off + w
        x_in = 4
    else:  # not / buf
        parts.append(f'<path d="M0,{-hh} L{w},0 L0,{hh} Z"/>')
        tip = w
    if schmitt:
        cx = w * 0.32 if base in ("not", "buf") else w * 0.42
        parts.append(f'<path d="M{cx - 6},4 H{cx + 1} V-4 H{cx + 4} M{cx - 4},4 V-4 H{cx + 6}" '
                     f'fill="none" stroke-width="1"/>')
    if inv:
        parts.append(f'<circle cx="{tip + 3}" cy="0" r="3"/>')
        tip += 6
    return parts, tip, hh, x_in


IN_OFFSETS = {1: [0], 2: [-8, 8], 3: [-10, 0, 10], 4: [-15, -5, 5, 15]}


def draw_gate(pk, gtype, schmitt, direction, xin, cy, ins, out):
    """ins = [(broche, xk)], out = (broche, xo) ; coordonnées x relatives au boîtier."""
    nin = len(ins)
    parts, tip, hh, x_in = gate_shape(gtype, schmitt, nin)
    sign = 1 if direction == "R" else -1
    tr = f'translate({pk.X(xin):.1f},{cy:.1f})' + ('' if sign == 1 else ' scale(-1,1)')
    pk.s.append(f'<g transform="{tr}" fill="{GATE_FILL}" stroke="{GATE_STROKE}" stroke-width="1.6">{"".join(parts)}</g>')
    # entrées triées de haut en bas
    ins_sorted = sorted(ins, key=lambda pc: pk.pin_pos(pc[0])[1])
    for (pin, xk), off in zip(ins_sorted, IN_OFFSETS[nin]):
        pk.wire_in(pin, xk, cy + off, xin + sign * x_in)
    pin, xo = out
    pk.wire_out(xin + sign * tip, cy, xo, pin)


def layout_gates(pk, layout, gtype, schmitt):
    Y = pk.Y
    g = lambda *a: draw_gate(pk, gtype, schmitt, *a)  # noqa: E731
    if layout == "G4_2":
        g("R", 40, Y(0.5), [(1, 30), (2, 30)], (3, 90))
        g("R", 40, Y(4.5), [(5, 30), (6, 30)], (4, 90))
        g("L", 160, Y(5.5), [(9, 170), (8, 170)], (10, 110))
        g("L", 160, Y(1.5), [(13, 170), (12, 170)], (11, 110))
    elif layout == "G3_3":
        g("R", 30, Y(3), [(3, 22), (4, 22), (5, 22)], (6, 82))
        g("L", 170, Y(2), [(13, 178), (12, 178), (11, 178)], (10, 118))
        g("R", 100, Y(5), [(1, 94), (2, 88), (8, 94)], (9, 160))
    elif layout == "G2_4":
        g("R", 40, Y(2.5), [(2, 34), (3, 28), (4, 28), (5, 34)], (1, 90))
        g("L", 160, Y(3.5), [(12, 166), (11, 172), (10, 172), (9, 166)], (13, 110))
    elif layout == "HEX6":
        for r_in, p_in, p_out in ((0, 1, 2), (2, 3, 4), (4, 5, 6)):
            g("R", 40, Y(r_in), [(p_in, 30)], (p_out, 86))
        for r_in, p_in, p_out in ((5, 9, 8), (3, 11, 10), (1, 13, 12)):
            g("L", 160, Y(r_in), [(p_in, 170)], (p_out, 114))
    elif layout == "BUF6":
        for r_in, p_in, p_out in ((2, 3, 2), (4, 5, 4), (6, 7, 6)):
            g("R", 40, Y(r_in), [(p_in, 30)], (p_out, 86))
        for r_in, p_in, p_out in ((7, 9, 10), (5, 11, 12), (2, 14, 15)):
            g("L", 160, Y(r_in), [(p_in, 170)], (p_out, 114))


def draw_switch(pk, sx, pa, pb, ctl_pin, xc, ymid_sign):
    """Interrupteur vertical entre les broches pa (haut) et pb (bas), commandé par ctl_pin."""
    xa, ya = pk.pin_pos(pa)
    xb, yb = pk.pin_pos(pb)
    X = pk.X(sx)
    pk.line([(xa, ya), (X, ya), (X, ya + 7)])
    pk.line([(xb, yb), (X, yb), (X, yb - 7)])
    lever_x = X + 9 * ymid_sign
    pk.line([(X, yb - 7), (lever_x, ya + 9)], color=GATE_STROKE, width=2)
    pk.s.append(f'<circle cx="{X}" cy="{ya + 7}" r="2" fill="{GATE_STROKE}"/>')
    ym = (ya + yb) / 2
    xcx, ycx = pk.pin_pos(ctl_pin)
    mid_x = (X + lever_x) / 2
    pk.line([(xcx, ycx), (pk.X(xc), ycx), (pk.X(xc), ym), (mid_x, ym)], color=ORANGE, dash=True, width=1.4)


def layout_switches(pk):
    Y = pk.Y
    draw_switch(pk, 60, 1, 2, 13, 96, 1)
    draw_switch(pk, 60, 3, 4, 5, 96, 1)
    draw_switch(pk, 140, 9, 8, 6, 104, -1)
    draw_switch(pk, 140, 11, 10, 12, 104, -1)
    return Y


def block(pk, x0, x1, r0, r1, title, pins_left, pins_right):
    Y = pk.Y
    y0, y1 = Y(r0) - 12, Y(r1) + 12
    pk.s.append(f'<rect x="{pk.X(x0)}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx="5" '
                f'fill="{GATE_FILL}" stroke="{GATE_STROKE}" stroke-width="1.4"/>')
    for p in pins_left:
        x, y = pk.pin_pos(p)
        pk.line([(x, y), (pk.X(x0), y)])
    for p in pins_right:
        x, y = pk.pin_pos(p)
        pk.line([(x, y), (pk.X(x1), y)])
    lines = title.split("|")
    cy = (y0 + y1) / 2 - (len(lines) - 1) * 8
    cx = pk.X((x0 + x1) / 2)
    for i, t in enumerate(lines):
        pk.s.append(f'<text x="{cx}" y="{cy + i * 16 + 4}" text-anchor="middle" font-size="12" '
                    f'font-weight="bold" fill="{ACCENT}">{html.escape(t)}</text>')


def signal_pins(pk, pins):
    return [p for p in pins if pk.pins[p - 1] not in ("VDD", "VSS", "NC", "VEE")]


def layout_block(pk, title):
    left = signal_pins(pk, range(1, pk.half + 1))
    right = signal_pins(pk, range(pk.half + 1, pk.n + 1))
    block(pk, 34, 166, 0, pk.half - 1, title, left, right)


def layout_block2(pk, t1, t2):
    left = signal_pins(pk, range(1, pk.half + 1))
    right = signal_pins(pk, range(pk.half + 1, pk.n + 1))
    block(pk, 30, 94, 0, pk.half - 2, t1, left, [])
    block(pk, 106, 170, 1, pk.half - 1, t2, [], right)


def layout_ff(pk, kind):
    Y = pk.Y

    def ff(x0, x1, rows_pins, side, title):
        r0 = min(r for r, _, _ in rows_pins)
        r1 = max(r for r, _, _ in rows_pins)
        y0, y1 = Y(r0) - 12, Y(r1) + 12
        pk.s.append(f'<rect x="{pk.X(x0)}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx="5" '
                    f'fill="{GATE_FILL}" stroke="{GATE_STROKE}" stroke-width="1.4"/>')
        for r, p, name in rows_pins:
            x, y = pk.pin_pos(p)
            edge = pk.X(x0) if side == "L" else pk.X(x1)
            pk.line([(x, y), (edge, y)])
            tx = edge + 5 if side == "L" else edge - 5
            anchor = "start" if side == "L" else "end"
            if name == "CLK":
                d = 1 if side == "L" else -1
                pk.s.append(f'<path d="M{edge},{y - 5} L{edge + 7 * d},{y} L{edge},{y + 5}" fill="none" '
                            f'stroke="{GATE_STROKE}" stroke-width="1.2"/>')
                tx += 6 * d
            pk.s.append(f'<text x="{tx}" y="{y + 4}" text-anchor="{anchor}" font-size="10" fill="{TEXT}">'
                        f'{label_svg(name)}</text>')
        # titre vertical, du côté opposé aux étiquettes
        tx = pk.X(x1) - 12 if side == "L" else pk.X(x0) + 12
        ty = (y0 + y1) / 2
        pk.s.append(f'<text x="{tx}" y="{ty}" text-anchor="middle" dominant-baseline="central" font-size="12" '
                    f'font-weight="bold" fill="{ACCENT}" transform="rotate(-90 {tx} {ty})">{title}</text>')

    if kind == "4013":
        names = ["Q", "~Q", "CLK", "R", "D", "S"]
        ff(28, 96, [(i, i + 1, names[i]) for i in range(6)], "L", "FF1")
        ff(104, 172, [(i + 1, 13 - i, names[i]) for i in range(6)], "R", "FF2")
    else:  # 4027
        names = ["Q", "~Q", "CLK", "R", "K", "J", "S"]
        ff(28, 96, [(i, i + 1, names[i]) for i in range(7)], "L", "FF2")
        ff(104, 172, [(i + 1, 15 - i, names[i]) for i in range(7)], "R", "FF1")


def chip_svg(c):
    ref, pins = c["ref"], c["pins"]
    pk = Pkg(pins)
    s = pk.s
    s.append(f'<rect width="{W}" height="{pk.H}" rx="12" fill="{BG}"/>')
    s.append(f'<text x="{W / 2}" y="32" text-anchor="middle" font-size="20" font-weight="bold" fill="{ACCENT}">CD{ref}</text>')
    # broches et noms
    for i in range(pk.half):
        y = pk.Y(i)
        for side, num in (("L", i + 1), ("R", pk.n - i)):
            lbl = pins[num - 1]
            # largeur approximative du nom (police mono 13 px) pour le fond cliquable
            lw = len(lbl.replace("~", "")) * 7.9 + 8
            s.append(f'<g class="pin" data-pin="{num}">')
            if side == "L":
                s.append(f'<rect class="pin-hl" x="{BX - 18 - lw:.1f}" y="{y - 9}" width="{lw:.1f}" height="18" rx="3" fill="none"/>')
                s.append(f'<rect class="lead{" p1" if num == 1 else ""}" x="{BX - 16}" y="{y - 6}" width="16" height="12" rx="2" fill="{ORANGE if num == 1 else PIN}"/>')
                s.append(f'<text class="pin-v" x="{BX - 8}" y="{y + 3.5}" text-anchor="middle" font-size="10" font-weight="bold"></text>')
                s.append(f'<text class="pin-n" x="{BX - 22}" y="{y + 5}" text-anchor="end" font-size="13" fill="{color_for(lbl)}">{label_svg(lbl)}</text>')
            else:
                s.append(f'<rect class="pin-hl" x="{BX + BW + 18}" y="{y - 9}" width="{lw:.1f}" height="18" rx="3" fill="none"/>')
                s.append(f'<rect class="lead" x="{BX + BW}" y="{y - 6}" width="16" height="12" rx="2" fill="{PIN}"/>')
                s.append(f'<text class="pin-v" x="{BX + BW + 8}" y="{y + 3.5}" text-anchor="middle" font-size="10" font-weight="bold"></text>')
                s.append(f'<text class="pin-n" x="{BX + BW + 22}" y="{y + 5}" font-size="13" fill="{color_for(lbl)}">{label_svg(lbl)}</text>')
            s.append('</g>')
    # boîtier
    s.append(f'<rect x="{BX}" y="{TOP}" width="{BW}" height="{pk.bh}" rx="6" fill="{BODY}" stroke="{BORDER}" stroke-width="2"/>')
    s.append(f'<path d="M{BX + BW / 2 - 12} {TOP} a12 12 0 0 0 24 0" fill="{BG}" stroke="{BORDER}" stroke-width="2"/>')
    # logique interne
    kind = c["draw"][0]
    if kind == "gates":
        _, layout, gtype, schmitt = c["draw"]
        layout_gates(pk, layout, gtype, schmitt)
    elif kind == "switches":
        layout_switches(pk)
    elif kind == "ff":
        layout_ff(pk, c["draw"][1])
    elif kind == "block":
        layout_block(pk, c["draw"][1])
    elif kind == "block2":
        layout_block2(pk, c["draw"][1], c["draw"][2])
    # numéros de broches (au-dessus des fils)
    for i in range(pk.half):
        y = pk.Y(i)
        s.append(f'<text x="{BX + 4}" y="{y - 4}" font-size="9" fill="{MUTED}">{i + 1}</text>')
        s.append(f'<text x="{BX + BW - 4}" y="{y - 4}" text-anchor="end" font-size="9" fill="{MUTED}">{pk.n - i}</text>')
    s.append(f'<text x="{W / 2}" y="{pk.H - 10}" text-anchor="middle" font-size="10" fill="{MUTED}">DIP-{pk.n} · vue de dessus</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {pk.H}" width="{W}" height="{pk.H}" '
            f'font-family="DejaVu Sans Mono, Consolas, monospace">\n' + "\n".join(s) + "\n</svg>\n")


# ===========================================================================
# Bannière et vignette
# ===========================================================================
def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def scene(Wd, Hd, path, quality):
    img = Image.new("RGB", (Wd, Hd), hexrgb("#0a0f0f"))
    d = ImageDraw.Draw(img)
    step = max(12, Wd // 80)
    for x in range(step // 2, Wd, step):
        for y in range(step // 2, Hd, step):
            d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=hexrgb("#1a2424"))
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", max(14, Wd // 60))
    refs = ["4011", "4017", "4060", "4093", "4511", "4066"]
    cw, ch = Wd * 0.12, Hd * 0.42
    gap = (Wd - len(refs) * cw) / (len(refs) + 1)
    for k, r in enumerate(refs):
        x0 = gap + k * (cw + gap)
        y0 = Hd * 0.30 + (k % 2) * Hd * 0.08
        pp = ch / 7.5
        for i in range(7):
            py = y0 + pp * (i + 0.75)
            d.rectangle([x0 - cw * 0.12, py, x0, py + pp * 0.4], fill=hexrgb(PIN))
            d.rectangle([x0 + cw, py, x0 + cw * 1.12, py + pp * 0.4], fill=hexrgb(PIN))
        lw = max(2, Wd // 400)
        d.rounded_rectangle([x0, y0, x0 + cw, y0 + ch], radius=cw * 0.06, fill=hexrgb(BODY), outline=hexrgb(BORDER), width=lw)
        rr = cw * 0.12
        d.pieslice([x0 + cw / 2 - rr, y0 - rr, x0 + cw / 2 + rr, y0 + rr], 0, 180, fill=hexrgb("#0a0f0f"), outline=hexrgb(BORDER), width=lw)
        d.ellipse([x0 + cw * 0.12, y0 + cw * 0.12, x0 + cw * 0.24, y0 + cw * 0.24], fill=hexrgb(ORANGE))
        txt = Image.new("RGBA", (int(ch), int(cw)), (0, 0, 0, 0))
        ImageDraw.Draw(txt).text((ch / 2, cw / 2), "CD" + r, font=font, fill=hexrgb(ACCENT), anchor="mm")
        txt = txt.rotate(90, expand=True)
        img.paste(txt, (int(x0), int(y0)), txt)
    img.save(path, "JPEG", quality=quality, optimize=True, progressive=True)


# ===========================================================================
# Descriptions des broches
# ===========================================================================
def pin_description(c, lbl):
    return re.sub(r"2\^(\d+)", lambda m: sup(2, m.group(1)), _pin_description(c, lbl))


def _pin_description(c, lbl):
    pd = c.get("pd", {})
    if lbl in pd:
        return pd[lbl]
    if lbl == "VDD":
        return "Alimentation positive (+3 à +18 V)"
    if lbl == "VSS":
        return "Masse (0 V)"
    if lbl == "VEE":
        return "Alimentation négative des signaux analogiques (à relier à VSS en alimentation simple)"
    if lbl == "NC":
        return "Non connectée"
    if "gate" in c:
        gtype = c["gate"][0]
        what = {"not": "de l'inverseur", "buf": "du buffer"}.get(gtype, "de la porte")
        m = re.fullmatch(r"(\d)([A-D])", lbl)
        if m:
            if gtype in ("not", "buf"):
                return f"Entrée {what} {m.group(1)}"
            return f"Entrée {m.group(2)} {what} {m.group(1)}"
        m = re.fullmatch(r"(\d)Y", lbl)
        if m:
            return f"Sortie {what} {m.group(1)}"
    m = re.fullmatch(r"(\d)(E/S|S/E)", lbl)
    if m and "SW" in pd:
        return pd["SW"].format(n=m.group(1))
    m = re.fullmatch(r"(\d)CTL", lbl)
    if m and "CTL" in pd:
        return pd["CTL"].format(n=m.group(1))
    if lbl in "abcdefg" and len(lbl) == 1 and "SEG" in pd:
        return pd["SEG"].format(s=lbl)
    m = re.fullmatch(r"Q(\d)([AB])", lbl)
    if m and "QAB" in pd:
        n = int(m.group(1))
        return pd["QAB"].format(n=n, x=m.group(2), m=n - 1)
    m = re.fullmatch(r"([XY])(\d)", lbl)
    if m and "XY" in pd:
        return pd["XY"].format(x=m.group(1), n=m.group(2))
    m = re.fullmatch(r"([ABC])([XY])", lbl)
    if m and "XYC" in pd:
        return pd["XYC"].format(x=m.group(1), y=lbl)
    m = re.fullmatch(r"(CH|Q|P|A|B|S)(\d+)", lbl)
    if m and (m.group(1) + "*") in pd:
        n = int(m.group(2))
        return pd[m.group(1) + "*"].format(n=n, m=n - 1)
    return lbl


SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def sup(b, e):
    return f"{b}{str(e).translate(SUP)}"


# ===========================================================================
# Pages
# ===========================================================================
CREDIT_URL = "https://www.build-electronic-circuits.com/4000-series-integrated-circuits/"


def specs(c):
    cat = c["cat"]
    n = len(c["pins"])
    rows = [("Fonction", c["title"]), ("Boîtier", f"DIP-{n} (existe aussi en SOIC-{n})"),
            ("Alimentation", "3 V à 18 V (20 V maximum absolu)")]
    if cat == "Analogique":
        rows.append(("Signaux commutés", "entre VEE (ou VSS) et VDD, dans les deux sens"))
    else:
        if c.get("gate") and "Schmitt" in c["title"]:
            rows.append(("Seuils d'entrée (VDD = 5 V)", "≈ 2,9 V à la montée, ≈ 1,9 V à la descente (typ.)"))
        else:
            rows.append(("Niveaux d'entrée", "0 sous 30 % de VDD, 1 au-dessus de 70 % de VDD"))
        if c["ref"] in ("4049", "4050"):
            rows.append(("Entrées", "tolèrent jusqu'à 18 V même si VDD est plus faible"))
            rows.append(("Courant de sortie", "fort : plusieurs mA à 5 V, plusieurs dizaines de mA à 15 V en absorption"))
        elif not any(k == "Courant de sortie" for k, _ in c.get("extra_specs", [])):
            rows.append(("Courant de sortie", "≈ 1 mA à 5 V, ≈ 7 mA à 15 V (typ.)"))
    if cat in ("Portes", "Schmitt / buffers"):
        rows.append(("Temps de propagation", "≈ 100 ns à 5 V, ≈ 50 ns à 10 V (typ.)"))
        rows.append(("Consommation au repos", "&lt; 1 µA (typ.)"))
    elif cat in ("Compteurs", "Registres", "Bascules"):
        rows.append(("Fréquence d'horloge max", "≈ 2 à 5 MHz à 5 V, plus de 10 MHz à 15 V (typ.)"))
        rows.append(("Consommation au repos", "quelques µA au plus"))
    else:
        rows.append(("Consommation au repos", "quelques µA au plus"))
    rows += c.get("extra_specs", [])
    rows.append(("Température", "−55 °C à +125 °C (CD4000B)"))
    mc = "MC14106B" if c["ref"] == "40106" else f"MC1{c['ref']}B"
    eq = f"HEF{c['ref']}B, {mc}"
    if c["ref"] in HC_EQUIV:
        eq += f", 74HC{c['ref']} (même brochage, 2 à 6 V)"
    rows.append(("Équivalents", eq))
    return rows


def truth_table_html(gtype, nin):
    from itertools import product
    f = {
        "and": lambda b: all(b), "nand": lambda b: not all(b), "or": lambda b: any(b), "nor": lambda b: not any(b),
        "xor": lambda b: sum(b) % 2 == 1, "xnor": lambda b: sum(b) % 2 == 0, "not": lambda b: not b[0], "buf": lambda b: b[0],
    }[gtype]
    names = "ABCD"[:nin]
    h = '<div class="data-table-wrap" style="display:inline-block"><table class="data-table"><thead><tr>'
    h += "".join(f"<th>{x}</th>" for x in names) + "<th>Y</th></tr></thead><tbody>"
    for bits in product([0, 1], repeat=nin):
        h += "<tr>" + "".join(f"<td>{b}</td>" for b in bits) + f"<td><strong>{int(f(bits))}</strong></td></tr>"
    return h + "</tbody></table></div>"


def how_html(c):
    parts = []
    if "gate" in c:
        gtype, nin = c["gate"]
        word = {"not": "inverseur", "buf": "buffer"}.get(gtype, "porte")
        parts.append(f"<p>Les {word}s du circuit sont identiques et indépendants : la table ci-dessous vaut "
                     f"pour chacun d'eux (Y est la sortie).</p>")
        parts.append(truth_table_html(gtype, nin))
    if c.get("how"):
        how = c["how"]
        if how.startswith("<table"):
            how = f'<div class="data-table-wrap" style="display:inline-block">{how.split("</table>")[0]}</table></div>' \
                  + how.split("</table>", 1)[1]
        elif not how.startswith("<"):
            how = f"<p>{how}</p>"
        parts.append(how)
    return "\n            ".join(parts)


def live_model(c):
    """Modèle logique du brochage interactif (voir ChipModels dans logic-sim.js)."""
    ref = c["ref"]
    if c["draw"][0] == "gates":
        return dict(model="gates", opts=dict(type=c["gate"][0]))
    groups = lambda names, n, fmt: [dict(com=f"{g}COM", ch=[fmt.format(g=g, i=i) for i in range(n)]) for g in names]
    return {
        "4013": dict(model="ff"),
        "4027": dict(model="ff", opts=dict(jk=True)),
        "4017": dict(model="johnson"),
        "4020": dict(model="ripple", opts=dict(clk="~CLK")),
        "4040": dict(model="ripple", opts=dict(clk="~CLK")),
        "4024": dict(model="ripple", opts=dict(clk="~CLK", period=0.4)),
        "4060": dict(model="ripple", opts=dict(clk="φI", osc=True)),
        "4026": dict(model="c4026"),
        "4029": dict(model="updown"),
        "4510": dict(model="updown", opts=dict(rst=True)),
        "4518": dict(model="dual", opts=dict(bcd=True)),
        "4520": dict(model="dual"),
        "4014": dict(model="piso"),
        "4021": dict(model="piso", opts=dict(async_=True)),
        "4015": dict(model="sipo"),
        "4094": dict(model="c4094"),
        "4016": dict(model="switches"),
        "4066": dict(model="switches"),
        "4051": dict(model="amux", opts=dict(sel=["A", "B", "C"], groups=[dict(com="COM", ch=[f"CH{i}" for i in range(8)])])),
        "4052": dict(model="amux", opts=dict(sel=["A", "B"], groups=groups("XY", 4, "{g}{i}"))),
        "4053": dict(model="amux", opts=dict(sel=["A", "B", "C"], perGroup=True,
                                              groups=[dict(com=f"{g}COM", ch=[f"{g}X", f"{g}Y"]) for g in "ABC"])),
        "4028": dict(model="c4028"),
        "4511": dict(model="c4511"),
        "4008": dict(model="adder"),
        "4046": dict(model="pll"),
        "4047": dict(model="c4047"),
        "4538": dict(model="c4538"),
    }[ref]


def sims_html(c):
    """Simulations en bas de fiche : la principale, puis les éventuelles suivantes."""
    pins = c["pins"]
    common = dict(chip="CD" + c["ref"], vdd=pins.index("VDD") + 1, vss=pins.index("VSS") + 1,
                  pinmap={p: i + 1 for i, p in reversed(list(enumerate(pins)))})
    out = []
    for sim in [c["sim"]] + c.get("extra_sims", []):
        opts = html.escape(json.dumps(dict(sim["opts"], **common), ensure_ascii=False), quote=True)
        out.append(f"""<h2>Simulation : {html.escape(sim['title'])}</h2>
        <p>{sim['text']}</p>

        <div data-lsim="{sim['name']}" data-lsim-opts="{opts}"></div>""")
    return "\n\n        ".join(out)


def chip_page(c):
    ref = c["ref"]
    rows = "\n".join(
        f"                        <tr><td>{i + 1}</td><td>{label_html(l)}</td><td>{html.escape(pin_description(c, l))}</td></tr>"
        for i, l in enumerate(c["pins"]))
    spec_rows = "\n".join(f"                        <tr><td>{k}</td><td>{v}</td></tr>" for k, v in specs(c))
    desc = re.sub("<[^>]+>", "", c["intro"]).split(". ")[0] + "."
    live = html.escape(json.dumps(dict(pins=c["pins"], **live_model(c)), ensure_ascii=False), quote=True)
    svg = chip_svg(c).replace('<svg ', f'<svg role="img" aria-label="Brochage et schéma interne du CD{ref}" ', 1)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>CD{ref} - FrWA Conception</title>
    <meta name="description" content="{html.escape(desc, quote=True)}">
    <meta name="tags" content="Électronique, CD4000, {c['cat']}">
    <meta name="vignette" content="assets/images/cd{ref}.svg">
</head>
<body>
    <!-- Page générée par _sources/serie_cd4000/generer.py -->
    <div class="page-content">
        <h1>CD{ref} — {html.escape(c['title'])}</h1>

        <div class="flex gap-sm" style="margin-bottom: var(--spacing-lg);">
            <span class="badge badge-primary">Électronique</span>
            <span class="badge badge-secondary">Série CD4000</span>
            <span class="badge badge-accent">{c['cat']}</span>
        </div>

        <p class="lead">{c['intro']}</p>

        <div class="chip-head">
            <div class="chip-pinout chip-live" data-chip-live="{live}">
{svg}            </div>
            <div>
                <h2>Caractéristiques</h2>
                <div class="data-table-wrap">
                    <table class="data-table">
                    <tbody>
{spec_rows}
                    </tbody>
                    </table>
                </div>
                <p class="text-muted" style="font-size: var(--font-size-sm);">
                    Valeurs typiques à 25 °C, qui varient selon le fabricant : vérifiez toujours la fiche
                    technique (datasheet) avant de câbler.
                </p>
            </div>
        </div>

        <div class="divider"></div>

        <h2>Brochage</h2>
        <div class="data-table-wrap">
            <table class="data-table">
                <thead><tr><th>Broche</th><th>Nom</th><th>Fonction</th></tr></thead>
                <tbody>
{rows}
                </tbody>
            </table>
        </div>

        <h2>Fonctionnement</h2>
            {how_html(c)}

        <div class="divider"></div>

{sims_html(c)}

        <div class="divider"></div>

        <p class="text-center">
            <a data-retour class="btn btn-primary"></a>
        </p>
    </div>
</body>
</html>
"""


MAIN_STYLE = """
    <style>
        .cd4k-filters { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; margin: var(--spacing-lg) 0 var(--spacing-md); }
        .cd4k-filters input { flex: 1 1 220px; min-width: 0; background: var(--bg-tertiary); border: 1px solid var(--color-primary-dark); border-radius: var(--border-radius-sm); color: var(--text-primary); padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-sm); }
        .cd4k-filters input:focus { outline: 2px solid var(--text-accent); outline-offset: 1px; }
        .cd4k-cats { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
        .cd4k-cats button { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--color-primary-dark); border-radius: var(--border-radius-sm); padding: var(--spacing-xs) var(--spacing-md); font-size: var(--font-size-sm); cursor: pointer; }
        .cd4k-cats button.active { background: var(--color-primary); color: #fff; font-weight: 700; }
        .cd4k-cats button:focus-visible { outline: 2px solid var(--text-accent); outline-offset: 1px; }
        .cd4k-count { font-size: var(--font-size-sm); color: var(--text-muted); margin-bottom: var(--spacing-sm); }
        .cd4k-table-wrap { overflow-x: auto; border-radius: var(--border-radius-md); border: 1px solid var(--bg-tertiary); }
        .cd4k-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
        .cd4k-table th { background: var(--color-primary); color: #fff; text-align: left; padding: var(--spacing-sm) var(--spacing-md); }
        .cd4k-table td { padding: var(--spacing-sm) var(--spacing-md); border-top: 1px solid var(--bg-tertiary); vertical-align: middle; color: var(--text-primary); }
        .cd4k-table tbody tr:nth-child(even) { background: var(--bg-secondary); }
        .cd4k-ref a { font-family: var(--font-family-mono); font-weight: 700; color: var(--text-accent); white-space: nowrap; text-decoration: none; }
        .cd4k-ref a:hover { text-decoration: underline; }
        .cd4k-pinout { width: 190px; }
        .cd4k-pinout a { display: block; border-radius: var(--border-radius-sm); transition: transform var(--transition-fast), box-shadow var(--transition-fast); }
        .cd4k-pinout a:hover { transform: scale(1.03); box-shadow: var(--shadow-glow); }
        .cd4k-pinout img { display: block; width: 170px; height: auto; border-radius: var(--border-radius-sm); }
        .cd4k-meta { font-size: var(--font-size-xs); color: var(--text-muted); }
        .cd4k-empty { text-align: center; color: var(--text-muted); padding: var(--spacing-lg); }
        .cd4k-legend { display: flex; flex-wrap: wrap; gap: var(--spacing-md) var(--spacing-xl); font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: var(--spacing-md); }
        .cd4k-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--color-accent); margin-right: var(--spacing-xs); }
        .cd4k-over { text-decoration: overline; }
        @media (max-width: 600px) {
            .cd4k-table th:last-child, .cd4k-table td:last-child { display: none; }
            .cd4k-pinout { width: 110px; }
            .cd4k-pinout img { width: 100px; }
        }
    </style>"""

MAIN_SCRIPT = """
    <script>
    (function () {
        const table = document.getElementById('cd4k-table');
        if (!table) return;
        const search = document.getElementById('cd4k-search');
        const count = document.getElementById('cd4k-count');
        const buttons = document.querySelectorAll('.cd4k-cats button');
        const rows = Array.from(table.querySelectorAll('tbody tr[data-cat]'));
        const empty = table.querySelector('.cd4k-empty-row');
        let cat = '';

        // Recherche sans tenir compte des accents ni des majuscules
        const norm = s => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();

        function apply() {
            const q = norm(search.value.trim());
            let shown = 0;
            rows.forEach(row => {
                const ok = (!cat || row.dataset.cat === cat) && (!q || norm(row.textContent).includes(q));
                row.hidden = !ok;
                if (ok) shown++;
            });
            empty.hidden = shown > 0;
            count.textContent = shown + (shown > 1 ? ' circuits' : ' circuit');
        }

        buttons.forEach(btn => btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.toggle('active', b === btn));
            cat = btn.dataset.cat;
            apply();
        }));
        search.addEventListener('input', apply);
    })();
    </script>"""


def main_page(chips):
    cats = []
    for c in chips:
        if c["cat"] not in cats:
            cats.append(c["cat"])
    rows = []
    for c in sorted(chips, key=lambda c: int(c["ref"])):
        r = c["ref"]
        link = f"cd{r}/CD{r}.html"
        rows.append(f"""                    <tr data-cat="{c['cat']}">
                        <td class="cd4k-ref"><a href="{link}">CD{r}</a></td>
                        <td class="cd4k-pinout">
                            <a href="{link}" title="Fiche du CD{r}"><img src="assets/images/cd{r}.svg" alt="Brochage du CD{r} : {html.escape(c['title'])}" loading="lazy" width="384"></a>
                        </td>
                        <td>{html.escape(c['title'])}<br><span class="cd4k-meta">DIP-{len(c['pins'])}</span></td>
                        <td><span class="badge badge-primary">{c['cat']}</span></td>
                    </tr>""")
    buttons = "\n".join(f'                <button type="button" data-cat="{k}">{k}</button>' for k in cats)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Série CD4000 - FrWA Conception</title>
    <!-- Carte affichée dans la page de section -->
    <meta name="description" content="Liste des circuits logiques CMOS de la série CD4000 avec leur brochage : portes, bascules, compteurs, registres, multiplexeurs analogiques, décodeurs et temporisateurs.">
    <meta name="tags" content="Électronique, CMOS, CD4000">
    <meta name="vignette" content="assets/images/vignette.jpg">
</head>
<body>
    <!-- Page générée par _sources/serie_cd4000/generer.py -->
    <div class="page-content">
        <!-- Bannière -->
        <div class="page-banner">
            <img src="assets/images/banniere.jpg" alt="Circuits intégrés CMOS de la série CD4000">
            <div class="page-banner-overlay">
                <h1 class="page-banner-title">Série CD4000</h1>
                <span class="page-banner-subtitle">Circuits logiques CMOS et brochages</span>
            </div>
        </div>

        <!-- Tags -->
        <div class="flex gap-sm" style="margin-bottom: var(--spacing-lg);">
            <span class="badge badge-primary">Électronique</span>
            <span class="badge badge-secondary">CMOS</span>
            <span class="badge badge-accent">Brochages</span>
        </div>

        <p class="lead">
            La série 4000 est une famille classique de circuits CMOS : portes logiques, bascules,
            compteurs, registres à décalage, interrupteurs analogiques, décodeurs… Ce sont les
            briques de base de l'électronique numérique, l'équivalent CMOS de la série 7400 (TTL).
            Peu coûteux et très sobres, ils restent parfaits pour les montages sans microcontrôleur.
        </p>

        <div class="divider"></div>

        <h2>Liste des circuits</h2>

        <p>
            Cliquez sur un circuit ou sur son brochage pour ouvrir sa fiche : caractéristiques, rôle de
            chaque broche et simulation d'un montage classique. Les boîtiers sont vus
            <strong>de dessus</strong>, encoche vers le haut : la broche 1 est en haut à gauche, puis la
            numérotation tourne dans le sens inverse des aiguilles d'une montre.
        </p>

        <div class="cd4k-filters">
            <input type="search" id="cd4k-search" placeholder="Rechercher : 4017, compteur, NAND, Schmitt…" aria-label="Rechercher un circuit">
            <div class="cd4k-cats" role="group" aria-label="Filtrer par catégorie">
                <button type="button" data-cat="" class="active">Tous</button>
{buttons}
            </div>
        </div>

        <div class="cd4k-count" id="cd4k-count">{len(chips)} circuits</div>

        <div class="cd4k-table-wrap">
            <table class="cd4k-table" id="cd4k-table">
                <thead>
                    <tr>
                        <th>Circuit</th>
                        <th>Brochage</th>
                        <th>Description</th>
                        <th>Catégorie</th>
                    </tr>
                </thead>
                <tbody>
{chr(10).join(rows)}
                    <tr class="cd4k-empty-row" hidden>
                        <td colspan="4" class="cd4k-empty">Aucun circuit ne correspond à la recherche.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="cd4k-legend">
            <span><span class="cd4k-dot"></span>Broche 1 (en orange, près de l'encoche)</span>
            <span><span class="cd4k-over">EN</span> : signal actif à l'état bas</span>
            <span>NC : broche non connectée</span>
            <span>VEE : alimentation négative des signaux analogiques (à relier à VSS si inutilisée)</span>
        </div>

        <div class="divider"></div>

        <h2>Bon à savoir</h2>

        <div class="card-alert info">
            <div class="card-body">
                <strong>🏷️ Préfixes :</strong> le même circuit existe sous plusieurs noms selon le
                fabricant : CD4011, HEF4011, MC14011, NTE4011… Le suffixe <strong>B</strong> indique une
                version à sorties bufferisées, <strong>UB</strong> une version non bufferisée (ex. 4069UB,
                pratique pour les oscillateurs à quartz).
            </div>
        </div>

        <div class="card-alert warning">
            <div class="card-body">
                <strong>⚡ Électricité statique :</strong> les entrées CMOS sont sensibles aux décharges
                électrostatiques. Les manipuler en se déchargeant avant (toucher une masse) et les
                ranger dans leur mousse ou leur tube.
            </div>
        </div>

        <div class="card-alert info">
            <div class="card-body">
                <strong>📚 Crédit :</strong><br>
                Page inspirée de la liste de la série 4000 de
                <a href="{CREDIT_URL}" target="_blank" rel="noopener">Build Electronic Circuits</a>.
                Les brochages ont été redessinés aux couleurs du site ; vérifiez toujours la fiche
                technique (datasheet) du fabricant avant de câbler.
            </div>
        </div>

        <div class="divider"></div>

        <!-- Retour vers la page de section -->
        <p class="text-center">
            <a data-retour class="btn btn-primary"></a>
        </p>
{MAIN_STYLE}
{MAIN_SCRIPT}
    </div>
</body>
</html>
"""


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    img_dir = os.path.join(OUT, "assets", "images")
    os.makedirs(img_dir, exist_ok=True)
    for c in CHIPS:
        assert len(c["pins"]) in (14, 16), c["ref"]
        svg = chip_svg(c)
        ref = c["ref"]
        write(os.path.join(img_dir, f"cd{ref}.svg"), svg)
        write(os.path.join(OUT, f"cd{ref}", "assets", "images", f"cd{ref}.svg"), svg)
        write(os.path.join(OUT, f"cd{ref}", f"CD{ref}.html"), chip_page(c))
    write(os.path.join(OUT, "Serie_CD4000.html"), main_page(CHIPS))
    scene(1600, 960, os.path.join(img_dir, "banniere.jpg"), 82)
    scene(560, 336, os.path.join(img_dir, "vignette.jpg"), 85)
    print(f"{len(CHIPS)} fiches générées dans {OUT}")


if __name__ == "__main__":
    main()
