#!/usr/bin/env python3
"""从项目 logo 生成站点图标与分享图。

logo 源文件：assets/brand/paltrow_studio_logo_mods.png
  取自 ShotaPartner-Core 的
  src/main/resources/assets/shota_partner/textures/gui/paltrow_studio_logo_mods.png
  即 mods.toml 中 logoFile 指向的「256×256 纯图形版」，也是游戏内 Screen 水印用的那张。

用法：
    python3 scripts/make-icons.py            # 重新生成 public/ 下的全部图标
    python3 scripts/make-icons.py --check    # 只校验尺寸与不透明度，不写文件

产物：
    public/favicon.svg          主题自适应（浅色主题纸底 / 深色主题墨底），内嵌 160px 标记
    public/favicon.ico          16 / 32 / 48 多尺寸，兼容老浏览器
    public/favicon-32.png       32×32 透明底，供 sizes 声明与部分安卓浏览器
    public/apple-touch-icon.png 180×180，纸底不透明（iOS 会忽略透明通道）
    public/icon-192.png         192×192，纸底，webmanifest
    public/icon-512.png         512×512，纸底，webmanifest
    public/og-image.png         1200×630 分享图（纸底 + logo + 站名）
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'brand' / 'paltrow_studio_logo_mods.png'
PUBLIC = ROOT / 'public'

# 与 src/index.css 的主题变量保持一致
PAPER = (243, 238, 226)
SHEET = (251, 247, 237)
INK = (36, 31, 24)
LINE = (216, 205, 183)
SEAL = (166, 54, 38)

SERIF_BOLD = '/usr/share/fonts/noto-cjk/NotoSerifCJK-Bold.ttc'
SERIF_MEDIUM = '/usr/share/fonts/noto-cjk/NotoSerifCJK-Medium.ttc'
SANS = '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc'

# 标记在画布中的占比：小尺寸需要更满，否则 16px 下细节糊成一团
PAD_RATIO = {16: 0.02, 32: 0.04, 48: 0.06, 180: 0.10, 192: 0.10, 512: 0.10}


def load_mark() -> Image.Image:
    if not SRC.exists():
        sys.exit(f'缺少 logo 源文件：{SRC}')
    logo = Image.open(SRC).convert('RGBA')
    bbox = logo.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox is None:
        sys.exit('logo 全透明，无法使用')
    return logo.crop(bbox)


def place(mark: Image.Image, size: int, bg: tuple[int, int, int] | None) -> Image.Image:
    """把标记居中放进 size×size 画布；bg 为 None 时保留透明底。"""
    canvas = Image.new('RGBA', (size, size), (*bg, 255) if bg else (0, 0, 0, 0))
    pad = PAD_RATIO.get(size, 0.10)
    box = max(1, int(size * (1 - pad * 2)))
    w, h = mark.size
    scale = min(box / w, box / h)
    target = (max(1, round(w * scale)), max(1, round(h * scale)))
    resized = mark.resize(target, Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - target[0]) // 2, (size - target[1]) // 2))
    return canvas


def save_png(im: Image.Image, path: Path, palette: int | None = None) -> None:
    """写 PNG；给 palette 时转成 128 色调色板图，标记本身只有两色，肉眼无差别而体积减半。"""
    if palette:
        opaque = 'A' not in im.getbands() or im.getchannel('A').getextrema() == (255, 255)
        im = (im.convert('RGB') if opaque else im.convert('RGBA')).quantize(
            colors=palette, method=Image.FASTOCTREE
        )
    im.save(path, 'PNG', optimize=True)


def svg_icon(mark: Image.Image) -> str:
    """主题自适应 SVG：浅色浏览环境下纸底，深色环境下墨底。"""
    embedded = place(mark, 160, None).quantize(colors=128, method=Image.FASTOCTREE)
    buf = io.BytesIO()
    embedded.save(buf, 'PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="帕特罗工作室 Paltrow Studio">
  <title>伙伴物语 Partner Monogatari</title>
  <style>
    .paper {{ fill: #f3eee2; }}
    .edge {{ fill: none; stroke: #d8cdb7; stroke-width: 2; }}
    @media (prefers-color-scheme: dark) {{
      .paper {{ fill: #241f18; }}
      .edge {{ stroke: #6b5c46; }}
    }}
  </style>
  <rect class="paper" x="2" y="2" width="60" height="60" rx="14" />
  <rect class="edge" x="2" y="2" width="60" height="60" rx="14" />
  <image x="6" y="6" width="52" height="52" href="data:image/png;base64,{b64}" />
</svg>
"""


