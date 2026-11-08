import * as React from "react";
import { Activity, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import PhoneMockupBasic from "@/components/ui/phone-mockups-1";

const KEY = "heroClosed";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** 既存アプリ(素のJS)のタブを切り替える */
const openTab = (v: string) => document.querySelector<HTMLButtonElement>(`.tabs [data-v="${v}"]`)?.click();

export default function Hero() {
  const [closed, setClosed] = React.useState(read);
  if (closed) return null;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative mb-3 overflow-hidden rounded-[14px] bg-card p-5 text-card-foreground shadow-sm"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5 h-8 w-8 text-muted-foreground"
        aria-label="この紹介を閉じる"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* private mode */
          }
          setClosed(true);
        }}
      >
        <X className="h-4 w-4" />
      </Button>

      <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        <Activity className="h-3.5 w-3.5 text-primary" aria-hidden />
        気象病セルフケア
      </p>
      <h2 id="hero-title" className="mt-3 text-2xl font-bold leading-snug tracking-tight">
        気圧の変化を、
        <br />
        先回りで知る。
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        気圧の低下を前の晩に通知。体調を記録するほど、あなたの「不調になりやすい条件」が見えてきます。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => openTab("log")}>体調を記録する</Button>
        <Button variant="outline" onClick={() => openTab("insight")}>
          自分の傾向を見る
        </Button>
      </div>

      <div className="mt-4">
        <PhoneMockupBasic />
      </div>
    </section>
  );
}
