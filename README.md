# shiftcast（気圧ノート）
気圧の変化と体調を記録して気象病を予防する、スマホ向けPWA。Cloudflare Workers + D1 で動作します。

- 気象: OpenWeatherMap（3時間毎）/ 気象庁アメダス実況（最寄り観測所の海面気圧）
- 通知: Firebase Cloud Messaging（翌日に「注意」以上の気圧低下があるとき、毎晩20時JST）
- 医薬品サジェスト: 厚労省データ等のCSVをD1に取り込み（同梱は動作確認用サンプル）

## ローカル開発
```bash
npm install
npm run db:migrate:local
npm run dev        # http://localhost:8787 （APIキー無しはデモデータ）
npm test
```
Cronの動作確認: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/10+*+*+*+*"`

## デプロイ（GitHub Actions → Cloudflare）
`main` へのpushで `.github/workflows/deploy.yml` が D1作成 → マイグレーション → デプロイ → Secrets反映 を実行します。
リポジトリの **Settings → Secrets and variables → Actions** に登録:

| Secret | 必須 | 内容 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ✅ | 権限: Workers Scripts:Edit, D1:Edit（"Edit Cloudflare Workers"テンプレート + D1） |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | CloudflareアカウントID |
| `OPENWEATHER_API_KEY` | 推奨 | 未設定の間はデモデータ表示 |
| `FIREBASE_SERVICE_ACCOUNT` | 任意 | サービスアカウントJSON（未設定ならプッシュは送信せずログのみ） |
| `FIREBASE_WEB_CONFIG` | 任意 | FirebaseのWebアプリ設定JSON（1行） |
| `FIREBASE_VAPID_KEY` | 任意 | Web Pushの公開鍵 |

設定値は `wrangler.jsonc` の `vars`（ALERT_HOUR / WEATHER_INTERVAL_H / MIN_K / EXTRA_AREAS / ALL_AREAS）で変更できます。
無料プランはサブリクエストが1回の実行で50までのため、`ALL_AREAS=1` は有料プラン向けです。

## 医薬品データの差し替え
```bash
node scripts/import-drugs.js <CSVのパスまたはURL>      # data/drugs_import.sql を生成（Shift_JIS対応・列名は自動推定）
npx wrangler d1 execute DB --remote --file data/drugs_import.sql
```

## 免責
本データは海面気圧の変動傾向を示す目安であり、絶対値の保証や医学的な診断を提供するものではありません。

最終更新: Workers Builds（D1マイグレーション込み）での自動デプロイを確認。

Workers Builds 連携の再確認（2026-11-08）。

ビルド再試行の確認（17:31）。

## HERO（React / Tailwind / shadcn）
ダッシュボード上部のHEROは `hero/`（Vite + React + TypeScript + Tailwind、shadcn構成）で作り、
ビルド済みの `public/hero/hero.js|css` を素のJSアプリに差し込んでいます（ビルド成果物はコミット済みなので、デプロイ時のビルド設定変更は不要）。
編集したら `npm run build:hero` で再生成してください。モックアップの画像は `public/hero/shots/` のアプリ実画面です。

## ページ構成
| URL | 内容 |
|---|---|
| `/` | トップページ（HERO・今日の気圧・今週の天気と気圧・コラム・はじめかた） |
| `/weather` | 週間天気（気象庁の週間予報 + 気圧の日別アラート + これからの3時間ごと） |
| `/columns`, `/columns/:slug` | コラム「気象病を防ぐ方法」（本文は `src/columns.js`） |
| `/app/` | 気圧グラフ・体調記録・分析・設定のアプリ本体（PWAの起点） |

トップ/週間天気/コラムは Worker がサーバー側で描画します（`src/pages.js`）。データは公開API `/api/week?area=<都道府県コード>`（5分キャッシュ）から取得します。
