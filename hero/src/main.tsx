import { createRoot } from "react-dom/client";
import Hero from "./Hero";
import "./index.css";

// サーバー描画のトップページ(src/pages.js)の <div id="hero-root"> にマウントする（素のJS製アプリへの差し込み用）
const el = document.getElementById("hero-root");
if (el) createRoot(el).render(<Hero />);
