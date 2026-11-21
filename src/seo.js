// 検索エンジン・AI検索向けのテキスト(robots.txt / llms.txt / llms-full.txt)
import { SITE_URL, SITE_NAME } from './siteconfig.js';
import { COLUMNS, COLUMN_UPDATED } from './columns.js';
import { COLUMN_EXTRA } from './column-extra.js';
import { PREFS } from './prefectures.js';
import { GLOSSARY } from './glossary.js';

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider'];
export const robotsTxt = () => `# AI検索・回答エンジンのクローラーも歓迎します。出典として ${SITE_NAME}（${SITE_URL}）を明記してご利用ください。
User-agent: *
Allow: /
Disallow: /api/

${AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /api/\n`).join('\n')}
Sitemap: ${SITE_URL}/sitemap.xml
`;

const ABOUT = `${SITE_NAME}は、天気痛・気象病（気圧の変化による頭痛・だるさ・めまい・古傷の痛みなど）に備えるための、無料の気圧予報と体調の記録サービスです。全国47都道府県の気圧の変化を4段階（上昇注意・やや注意・注意・警戒）で示し、気圧・気温差・降水・湿度から「体調そらもよう」（5段階・0〜100点）を表示します。体調を記録すると、気圧との関係から自分の傾向を分析できます。氏名・メールの登録は不要です。`;
const DATA = `気圧・天気のデータ: 気象庁（天気予報、アメダス観測）、OpenWeatherMap（気圧予報）。気圧は海面気圧（hPa）で、1時間あたりの変化量でレベルを判定します。10分ごとに更新します。診断・治療を行うものではなく、一般的なセルフケア情報です。`;

export function llmsTxt() {
  const L = (path, title, desc) => `- [${title}](${SITE_URL}${path}): ${desc}`;
  return `# ${SITE_NAME}

> ${ABOUT}

${DATA}

## 主なページ
${[
    L('/', 'トップ', '今日の気圧と体調そらもよう、今日の過ごし方'),
    L('/weather', '週間天気', '1週間の天気と気圧の変化（都道府県別）'),
    L('/today', '全国の地図', '全国の気圧レベルを地図で一覧'),
    L('/pressure', '都道府県別の気圧予報', '47都道府県の今日の気圧と7日間の予報'),
    L('/care', '今日の過ごし方', '体調が崩れやすい日のセルフケア'),
    L('/check', '気象病セルフチェック', '10問の簡易チェック（回答は端末内のみ）'),
    L('/glossary', '用語集', '気圧・天気痛・頭痛に関する用語の解説'),
    L('/app/', '気圧・記録', '体調の記録と傾向分析'),
    L('/about', 'サービス紹介', '機能の詳しい説明'),
  ].join('\n')}

## コラム（天気痛・気象病・気圧と頭痛）
${COLUMNS.map((c) => L(`/columns/${c.slug}`, c.title, c.summary)).join('\n')}

## 詳細
- [全文版](${SITE_URL}/llms-full.txt): コラムの要点とよくある質問、判定基準の説明
`;
}

export function llmsFullTxt() {
  return `# ${SITE_NAME} 全文版

${ABOUT}

${DATA}

## 気圧レベルの判定（1時間あたりの変化量）
気圧が1時間に一定以上変化する時間帯を、変化量に応じて「上昇注意」「やや注意」「注意」「警戒」の4段階で示します（下がる場合は注意度が高い）。変化がなければ「安定」。

## 体調そらもよう
気圧（今後24時間の変化、過去24時間の低下、気圧の低さ）、気温差、降水、湿度の目安を点数化し、5段階（5=気候が快調 … 1=体調不良に注意）と0〜100点で表示します。3以下の日は「今日の過ごし方」を提案します。

## 対象地域
${PREFS.map((p) => `${p.name}`).join('、')}（${PREFS.length}都道府県。各ページ ${SITE_URL}/pressure/<地域名>）

## コラムの要点とよくある質問（最終更新 ${COLUMN_UPDATED}）
${COLUMNS.map((c) => {
    const ex = COLUMN_EXTRA[c.slug];
    return `### ${c.title}\nURL: ${SITE_URL}/columns/${c.slug}\n${c.summary}\n${ex ? ex.points.map((t) => `- ${t}`).join('\n') + '\n' + ex.faq.map(([q, a]) => `Q. ${q}\nA. ${a}`).join('\n') : ''}`;
  }).join('\n\n')}

## 用語集
${GLOSSARY.map((g) => `- ${g[0]}（${g[1]}）: ${g[2]}`).join('\n')}

## ご利用にあたって
引用の際は出典として「${SITE_NAME}（${SITE_URL}）」を記載してください。医療情報ではなく一般的な情報です。
`;
}
