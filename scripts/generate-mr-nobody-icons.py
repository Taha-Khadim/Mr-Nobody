#!/usr/bin/env python3
"""Generate Mr Nobody app icons — abstract faceless void motif (original artwork)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SIZE = 1024


def radial_gradient_bg(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    cx = cy = size // 2
    r_max = (size**2 + size**2) ** 0.5 / 2
    pixels = img.load()
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            t = min(1.0, (dx * dx + dy * dy) ** 0.5 / r_max)
            r = int(18 + t * 28)
            g = int(10 + t * 18)
            b = int(35 + t * 35)
            pixels[x, y] = (r, g, b)
    return img


def draw_icon() -> Image.Image:
    base = radial_gradient_bg(SIZE)
    draw = ImageDraw.Draw(base)
    cx, cy = SIZE // 2, SIZE // 2 + 24

    # Ethereal rings
    for i in range(6):
        r = 300 + i * 28
        a = 90 - i * 14
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(139, 92, 246),
            width=3,
        )

    # Silhouette
    draw.ellipse([cx - 210, cy - 270, cx + 210, cy + 195], fill=(32, 28, 58))
    # Void eyes
    draw.ellipse([cx - 92, cy - 118, cx - 42, cy - 68], fill=(10, 8, 18))
    draw.ellipse([cx + 42, cy - 118, cx + 92, cy - 68], fill=(10, 8, 18))
    # Point of light
    draw.ellipse([cx - 9, cy + 38, cx + 9, cy + 56], fill=(196, 181, 253))

    return base


def draw_adaptive_foreground() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, SIZE // 2 + 8

    draw.ellipse(
        [cx - 290, cy - 290, cx + 290, cy + 290],
        outline=(167, 139, 250, 255),
        width=22,
    )
    draw.ellipse([cx - 200, cy - 250, cx + 200, cy + 175], fill=(48, 42, 88, 255))
    draw.ellipse([cx - 85, cy - 112, cx - 40, cy - 67], fill=(14, 11, 24, 255))
    draw.ellipse([cx + 40, cy - 112, cx + 85, cy - 67], fill=(14, 11, 24, 255))
    draw.ellipse([cx - 8, cy + 36, cx + 8, cy + 52], fill=(214, 200, 255, 255))
    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    draw_icon().save(ASSETS / "icon.png", "PNG")
    draw_adaptive_foreground().save(ASSETS / "adaptive-icon.png", "PNG")

    splash = radial_gradient_bg(SIZE)
    sd = ImageDraw.Draw(splash)
    scx, scy = SIZE // 2, SIZE // 2
    sd.ellipse([scx - 140, scy - 140, scx + 140, scy + 140], outline=(139, 92, 246), width=10)
    splash.save(ASSETS / "splash-icon.png", "PNG")

    draw_icon().resize((48, 48), Image.Resampling.LANCZOS).save(ASSETS / "favicon.png", "PNG")

    print("OK:", ASSETS)


if __name__ == "__main__":
    main()
