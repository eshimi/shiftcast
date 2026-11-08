# 気圧ノート
スマホ向けPWA + Node.js(22.13+)サーバー。`npm install && npm start` → http://localhost:3000
APIキー未設定ならデモデータで動作。詳細は `.env.example` 参照。
- 気象: OpenWeatherMap(3時間毎バッチ) / 気象庁アメダス実況(最寄り観測所の海面気圧)
- 医薬品: `npm run import:drugs -- <厚労省CSVのパス/URL>`（同梱は動作確認用サンプル）
- バッチ: `npm run batch:weather|jma|alert|stats`（既定は内蔵スケジューラ）
- テスト: `npm test`
