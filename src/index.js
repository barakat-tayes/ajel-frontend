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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      if (process.env.NODE_ENV === "production") {
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
