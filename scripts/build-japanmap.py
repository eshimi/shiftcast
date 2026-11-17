# 都道府県の境界(国土数値情報由来の公開データ)から、日本地図のドット(点描)地図のデータ src/japanmap.js を作る。
# 使い方: python3 -I scripts/build-japanmap.py <prefectures.json> > src/japanmap.js
#   prefectures.json: https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/prefectures.json
# 必要: Pillow。沖縄は、本土の右下(太平洋側)に移して並べる。小笠原は除く。
import json, math, sys
from PIL import Image, ImageDraw

NAMES = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']
d = json.load(open(sys.argv[1]))
LON0, LON1, LAT0, LAT1 = 122.7, 146.2, 28.3, 45.8
PITCH = 0.30                      # 点の間隔(度)
COS = math.cos(math.radians(37))
S = 40                            # 描画の解像度(1度あたりのピクセル)
W = int((LON1 - LON0) * COS * S) + 2; H = int((LAT1 - LAT0) * S) + 2
img = Image.new('P', (W, H), 0); dr = ImageDraw.Draw(img)
def px(lon, lat): return ((lon - LON0) * COS * S, (LAT1 - lat) * S)
for fi, f in enumerate(d['features']):
    name = f['properties']['N03_001']; code = NAMES.index(name) + 1
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        ring = poly[0]
        cy = sum(p[1] for p in ring) / len(ring); cx = sum(p[0] for p in ring) / len(ring)
        if name == '東京都' and cy < 32: continue            # 小笠原は除く
        dl = dp = 0
        if name == '沖縄県': dl, dp = 11.0, 5.0                 # 沖縄は、右下に移す
        dr.polygon([px(x + dl, y + dp) for x, y in ring], fill=code)
dots = []
nlon = int((LON1 - LON0) / PITCH); nlat = int((LAT1 - LAT0) / PITCH / 1.0)
step_y = PITCH
cols = int((LON1 - LON0) * COS / (PITCH * COS)); rows = int((LAT1 - LAT0) / PITCH)
for r in range(rows):
    for c in range(cols):
        lon = LON0 + (c + 0.5) * PITCH; lat = LAT1 - (r + 0.5) * PITCH
        x0, y0 = px(lon - PITCH / 2, lat + PITCH / 2); x1, y1 = px(lon + PITCH / 2, lat - PITCH / 2)
        box = img.crop((int(x0), int(y0), max(int(x0) + 1, int(x1)), max(int(y0) + 1, int(y1))))
        cnt = {}
        for v in box.getdata():
            if v: cnt[v] = cnt.get(v, 0) + 1
        tot = box.size[0] * box.size[1]
        if cnt:
            v, n = max(cnt.items(), key=lambda t: t[1])
            if n / tot >= 0.28: dots.append([c, r, v])
print('// 日本地図のドット(点描)データ: [列, 行, 都道府県コード]。scripts/build-japanmap.py で生成。手で編集しない。')
print('export const MAP_COLS = %d;' % cols); print('export const MAP_ROWS = %d;' % rows)
print('export const MAP_DOTS = ' + json.dumps(dots, separators=(',', ':')) + ';')
