# 元画像の背景を透明にして、人物を1人ずつ切り出す（public/img/people/ に出力する元のスクリプト）。
# 必要: numpy, scipy, Pillow。使い方: GROUND_BAND=24 python3 -I scripts/extract-people.py <元画像> <出力先>
"""人物イラスト(6列x4行)を1人ずつ切り出し、背景を透明にして webp で保存する（改良版）。
 - 背景: セルの外周から「背景色に近い」ピクセルをたどって塗りつぶし(flood fill)、そこだけを透明にする
   → 白い服・白い日傘のように背景と近い色でも、内側は残る
 - 影: 背景から続く「背景より暗い・色味の少ない」領域を、半透明の黒に置き換える(どの背景色の上でも自然)
使い方: python3 -I extract2.py <元画像> <出力ディレクトリ>"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.float32)
H, W, _ = a.shape
bg = np.median(a.reshape(-1, 3), axis=0)
bg_lum = float(bg.mean())
print("bg", bg)

NAMES = [
    "hat-bag", "backpack", "bugnet", "umbrella", "surfboard", "couple",
    "swimring", "hiking-kid", "bicycle", "runner", "dog", "suitcase",
    "family", "fishing", "reading", "tent", "hiker", "yoga",
    "skate", "camera", "sunflower", "scooter", "bike-walk", "autumn",
]
GROUND_BAND = int(os.environ.get('GROUND_BAND', '24'))
cols, rows = 6, 4
cw, ch = W // cols, H // rows
manifest = []

for r in range(rows):
    for c in range(cols):
        idx = r * cols + c
        cell = a[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
        d = np.sqrt(((cell - bg) ** 2).sum(axis=2))
        lum = cell.mean(axis=2)
        chroma = cell.max(axis=2) - cell.min(axis=2)

        # 1) 背景: ほぼ背景色の画素のうち、セルの外周とつながっているもの
        near_bg = d < 7.5
        lab, n = ndi.label(near_bg)
        border = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
        border = border[border > 0]
        bgmask = np.isin(lab, border)

        # 2) 影: 背景よりやや暗く、色味の少ない画素のうち、背景領域につながっているもの
        shadow_cand = (lum < bg_lum - 4) & (lum > bg_lum * 0.55) & (chroma < 26) & (d < 70)
        # 足元(最も下にある暗い画素=靴・車輪など)より少し上から下を「地面」とみなし、
        # 背景から続く白っぽい照り返しも消す。人物の白い服は足元より上にあるので残る。
        dark = lum < 120
        rows_dark = np.where(dark.sum(axis=1) >= 2)[0]
        y_feet = int(rows_dark.max()) if len(rows_dark) else ch
        yy = np.arange(ch)[:, None] * np.ones((1, cw))
        ground = yy >= (y_feet - GROUND_BAND)
        highlight_cand = ground & (lum >= bg_lum - 4) & (chroma < 30) & (d < 60)
        cand = bgmask | shadow_cand | highlight_cand
        lab2, n2 = ndi.label(cand)
        touch = np.unique(lab2[bgmask])
        touch = touch[touch > 0]
        region = np.isin(lab2, touch)
        shadow = region & ~bgmask

        fg = ~region  # 人物（背景・影ではない部分）。白い服の内側も含む
        # ごく小さい点（ゴミ）を除く
        labf, nf = ndi.label(fg)
        if nf:
            sizes = ndi.sum(fg, labf, range(1, nf + 1))
            keep = [i + 1 for i, s in enumerate(sizes) if s >= 40]
            fg = np.isin(labf, keep)

        # 3) 縁のミント色のにじみを減らす: 1px 内側に縮めてから、少しぼかして滑らかに
        fg_er = ndi.binary_erosion(fg, iterations=1)
        alpha_fg = ndi.gaussian_filter(fg_er.astype(np.float32), 0.7)
        alpha_fg = np.clip(alpha_fg * 1.15, 0, 1)

        # 4) 影は黒の半透明（暗いほど濃く）
        sh_a = np.clip((bg_lum - lum) / bg_lum * 1.7, 0, 0.42) * shadow
        sh_a = ndi.gaussian_filter(sh_a, 0.8)

        alpha = np.maximum(alpha_fg, sh_a)
        rgb = np.where(alpha_fg[..., None] >= 0.5, cell, 0.0)  # 影の部分は黒
        # 人物の縁の色は、内側の色を少し広げて埋める(明るい縁を避ける)
        inner = ndi.binary_erosion(fg_er, iterations=1)
        idx_nearest = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
        filled = cell[idx_nearest[0], idx_nearest[1]]
        edge = (alpha_fg > 0) & (~inner)
        rgb = np.where(edge[..., None], filled, rgb)
        rgb = np.clip(rgb, 0, 255)

        ys, xs = np.where(alpha > 0.06)
        if len(ys) == 0:
            continue
        pad = 3
        y0, y1 = max(0, ys.min() - pad), min(ch, ys.max() + 1 + pad)
        x0, x1 = max(0, xs.min() - pad), min(cw, xs.max() + 1 + pad)
        rgba = np.dstack([rgb, alpha * 255])[y0:y1, x0:x1].astype(np.uint8)
        img = Image.fromarray(rgba, "RGBA")
        name = f"{idx + 1:02d}-{NAMES[idx]}"
        img.save(os.path.join(out, name + ".webp"), "WEBP", quality=90, alpha_quality=92, method=6)
        img.save(os.path.join(out, name + ".png"))
        manifest.append({"id": idx + 1, "name": NAMES[idx], "file": name + ".webp", "w": img.width, "h": img.height})
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), ensure_ascii=False, indent=1)
print(len(manifest), "figures")