def og_image(mark: Image.Image) -> Image.Image:
    W, H = 1200, 630
    card = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(card)

    # 纸面纹理：细横线，避免纯色显得空
    for y in range(0, H, 6):
        d.line([(0, y), (W, y)], fill=(238, 232, 218))
    d.rectangle([28, 28, W - 28, H - 28], outline=LINE, width=2)
    d.rectangle([28, 28, 38, H - 28], fill=SEAL)

    tile = place(mark, 220, PAPER)
    ring = ImageDraw.Draw(tile)
    ring.rectangle([0, 0, 219, 219], outline=LINE, width=3)
    card.paste(tile, (96, 205), tile)

    title_font = ImageFont.truetype(SERIF_BOLD, 96, index=0)
    sub_font = ImageFont.truetype(SERIF_MEDIUM, 40, index=0)
    latin_font = ImageFont.truetype(SANS, 30, index=0)
    small_font = ImageFont.truetype(SANS, 26, index=0)

    text_x = 96 + 220 + 56
    d.text((text_x, 216), '伙伴物语', font=title_font, fill=INK)
    d.text((text_x, 336), 'Partner Monogatari', font=latin_font, fill=(120, 106, 84))
    d.line([(text_x, 396), (text_x + 300, 396)], fill=SEAL, width=4)
    d.text((text_x, 424), '玩法说明与问题反馈', font=sub_font, fill=INK)
    d.text((text_x, 486), 'Minecraft 1.20.1 · Forge · 27 位伙伴 · 学校维度', font=small_font, fill=(120, 106, 84))

    d.text((96, 466), 'PALTROW STUDIO', font=small_font, fill=(120, 106, 84))

    url = 'paltrow-studio.github.io/ShotaPartner-Docs'
    url_w = d.textbbox((0, 0), url, font=small_font)[2]
    d.text((W - 56 - url_w, H - 84), url, font=small_font, fill=(120, 106, 84))
    return card


def check(path: Path, expect: tuple[int, int]) -> str:
    im = Image.open(path)
    assert im.size == expect, f'{path.name} 尺寸 {im.size} != {expect}'
    return f'{path.name:24s} {im.size[0]}×{im.size[1]} {im.mode} {path.stat().st_size / 1024:.1f} KB'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只校验产物，不重新生成')
    args = ap.parse_args()

    PUBLIC.mkdir(exist_ok=True)
    mark = load_mark()
    print(f'logo 源：{SRC.relative_to(ROOT)}，裁去透明边后 {mark.size[0]}×{mark.size[1]}')

    if not args.check:
        (PUBLIC / 'favicon.svg').write_text(svg_icon(mark), encoding='utf-8')

        save_png(place(mark, 32, None), PUBLIC / 'favicon-32.png')

        # 多尺寸 ICO：48 作底图，另附 16 与 32 两档，避免浏览器自行缩放
        place(mark, 48, None).save(
            PUBLIC / 'favicon.ico',
            sizes=[(16, 16), (32, 32), (48, 48)],
            append_images=[place(mark, 16, None), place(mark, 32, None)],
        )

        save_png(place(mark, 180, PAPER), PUBLIC / 'apple-touch-icon.png', palette=128)
        save_png(place(mark, 192, PAPER), PUBLIC / 'icon-192.png', palette=128)
        save_png(place(mark, 512, PAPER), PUBLIC / 'icon-512.png', palette=128)
        save_png(og_image(mark), PUBLIC / 'og-image.png', palette=128)

        (PUBLIC / 'site.webmanifest').write_text(
            json.dumps(
                {
                    'name': '伙伴物语 Partner Monogatari · 玩法说明',
                    'short_name': '伙伴物语',
                    'start_url': './',
                    'display': 'browser',
                    'background_color': '#f3eee2',
                    'theme_color': '#f3eee2',
                    'icons': [
                        {'src': './icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                        {'src': './icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
            + '\n',
            encoding='utf-8',
        )

    rows = [
        check(PUBLIC / 'favicon-32.png', (32, 32)),
        check(PUBLIC / 'apple-touch-icon.png', (180, 180)),
        check(PUBLIC / 'icon-192.png', (192, 192)),
        check(PUBLIC / 'icon-512.png', (512, 512)),
        check(PUBLIC / 'og-image.png', (1200, 630)),
    ]
    ico = Image.open(PUBLIC / 'favicon.ico')
    rows.append(f'{"favicon.ico":24s} {sorted(ico.ico.sizes())} {(PUBLIC / "favicon.ico").stat().st_size / 1024:.1f} KB')
    svg = PUBLIC / 'favicon.svg'
    rows.append(f'{"favicon.svg":24s} {svg.stat().st_size / 1024:.1f} KB（内嵌 160px 标记）')

    # 图标不能是空的：至少 5% 的像素要有明显不透明度
    for name in ('favicon-32.png', 'favicon.ico'):
        im = Image.open(PUBLIC / name).convert('RGBA')
        opaque = sum(1 for v in im.getchannel('A').getdata() if v > 40) / (im.size[0] * im.size[1])
        assert opaque > 0.05, f'{name} 几乎全透明（{opaque:.1%}），图标内容异常'
        rows.append(f'{name:24s} 不透明像素占比 {opaque:.1%}')
    print('\n'.join(rows))
    print('图标已就绪。')


if __name__ == '__main__':
    main()
