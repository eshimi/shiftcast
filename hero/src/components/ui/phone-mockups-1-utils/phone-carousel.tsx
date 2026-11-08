import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageItem {
  src: string;
  alt: string;
}

interface PhoneCarouselProps {
  images: ImageItem[];
  /** 自動切り替え間隔(ms)。0で無効。ホバー/フォーカス中と「視差を減らす」設定では停止 */
  autoPlayMs?: number;
  className?: string;
}

/** n個の中での i の、現在位置 index からの相対位置(-n/2..n/2) */
function relative(i: number, index: number, n: number) {
  let d = i - index;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

function Phone({ image, active }: { image: ImageItem; active: boolean }) {
  return (
    <div
      className={cn(
        "relative w-[150px] rounded-[30px] border-[6px] border-foreground/90 bg-black shadow-xl",
        active ? "shadow-2xl" : "",
      )}
    >
      {/* ダイナミックアイランド */}
      <span className="absolute left-1/2 top-1.5 z-10 h-[10px] w-[44px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
      <div className="aspect-[1/2] w-full overflow-hidden rounded-[22px] bg-card">
        <img src={image.src} alt={image.alt} loading="lazy" draggable={false} className="h-full w-full object-cover object-top" />
      </div>
    </div>
  );
}

export function PhoneCarousel({ images, autoPlayMs = 4500, className }: PhoneCarouselProps) {
  const n = images.length;
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const go = React.useCallback((delta: number) => setIndex((i) => (i + delta + n) % n), [n]);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!autoPlayMs || paused || reduce || n < 2) return;
    const t = window.setInterval(() => go(1), autoPlayMs);
    return () => window.clearInterval(t);
  }, [autoPlayMs, paused, n, go]);

  if (!n) return null;

  return (
    <div
      className={cn("w-full", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="アプリ画面のプレビュー"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      <div className="relative mx-auto h-[330px] w-full max-w-[340px] overflow-hidden">
        {images.map((image, i) => {
          const d = relative(i, index, n);
          const visible = Math.abs(d) <= 1;
          return (
            <div
              key={image.src}
              className="absolute left-1/2 top-3 transition-all duration-500 ease-out motion-reduce:transition-none"
              style={{
                transform: `translateX(calc(-50% + ${d * 104}px)) scale(${d === 0 ? 1 : 0.82})`,
                opacity: visible ? (d === 0 ? 1 : 0.55) : 0,
                zIndex: 10 - Math.abs(d),
                pointerEvents: visible ? "auto" : "none",
              }}
              aria-hidden={d !== 0}
              onClick={() => d !== 0 && visible && setIndex(i)}
            >
              <Phone image={image} active={d === 0} />
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(-1)} aria-label="前の画面">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="画面を選ぶ">
          {images.map((image, i) => (
            <button
              key={image.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={image.alt}
              onClick={() => setIndex(i)}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40")}
            />
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go(1)} aria-label="次の画面">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
