// 都道府県別ページ(/pressure/:slug)用の補助データ。slug はローマ字表記、地方区分、近隣の都道府県(座標が近い順)。
import { AREAS } from './areas.js';

const SLUGS = ['hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima', 'ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa', 'niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano', 'gifu', 'shizuoka', 'aichi', 'mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama', 'tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi', 'tokushima', 'kagawa', 'ehime', 'kochi', 'fukuoka', 'saga', 'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa'];

export const PREFS = AREAS.map((a, i) => ({ ...a, slug: SLUGS[i] }));
const BY_SLUG = new Map(PREFS.map((p) => [p.slug, p]));
export const prefBySlug = (s) => BY_SLUG.get(s) ?? null;

export const REGIONS = [
  ['北海道', ['01']],
  ['東北', ['02', '03', '04', '05', '06', '07']],
  ['関東', ['08', '09', '10', '11', '12', '13', '14']],
  ['中部', ['15', '16', '17', '18', '19', '20', '21', '22', '23']],
  ['近畿', ['24', '25', '26', '27', '28', '29', '30']],
  ['中国', ['31', '32', '33', '34', '35']],
  ['四国', ['36', '37', '38', '39']],
  ['九州・沖縄', ['40', '41', '42', '43', '44', '45', '46', '47']],
];
export const regionOf = (code) => REGIONS.find(([, cs]) => cs.includes(code))?.[0] ?? '';

const dist = (a, b) => (a.lat - b.lat) ** 2 + ((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) ** 2;
export const neighbors = (p, n = 5) =>
  PREFS.filter((q) => q.code !== p.code)
    .sort((a, b) => dist(p, a) - dist(p, b))
    .slice(0, n);
