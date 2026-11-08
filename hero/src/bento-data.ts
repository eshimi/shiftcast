import type { AnalyticsBentoProps, Tone } from "@/components/ui/analytics-bento";

/** アプリ(API)から受け取る生データ。時刻はすべて epoch ms */
export interface LogRow { id: number; ts: number; pain: number; tags: string[]; meds: string[] }
export interface ForecastInput {
  now: number;
  area: { code: string; name: string };
  points: { ts: number; pressure: number | null }[];
}
export interface BentoInput { logs: LogRow[]; forecast: ForecastInput | null; now?: number }

const H = 3600e3;
const D = 24 * H;
const JST = 9 * H;
const jst = (ts: number) => new Date(ts + JST);
const hourOf = (ts: number) => jst(ts).getUTCHours();
const dowOf = (ts: number) => jst(ts).getUTCDay();
const within = (logs: LogRow[], from: number, to: number) => logs.filter((l) => l.ts > from && l.ts <= to);
const count = (n: number) => n.toLocaleString("ja-JP");

/** 現在期間 vs 直前の同じ長さの期間 の増減率。直前が0件なら表示しない */
function change(cur: number, prev: number): string {
  if (prev <= 0) return "";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct === 0 ? "0%" : `${pct > 0 ? "" : "-"}${Math.abs(pct)}%`;
}
/** 記録(不調)が増えるのは良くないので、増加=bad / 減少=good */
const painTone = (delta: string): Tone => (delta === "" || delta === "0%" ? "neutral" : delta.startsWith("-") ? "good" : "bad");

function hourly(logs: LogRow[]): number[] {
  const a = Array(24).fill(0) as number[];
  logs.forEach((l) => a[hourOf(l.ts)]++);
  return [...a, a[0]]; // 25点(24時=0時)で1周分の波にする
}

