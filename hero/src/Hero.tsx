import { Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import PhoneMockupBasic from "@/components/ui/phone-mockups-1";

/** トップページのHERO。ボタンは各機能へのリンク。 */
export default function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative mb-3 overflow-hidden rounded-[14px] bg-card p-5 text-card-foreground shadow-sm"
    >
      <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
        気象病セルフケア
      </p>
      <h1 id="hero-title" className="mt-3 text-[26px] font-bold leading-snug tracking-tight">
        気圧の変化を、
        <br />
        先回りで知る。
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        気圧の低下を前の晩に通知。体調を記録するほど、あなたの「不調になりやすい条件」が見えてきます。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <a href="/app/#log">体調を記録する</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/weather">週間天気を見る</a>
        </Button>
      </div>

      <div className="mt-4">
        <PhoneMockupBasic />
      </div>
    </section>
  );
}
