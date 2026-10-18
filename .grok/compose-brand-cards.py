#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import os

SRC = "/workspace/public/og.jpg"
OUT_OG = "/workspace/.grok/og.jpg.tmp"
OUT_BANNER = "/workspace/.grok/x-banner.jpg.tmp"

SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
CJK = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
IVORY = (241, 239, 233, 255)
MUTED = (196, 190, 176, 230)
SOFT = (154, 150, 140, 210)


def font(path, size, index=0):
    if path.endswith(".ttc"):
        return ImageFont.truetype(path, size, index=index)
    return ImageFont.truetype(path, size)


def draw_centered(draw, xy, text, fnt, fill):
    x, y = xy
    bbox = draw.textbbox((0, 0), text, font=fnt)
    w = bbox[2] - bbox[0]
    draw.text((x - w / 2, y), text, font=fnt, fill=fill)


def draw_left(draw, xy, text, fnt, fill):
    draw.text(xy, text, font=fnt, fill=fill)


def vignette(im, strength=0.55):
    w, h = im.size
    overlay = Image.new("L", (w, h), 0)
    g = ImageDraw.Draw(overlay)
    g.ellipse((-int(w * 0.15), -int(h * 0.2), int(w * 1.15), int(h * 1.2)), fill=255)
    overlay = overlay.filter(ImageFilter.GaussianBlur(90))
    dark = Image.new("RGB", (w, h), (8, 8, 9))
    mask = ImageEnhance.Brightness(overlay).enhance(1.0)
    # invert-ish: low mask = more dark
    inv = Image.eval(mask, lambda p: int(255 - (255 - p) * strength))
    return Image.composite(im, dark, inv)


def shade_rect(im, box, color, blur=18):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rectangle(box, fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base = im.convert("RGBA")
    return Image.alpha_composite(base, layer).convert("RGB")


def compose_og(src):
    im = src.copy()
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = ImageEnhance.Color(im).enhance(0.85)
    im = vignette(im, 0.62)
    # destroy old baked glyphs, then a dark editorial panel
    w, h = im.size
    blurred = im.filter(ImageFilter.GaussianBlur(18))
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((int(w * 0.16), int(h * 0.16), int(w * 0.84), int(h * 0.84)), radius=28, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(22))
    im = Image.composite(blurred, im, mask)
    im = shade_rect(im, (int(w * 0.14), int(h * 0.14), int(w * 0.86), int(h * 0.86)), (7, 7, 8, 175), blur=24)

    canvas = im.convert("RGBA")
    type_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(type_layer)
    d.rounded_rectangle((160, 100, 1040, 530), radius=20, fill=(11, 11, 12, 252))
    f1 = font(SERIF_B, 72)
    f2 = font(SERIF_B, 86)
    f3 = font(SANS, 18)
    f4 = font(CJK, 18)

    cx = w / 2
    y = 205
    draw_centered(d, (cx, y), "EP SERIES", f1, IVORY)
    draw_centered(d, (cx, y + 78), "STUDIO", f2, IVORY)

    # thin rule
    rule_w = 168
    ry = y + 178
    d.rectangle((cx - rule_w / 2, ry, cx + rule_w / 2, ry + 1), fill=MUTED)

    draw_centered(d, (cx, ry + 16), "AI ARTIST NOA", f3, MUTED)
    draw_centered(d, (cx, ry + 46), "단곡  ·  10곡 묶음", f4, SOFT)

    out = Image.alpha_composite(canvas, type_layer).convert("RGB")
    out.save(OUT_OG, "JPEG", quality=88, optimize=True, subsampling=1)


def compose_banner(src):
    # 1200x264 crop from upper-mid of 1200x630
    crop = src.crop((0, 48, 1200, 48 + 264))
    crop = ImageEnhance.Contrast(crop).enhance(1.06)
    crop = ImageEnhance.Color(crop).enhance(0.8)
    crop = vignette(crop, 0.5)
    # left lockup veil — keep right scenery
    crop = shade_rect(crop, (0, 0, 640, 264), (8, 8, 9, 150), blur=22)
    crop = shade_rect(crop, (0, 200, 1200, 264), (8, 8, 9, 70), blur=16)

    w, h = crop.size
    canvas = crop.convert("RGBA")
    type_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(type_layer)
    f1 = font(SERIF_B, 36)
    f2 = font(SERIF_B, 44)
    f3 = font(SANS, 14)

    x = 56
    y = 42
    draw_left(d, (x, y), "EP SERIES", f1, IVORY)
    draw_left(d, (x, y + 40), "STUDIO", f2, IVORY)
    d.rectangle((x, y + 94, x + 92, y + 95), fill=MUTED)
    draw_left(d, (x, y + 104), "AI ARTIST NOA", f3, MUTED)

    out = Image.alpha_composite(canvas, type_layer).convert("RGB")
    out.save(OUT_BANNER, "JPEG", quality=88, optimize=True, subsampling=1)


def main():
    src = Image.open(SRC).convert("RGB")
    if src.size != (1200, 630):
        src = src.resize((1200, 630), Image.Resampling.LANCZOS)
    compose_og(src)
    compose_banner(src)
    for p in (OUT_OG, OUT_BANNER):
        print(p, Image.open(p).size, os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    main()
