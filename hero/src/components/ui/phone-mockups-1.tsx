import React from "react";
import {
  ImageItem,
  PhoneCarousel,
} from "@/components/ui/phone-mockups-1-utils/phone-carousel";

// アプリ自身の実画面（public/hero/shots/*.png）。Unsplash ではなく実際のスクリーンショットを使用。
const exampleImages: ImageItem[] = [
  { src: "/hero/shots/dashboard.png?v=2", alt: "明日の気圧と今日の体調そらもようの画面" },
  { src: "/hero/shots/log.png?v=2", alt: "痛み・症状・服薬を記録する画面" },
  { src: "/hero/shots/insight.png?v=2", alt: "気圧グラフに記録を重ねて傾向を分析する画面" },
  { src: "/hero/shots/settings.png?v=2", alt: "通知とエリアの設定画面" },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel images={exampleImages} />;
}
