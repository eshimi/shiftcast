# QRO Eyewear — Brand Book

## Content fundamentals

- Voice: calm, confident, personal. The brand speaks about the wearer, not the product.
- Core message: 「まとうたび、自分らしく。もっと自分を好きになれる。」 (Every time you wear them, more you. You come to like yourself more.)
- Core idea: 「じぶん色の黒」 — a black that is your own colour.
- Use short Japanese sentences. Keep English to product codes and the wordmark "QRO".
- Avoid exclamation marks, discount-style shouting, and superlatives.

## Visual foundations

- Colour is monochrome. The product is black; the interface stays black, white and grey so the frames are the only colour on the page.
- Black is a deep, slightly warm "urushi" black. Use `brand-black` for the logo and primary actions.
- Layout: generous whitespace, one column of product imagery per block, hairline dividers (`border`).
- Shape: square corners (`radius-none`). Only text inputs use `radius-sm`.
- Imagery: product on a plain light or dark ground, shot at the same angle, with light showing the gloss and matte finishes. Avoid busy backgrounds and filters.
- Motion: slow, minimal fades only. No bounce.

## Typography

- Japanese text: Noto Sans JP. Latin text and numerals: Inter.
- Headings use weight 700; body uses 400; labels use 500.
- Body is 15px / 24px. Do not go below 12px for any text.
- Use `ink` for headings and `ink-muted` for secondary copy. Both pass 4.5:1 on their grounds in both themes.

## Components and states

- Primary button: `brand-black` fill, `on-brand` text. Hover: a 10% lift toward `ink-muted`.
- Outlined button: `border-strong` outline, `ink` text.
- Focus: a 2px `focus` ring with a 2px offset on every interactive element. Never remove it.
- Product card: image, then name in `subheading`, then price in `body`. No borders around cards; use spacing.
- Text inputs: `surface-300` fill in light, `border-strong` outline, `radius-sm`.

## Usage rules

- Do not introduce a second brand colour without a new decision from the brand team.
- Do not place text on photographs without a solid `surface-100` or `brand-black` panel behind it.
- Colour must never be the only signal. Pair colour states with text or an icon.

## Source and status

This system was built from public coverage of the QRO label (black eyewear from 眼鏡市場, launched February 2026) and the campaign tagline. The meganeichiba.jp/qroeyewear page could not be fetched, so exact hex values from that page are not confirmed. Check the palette against the live page before publishing it externally.
