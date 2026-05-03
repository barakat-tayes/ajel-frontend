import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

const ua = window.navigator.userAgent || "";
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
const isIOSSafari = isIOS && isSafari;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      if (process.env.NODE_ENV === "production" && !isIOSSafari) {
        await navigator.serviceWorker.register("/service-worker.js");
      } else {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // no-op
    }
  });
}
