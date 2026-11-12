import sys
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); a = np.array(im).astype(float) / 255
H, W, _ = a.shape
mx = a.max(axis=2); mn = a.min(axis=2); s = (mx - mn) / np.maximum(mx, 1e-6); v = mx
ink = v < 0.45
vivid = (s > 0.42) & (v > 0.55)
lab, n = ndi.label(vivid)
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
small_vivid = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z <= 6000])
# 各子の範囲 (x0,x1,y0,y1): ステップ(段)より上だけを使う
BOX = {1: (100, 365, 372, 548), 2: (440, 705, 380, 520), 3: (770, 990, 285, 490), 4: (1055, 1300, 245, 462), 5: (1395, 1685, 195, 420)}
import os
os.makedirs(out, exist_ok=True)
for k, (x0, x1, y0, y1) in BOX.items():
    sl = (slice(y0, y1), slice(x0, x1))
    sv = small_vivid[sl].copy(); sv[-24:, :] = False   # 足もとの段の色(にじみ)は含めない
    m = ink[sl] | sv
    # 段の色(大きな色の塊)を除く。ただし子の近くの小さな色つき(光線・首輪)は残す
    lab2, n2 = ndi.label(ndi.binary_dilation(m, iterations=3))
    keep = np.zeros_like(m)
    for i, o in enumerate(ndi.find_objects(lab2), 1):
        area = (lab2[o] == i).sum()
        if area >= 60: keep |= (lab2 == i)
    m = m & keep
    # 外形: 線のすき間(10px未満)をふさいだうえで、外とつながっていない白(体の内側)を残す
    free = ~ndi.binary_dilation(m, iterations=5)
    l3, _ = ndi.label(free)
    border = set(np.unique(np.concatenate([l3[0], l3[-1], l3[:, 0], l3[:, -1]]))) - {0}
    outside = ndi.binary_dilation(np.isin(l3, list(border)), iterations=5) & ~m
    sil = ~outside
    alpha = ndi.gaussian_filter(sil.astype(float), 0.8)
    rgb = a[sl].copy()
    # 段の色が子の内側にしみこんでいる所(青・緑など高い彩度の大きな塊)は白に戻す
    inside_bad = sil & ~m & (s[sl] > 0.2)
    rgb[inside_bad] = 1.0
    # 外側(alpha=0)の画素は白
    arr = np.dstack([rgb, alpha])
    ys, xs = np.where(alpha > 0.05)
    pad = 6
    arr = arr[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
    img = Image.fromarray((arr * 255).clip(0, 255).astype(np.uint8), 'RGBA')
    img.save(f'{out}/dog-{k}.png')
    print(k, img.size)
