import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

export default function ContactPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    contact_phone: "",
    contact_whatsapp: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/public/contact-payment");
        setData({
          contact_phone: res.data?.contact_phone || "",
          contact_whatsapp: res.data?.contact_whatsapp || "",
        });
      } catch {
        // keep fallback empty state
      }
    };
    load();
  }, []);

  const phone = String(data.contact_phone || "").trim();
  const whatsapp = String(data.contact_whatsapp || "").trim();

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#ffb800", padding: 16 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", border: "2px solid #111", borderRadius: 14, padding: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: "#e31e24", color: "#fff", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 800 }}>
          رجوع
        </button>

        <h2 style={{ marginBottom: 8 }}>اتصل بنا</h2>
        <p style={{ color: "#475569", marginTop: 0 }}>هذه البيانات تُدار من إعدادات الأدمن وتظهر هنا تلقائيًا.</p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <Row label="رقم التواصل" value={phone || "-"} />
          <Row
            label="واتساب"
            value={
              whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" style={{ color: "#0f766e", fontWeight: 700 }}>
                  {whatsapp}
                </a>
              ) : (
                "-"
              )
            }
          />
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={phone ? `tel:${phone}` : "#"}
            style={{ background: "#e31e24", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, pointerEvents: phone ? "auto" : "none", opacity: phone ? 1 : 0.6 }}
          >
            اتصال مباشر
          </a>
          <a
            href={whatsapp || "#"}
            target="_blank"
            rel="noreferrer"
            style={{ background: "#111827", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, pointerEvents: whatsapp ? "auto" : "none", opacity: whatsapp ? 1 : 0.6 }}
          >
            فتح واتساب
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: "#64748b", fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#0f172a", fontWeight: 800, textAlign: "left", direction: "ltr" }}>{value}</span>
    </div>
  );
}
