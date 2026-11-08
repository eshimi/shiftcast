import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import Hero from "./Hero";
import { AnalyticsBento } from "@/components/ui/analytics-bento";
import { buildBentoProps, type BentoInput } from "./bento-data";
import "./index.css";

// public/index.html の <div id="hero-root"> にHEROをマウントする（素のJS製アプリへの差し込み用）
const el = document.getElementById("hero-root");
if (el) createRoot(el).render(<Hero />);

// 分析タブ: window.KiatsuHero.renderBento(el, { logs, forecast }) でBentoを描画/更新する
const roots = new WeakMap<Element, Root>();
export function renderBento(target: HTMLElement, input: BentoInput) {
  let root = roots.get(target);
  if (!root) {
    root = createRoot(target);
    roots.set(target, root);
  }
  root.render(<AnalyticsBento {...buildBentoProps(input)} />);
}