export function buildBentoProps(input: BentoInput): AnalyticsBentoProps {
  const now = input.now ?? Date.now();
  const logs = input.logs.filter((l) => l.ts <= now);
  const w0 = within(logs, now - 7 * D, now);
  const w1 = within(logs, now - 14 * D, now - 7 * D);
  const w2 = within(logs, now - 21 * D, now - 14 * D);

  /* --- A: 気圧 --- */
  const pts = (input.forecast?.points ?? []).filter((p): p is { ts: number; pressure: number } => p.pressure != null);
  const past = pts.filter((p) => p.ts <= now);
  const cur = past.length ? past[past.length - 1] : pts[0];
  const ago3 = cur ? [...pts].reverse().find((p) => p.ts <= cur.ts - 3 * H) : undefined;
  const d3 = cur && ago3 ? cur.pressure - ago3.pressure : null;
  const fmtDT = (ts: number) => { const d = jst(ts); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}時`; };
  const series = pts.length >= 2 ? pts.map((p) => ({ label: fmtDT(p.ts), value: Math.round(p.pressure * 10) / 10 })) : [{ label: "-", value: 1013 }, { label: "-", value: 1013 }];
  const revenue: AnalyticsBentoProps["revenue"] = {
    label: `海面気圧（${input.forecast?.area.name ?? "-"}）`,
    value: cur ? Math.round(cur.pressure) : 0,
    delta: d3 == null ? "" : `${d3 < 0 ? "-" : ""}${Math.abs(d3).toFixed(1)}hPa`,
    // 3時間で4.5hPa(=1.5hPa/h)以上の低下は「警戒」相当なので赤で示す
    deltaTone: d3 != null && d3 <= -4.5 ? "bad" : "neutral",
    note: d3 == null ? "直近3時間の変化は取得中です" : "直近3時間の変化",
    caption: "hPa・過去3日〜5日先の予報",
    compact: false,
    series,
  };

  /* --- B: 時間帯別の記録 --- */
  const sessions: AnalyticsBentoProps["sessions"] = {
    label: "時間帯別の記録",
    value: w0.length,
    delta: change(w0.length, w1.length),
    deltaTone: painTone(change(w0.length, w1.length)),
    note: "直近7日・1時間ごとの件数（日本時間）",
    desktop: [hourly(w0), hourly(w1), hourly(w2)],
    mobile: [hourly(w0.filter((l) => l.meds.length)), hourly(w1.filter((l) => l.meds.length)), hourly(w2.filter((l) => l.meds.length))],
    labels: { desktop: "不調の記録", mobile: "服薬あり", prior: "前の週", current: "直近7日" },
  };

  /* --- C: 症状タグ別（平均の痛みで色分け） --- */
  const periodsDef: { label: string; from: number; prevFrom: number; cmp: string }[] = [
    { label: "7日", from: now - 7 * D, prevFrom: now - 14 * D, cmp: "前の7日" },
    { label: "30日", from: now - 30 * D, prevFrom: now - 60 * D, cmp: "前の30日" },
    { label: "全期間", from: 0, prevFrom: 0, cmp: "" },
  ];
  const tagOf = (l: LogRow) => (l.tags.length ? l.tags : ["タグなし"]);
  const stat = new Map<string, { sum: number; n: number }>();
  logs.forEach((l) => tagOf(l).forEach((t) => { const s = stat.get(t) ?? { sum: 0, n: 0 }; s.sum += l.pain; s.n++; stat.set(t, s); }));
  const groupOf = (t: string) => { const s = stat.get(t)!; const avg = s.sum / s.n; return avg < 2.5 ? "mild" : avg < 3.75 ? "mid" : "strong"; };
  const perPeriod = periodsDef.map((p) => within(logs, p.from, now));
  const items = [...stat.keys()]
    .map((name) => ({ name, group: groupOf(name), values: perPeriod.map((ls) => ls.filter((l) => tagOf(l).includes(name)).length) }))
    .sort((a, b) => b.values[2] - a.values[2])
    .slice(0, 11);
  const periods = periodsDef.map((p, i) => {
    const total = perPeriod[i].length;
    const prev = i < 2 ? within(logs, p.prevFrom, p.from).length : 0;
    const delta = i < 2 ? change(total, prev) : "";
    return { label: p.label, total, delta, deltaTone: painTone(delta), compare: i < 2 ? `${p.cmp}は ${count(prev)}件` : "記録開始からの合計" };
  });
  const medCount = (ls: LogRow[], m: string) => ls.filter((l) => l.meds.includes(m)).length;
  const meds = [...new Set(logs.flatMap((l) => l.meds))].sort((a, b) => medCount(logs, b) - medCount(logs, a)).slice(0, 3);
  const categories: AnalyticsBentoProps["categories"] = {
    title: "症状タグ別の記録",
    shareLabel: "割合",
    emptyLabel: "この期間の記録はまだありません",
    groups: [
      { id: "mild", name: "軽め（平均 ~2）", color: "#7CFF5B", ink: "dark" },
      { id: "mid", name: "中程度（平均 3）", color: "#FFB800", ink: "dark" },
      { id: "strong", name: "強め（平均 4~）", color: "#FF5A1F", ink: "dark" },
    ],
    periods,
    items,
    table: meds.length
      ? { columns: ["服薬", "7日", "30日", "全期間"], rows: meds.map((m) => ({ label: m, values: perPeriod.map((ls) => `${count(medCount(ls, m))}回`) })) }
      : undefined,
  };

  /* --- D: 曜日別（直近30日 / 全期間） --- */
  const axis = ["月", "火", "水", "木", "金", "土", "日"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const dowCounts = (ls: LogRow[]) => order.map((d) => ls.filter((l) => dowOf(l.ts) === d).length);
  const top = (arr: number[], labels: string[]) => (Math.max(...arr) > 0 ? labels[arr.indexOf(Math.max(...arr))] : "—");
  const avgPain = (ls: LogRow[]) => (ls.length ? (ls.reduce((s, l) => s + l.pain, 0) / ls.length).toFixed(1) : "—");
  const seasonYears = [
    { label: "30日", ls: perPeriod[1], prev: within(logs, now - 60 * D, now - 30 * D) },
    { label: "全期間", ls: logs, prev: [] as LogRow[] },
  ].map(({ label, ls, prev }) => {
    const counts = dowCounts(ls);
    const hours = Array.from({ length: 12 }, (_, i) => ls.filter((l) => Math.floor(hourOf(l.ts) / 2) === i).length);
    const strong = ls.filter((l) => l.pain >= 3).length;
    const delta = change(ls.length, prev.length);
    return {
      label,
      values: counts,
      stats: [
        { label: "記録件数", value: ls.length, delta, deltaTone: painTone(delta), note: `平均の痛み ${avgPain(ls)}` },
        { label: "痛み3以上", value: strong, delta: "", note: ls.length ? `全体の${Math.round((strong / ls.length) * 100)}%` : "—" },
      ],
      rows: [
        { label: "最も多い曜日", value: top(counts, axis.map((a) => a + "曜")) },
        { label: "最も多い時間帯", value: Math.max(...hours) > 0 ? `${hours.indexOf(Math.max(...hours)) * 2}〜${hours.indexOf(Math.max(...hours)) * 2 + 2}時` : "—" },
        { label: "平均の痛み（5段階）", value: avgPain(ls) },
      ],
    };
  });
  const seasonality: AnalyticsBentoProps["seasonality"] = { title: "曜日別の記録", valueLabel: "件数", axis, years: seasonYears };

  return { currency: "", revenue, sessions, categories, seasonality, credit: false, fontFamily: "inherit", monoFamily: "ui-monospace, SFMono-Regular, Menlo, 'Hiragino Sans', monospace" };
}
