// 人物イラスト24点（public/img/people/）。scripts/extract-people.py で元画像から切り出したもの。w/h は画像の実寸(px)。
// 使い方は pages.js の person()。表示は明るい背景の上に mix-blend-mode: multiply で重ねる（site.css の .ppl）。
export const PEOPLE = [
  { name: 'hat-bag', file: '01-hat-bag.webp', w: 163, h: 159 },
  { name: 'backpack', file: '02-backpack.webp', w: 163, h: 168 },
  { name: 'bugnet', file: '03-bugnet.webp', w: 159, h: 146 },
  { name: 'umbrella', file: '04-umbrella.webp', w: 148, h: 169 },
  { name: 'surfboard', file: '05-surfboard.webp', w: 203, h: 162 },
  { name: 'couple', file: '06-couple.webp', w: 169, h: 152 },
  { name: 'swimring', file: '07-swimring.webp', w: 137, h: 133 },
  { name: 'hiking-kid', file: '08-hiking-kid.webp', w: 178, h: 160 },
  { name: 'bicycle', file: '09-bicycle.webp', w: 171, h: 146 },
  { name: 'runner', file: '10-runner.webp', w: 146, h: 145 },
  { name: 'dog', file: '11-dog.webp', w: 176, h: 149 },
  { name: 'suitcase', file: '12-suitcase.webp', w: 162, h: 159 },
  { name: 'family', file: '13-family.webp', w: 198, h: 158 },
  { name: 'fishing', file: '14-fishing.webp', w: 164, h: 183 },
  { name: 'reading', file: '15-reading.webp', w: 176, h: 123 },
  { name: 'tent', file: '16-tent.webp', w: 231, h: 122 },
  { name: 'hiker', file: '17-hiker.webp', w: 151, h: 160 },
  { name: 'yoga', file: '18-yoga.webp', w: 174, h: 174 },
  { name: 'skate', file: '19-skate.webp', w: 156, h: 150 },
  { name: 'camera', file: '20-camera.webp', w: 153, h: 166 },
  { name: 'sunflower', file: '21-sunflower.webp', w: 160, h: 164 },
  { name: 'scooter', file: '22-scooter.webp', w: 169, h: 141 },
  { name: 'bike-walk', file: '23-bike-walk.webp', w: 173, h: 150 },
  { name: 'autumn', file: '24-autumn.webp', w: 192, h: 166 },
];
export const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.name, p]));
