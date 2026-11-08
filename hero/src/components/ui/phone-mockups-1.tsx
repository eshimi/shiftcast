import React from "react";
import {
  ImageItem,
  PhoneCarousel,
} from "@/components/ui/phone-mockups-1-utils/phone-carousel";

// アプリ自身の実画面（public/hero/shots/*.png）。Unsplash ではなく実際のスクリーンショットを使用。
const exampleImages: ImageItem[] = [
  { src: "/hero/shots/dashboard.png", alt: "気圧の推移グラフと4段階アラートの画面" },
  { src: "/hero/shots/log.png", alt: "痛み・症状・服薬を記録する画面" },
  { src: "/hero/shots/insight.png", alt: "気圧と体調の傾向を分析する画面" },
  { src: "/hero/shots/settings.png", alt: "エリアと通知の設定画面" },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel images={exampleImages} />;
}
