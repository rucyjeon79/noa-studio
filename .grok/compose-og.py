#!/usr/bin/env python3
"""Compose Noa Studio 1200×630 share card from the real Papa seal photograph."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path("/workspace")
BG = ROOT / "artifacts/imagine_images/565402e4-da61-4948-abc3-a5b11cde84b7.jpg"
SEAL = ROOT / "public/papa-logo.png"
FONTS = ROOT / ".grok/fonts"
RAW_PNG = ROOT / ".grok/og-card-raw.png"
OUT_JPG = ROOT / ".grok/og.jpg.tmp"

BLACK = (11, 11, 12)
GOLD = (232, 163, 23)
IVORY = (241, 239, 233)
W, H = 2400, 1260  # 2× of 1200×630


def cover(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def circular_seal(src: Image.Image, diameter: int) -> Image.Image:
    im = src.convert("RGBA").resize((diameter, diameter), Image.Resampling.LANCZOS)
    mask = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, diameter - 2, diameter - 2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(mask)
    return im


def tracked_width(font: ImageFont.FreeTypeFont, text: str, spacing: float) -> float:
    if not text:
        return 0.0
    total = 0.0
    for i, ch in enumerate(text):
        bbox = font.getbbox(ch)
        total += bbox[2] - bbox[0]
        if i < len(text) - 1:
            total += spacing
    return total


def draw_tracked(draw: ImageDraw.ImageDraw, xy, text, font, fill, spacing: float) -> None:
    x, y = xy
    for i, ch in enumerate(text):
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = font.getbbox(ch)
        x += (bbox[2] - bbox[0]) + spacing


def gold_glow(size, center, radius, color=GOLD, alpha=78, blur=72) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(*color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def vignette(im: Image.Image, strength=0.55) -> Image.Image:
    w, h = im.size
    overlay = Image.new("L", (w, h), 0)
    g = ImageDraw.Draw(overlay)
    g.ellipse((-int(w * 0.12), -int(h * 0.18), int(w * 1.12), int(h * 1.18)), fill=255)
    overlay = overlay.filter(ImageFilter.GaussianBlur(110))
    dark = Image.new("RGB", (w, h), BLACK)
    inv = Image.eval(overlay, lambda p: int(255 - (255 - p) * strength))
    return Image.composite(im, dark, inv)


def film_grain(im: Image.Image, amount=0.035) -> Image.Image:
    arr = np.array(im).astype(np.float32)
    rng = np.random.default_rng(21)
    noise = rng.normal(0, 18, arr.shape[:2]).astype(np.float32)
    arr += noise[..., None] * amount * 12
    np.clip(arr, 0, 255, out=arr)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def main() -> None:
    bg = cover(Image.open(BG).convert("RGB"), (W, H))
    bg = ImageEnhance.Color(bg).enhance(1.05)
    bg = ImageEnhance.Contrast(bg).enhance(1.08)
    bg = ImageEnhance.Brightness(bg).enhance(0.82)
    bg = vignette(bg, 0.62)
    bg = film_grain(bg)

    canvas = bg.convert("RGBA")

    seal_d = 600
    seal = circular_seal(Image.open(SEAL), seal_d)

    title_font = ImageFont.truetype(str(FONTS / "PlayfairDisplay-Bold.ttf"), 184)
    sub_font = ImageFont.truetype(str(FONTS / "NotoSans-Medium.ttf"), 42)

    title = "Noa Studio"
    subtitle = "AI Artist Noa"
    title_tracking = 16
    sub_tracking = 10

    title_w = tracked_width(title_font, title, title_tracking)
    sub_w = tracked_width(sub_font, subtitle, sub_tracking)
    title_bbox = title_font.getbbox("Hg")
    title_h = title_bbox[3] - title_bbox[1]
    sub_bbox = sub_font.getbbox("Hg")
    sub_h = sub_bbox[3] - sub_bbox[1]

    gap_seal_title = 36
    gap_title_rule = 30
    rule_h = 2
    gap_rule_sub = 26
    stack = seal_d + gap_seal_title + title_h + gap_title_rule + rule_h + gap_rule_sub + sub_h
    top = int((H - stack) / 2) - 12  # optical lift
    cx = W / 2

    seal_y = top
    title_y = seal_y + seal_d + gap_seal_title
    rule_y = title_y + title_h + gap_title_rule
    sub_y = rule_y + rule_h + gap_rule_sub

    # Glow sits behind the seal, on the cinematic hotspot
    seal_cx, seal_cy = cx, seal_y + seal_d / 2
    glow = gold_glow((W, H), (seal_cx, seal_cy), radius=seal_d * 0.62, alpha=70, blur=90)
    canvas = Image.alpha_composite(canvas, glow)

    seal_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    seal_x = int(cx - seal_d / 2)
    seal_layer.paste(seal, (seal_x, int(seal_y)), seal)
    canvas = Image.alpha_composite(canvas, seal_layer)

    type_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(type_layer)

    # Soft shadow under the lockup so ivory stays readable on the gold bloom
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (cx - 520, title_y - 18, cx + 520, sub_y + sub_h + 36),
        radius=40,
        fill=(11, 11, 12, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.alpha_composite(canvas, shadow)

    draw_tracked(
        d,
        (cx - title_w / 2, title_y),
        title,
        title_font,
        (*IVORY, 255),
        title_tracking,
    )

    rule_w = 168
    d.rectangle(
        (cx - rule_w / 2, rule_y, cx + rule_w / 2, rule_y + rule_h),
        fill=(*GOLD, 230),
    )

    draw_tracked(
        d,
        (cx - sub_w / 2, sub_y),
        subtitle,
        sub_font,
        (*GOLD, 255),
        sub_tracking,
    )

    canvas = Image.alpha_composite(canvas, type_layer)
    out = canvas.convert("RGB").resize((1200, 630), Image.Resampling.LANCZOS)
    RAW_PNG.parent.mkdir(parents=True, exist_ok=True)
    out.save(RAW_PNG, "PNG")
    print("raw", out.size, "title_w", round(title_w / 2), "frac", round((title_w / 2) / 1200, 3))
    print("stack_top", top / 2, "seal", seal_d / 2, "title_y", title_y / 2, "sub_y", sub_y / 2)


if __name__ == "__main__":
    main()
