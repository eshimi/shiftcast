import sys
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
bgim = Image.new('RGBA', im.size, (255,255,255,255)); bgim.alpha_composite(im)
rgb = np.array(bgim.convert('RGB')).astype(float)
Y = 540; sub = rgb[:Y]; W = sub.shape[1]
nonwhite = sub.min(axis=2) < 238
lab, n = ndi.label(ndi.binary_dilation(nonwhite, iterations=3))
bounds = [0, 432, 800, 1170, 1555, 2000]
groups = [[] for _ in range(5)]
for i, sl in enumerate(ndi.find_objects(lab), 1):
    area = (lab[sl] == i).sum()
    if area < 150: continue
    cx = (sl[1].start + sl[1].stop) / 2
    groups[max(0, min(4, np.searchsorted(bounds, cx) - 1))].append(i)

LEVEL = {2: (143,185,214), 3: (214,176,86), 4: (232,134,72), 5: (214,84,76)}  # 段階の色(体の塗りのもと)
NAVY = np.array([27, 58, 107.])

def tint(c, k=0.45):  # 淡い塗り色
    c = np.array(c, float); return c * (1 - k) + 255 * k

crops = {}
for k, g in enumerate(groups, 1):
    m = np.isin(lab, g)
    ys, xs = np.where(m); pad = 8
    y0, y1, x0, x1 = max(0, ys.min()-pad), min(Y, ys.max()+1+pad), max(0, xs.min()-pad), min(W, xs.max()+1+pad)
    crop = sub[y0:y1, x0:x1]; cm0 = ndi.binary_dilation(m[y0:y1, x0:x1], iterations=2)
    cm = ndi.binary_fill_holes(ndi.binary_closing(cm0, structure=np.ones((3, 3)), iterations=10)) | cm0   # この子の内側(白い部分)も含める
    white = crop.min(axis=2) >= 238
    free = white & ~ndi.binary_dilation(~white, iterations=9)    # 線のすき間(16px未満)をふさぐ
    l2, _ = ndi.label(free)
    border = set(np.unique(np.concatenate([l2[0], l2[-1], l2[:, 0], l2[:, -1]]))) - {0}
    outside = ndi.binary_dilation(np.isin(l2, list(border)), iterations=9) & white
    other = ndi.binary_dilation(np.isin(lab, [i for gg in groups for i in gg if i not in g])[y0:y1, x0:x1], iterations=3)
    cm = ~other   # 隣の子のぶんは含めない
    alpha = ndi.gaussian_filter((~outside & cm).astype(float), 0.7)
    lbl, nl = ndi.label(alpha > 0.3)
    if nl:
        sizes = ndi.sum(np.ones_like(lbl), lbl, index=np.arange(1, nl + 1))
        keep = np.isin(lbl, [i + 1 for i, z in enumerate(sizes) if z >= 600])
        alpha = alpha * ndi.binary_dilation(keep, iterations=2)
    crops[k] = (crop, alpha)

def save(rgb_img, alpha, path):
    a = np.dstack([rgb_img, alpha * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(a, 'RGBA').save(path, lossless=True) if path.endswith('webp') else Image.fromarray(a, 'RGBA').save(path)

def colorize(crop, alpha, level):
    L = crop.mean(axis=2)
    dark = L < 150
    body_region = ndi.binary_fill_holes(ndi.binary_closing(dark, structure=np.ones((3, 3)), iterations=11)) & (alpha > 0.3)
    body_region = body_region | ((alpha > 0.3) & (L >= 222) & ~ndi.binary_dilation(dark, iterations=0))   # 外から切り離した白(体の内側)も体に含める
    mid = body_region & (L >= 170) & (L < 226)
    mid = ndi.binary_opening(mid, structure=np.ones((7, 7)))
    cl, nn = ndi.label(mid)
    cheek = np.zeros_like(mid)
    for i, sl in enumerate(ndi.find_objects(cl), 1):
        a = (cl[sl] == i).sum(); hh = sl[0].stop - sl[0].start; ww = sl[1].stop - sl[1].start
        if 250 < a < 6000 and max(ww / hh, hh / ww) < 2.6: cheek |= (cl == i)
    cheek = ndi.binary_dilation(cheek, iterations=3) & body_region & (L >= 160)
    body = tint(LEVEL[level], 0.5); pink = np.array([246, 168, 170.])
    shade = np.clip(0.86 + 0.14 * (L - 200) / 46.0, 0.86, 1.0)[..., None]   # 体のごく淡い陰影
    base = body * shade
    base[cheek] = pink
    # 線: 体の中の灰色の線・体の外の灰色の線(動きの線・汗・記号)を紺に。ほっぺは線にしない
    shadow_c = (~body_region) & (L >= 205) & (alpha > 0.05)
    shadow_c = ndi.binary_opening(shadow_c, structure=np.ones((9, 9)))   # 細い線は影にしない(広い影だけ)
    w = np.clip((228 - L) / (228 - 125), 0, 1)
    w[cheek] = 0
    w[shadow_c] = 0
    outc = w[..., None] * NAVY + (1 - w[..., None]) * base
    sc = np.array(LEVEL[level], float)
    outc[shadow_c] = sc
    a2 = alpha.copy()
    a2[shadow_c] = np.clip((246 - L[shadow_c]) / 40, 0, 1) * 0.6 * alpha[shadow_c]
    # 体の外のうす色(線のまわりのにじみ)は、色を紺にして、薄いところは透明に
    outer = (~body_region) & (~shadow_c)
    outc[outer] = NAVY
    a2[outer] = alpha[outer] * np.clip((236 - L[outer]) / (236 - 130), 0, 1)
    # 残った灰色の線(動きの線など)も紺に
    sat = crop.max(axis=2) - crop.min(axis=2)
    grey = (sat < 16) & (L < 200) & (~cheek) & (~shadow_c)
    gw = np.clip((205 - L) / 75, 0, 1)[..., None]
    outc = np.where(grey[..., None], gw * NAVY + (1 - gw) * outc, outc)
    return outc, a2

import os
os.makedirs(out, exist_ok=True)
for k, (crop, alpha) in crops.items():
    if k == 1:
        save(crop, alpha, f'{out}/mood-1-on.png')
    else:
        save(crop, alpha, f'{out}/mood-{k}-off.png')
        c, a2 = colorize(crop, alpha, k)
        save(c, a2, f'{out}/mood-{k}-on.png')
print(sorted(os.listdir(out)))
