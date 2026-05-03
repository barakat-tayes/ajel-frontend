import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import api from "./api";
import io from "socket.io-client";

export default function RestaurantSuspendedPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    contact_phone: "",
    contact_whatsapp: "",
    payment_master_card: "",
    payment_zain_cash: "",
    payment_asia_pay: "",
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/public/contact-payment");
        setSettings({
          contact_phone: res.data?.contact_phone || "",
          contact_whatsapp: res.data?.contact_whatsapp || "",
          payment_master_card: res.data?.payment_master_card || "",
          payment_zain_cash: res.data?.payment_zain_cash || "",
          payment_asia_pay: res.data?.payment_asia_pay || "",
        });
      } catch {}
    };
    loadSettings();
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const res = await api.get("/restaurants/profile");
        if (!mounted) return;
        if (res?.data?.status !== "suspended") {
          navigate("/restaurant", { replace: true });
        }
      } catch {}
    };
    checkStatus();
    const timer = setInterval(checkStatus, 8000);

    const s = io(`http://${window.location.hostname}:5000`);
    if (user?.id) s.emit("join", { userType: "restaurant", userId: user.id });
    s.on("admin_clear_warnings", () => navigate("/restaurant", { replace: true }));

    return () => {
      mounted = false;
      clearInterval(timer);
      s.close();
    };
  }, [navigate, user?.id]);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#fff7ed",
        padding: 16,
        fontFamily: "Almarai, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          border: "1px solid #fecaca",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 12px 24px rgba(0,0,0,.08)",
        }}
      >
        <h2 style={{ margin: 0, color: "#b91c1c" }}>الحساب موقوف مؤقتًا</h2>
        <p style={{ marginTop: 10, color: "#334155", lineHeight: 1.9 }}>
          تم إيقاف حساب التاجر من قبل الإدارة بسبب وجود مستحقات مالية غير مسددة.
          يرجى تسديد المبلغ المطلوب ثم التواصل مع الإدارة لإعادة تفعيل الحساب.
        </p>
        <div
          style={{
            marginTop: 12,
            background: "#fef2f2",
            border: "1px dashed #ef4444",
            borderRadius: 12,
            padding: 12,
            color: "#7f1d1d",
            fontWeight: 700,
          }}
        >
          ملاحظة: عند تسوية المبلغ سيتم إزالة الإيقاف وعودة الحساب للعمل مباشرة.
        </div>
        <div
          style={{
            marginTop: 12,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>وسائل الدفع</strong>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>رقم الماستر كارد</span>
              <b>{settings.payment_master_card || "-"}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>زين كاش</span>
              <b>{settings.payment_zain_cash || "-"}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>آسيا باي</span>
              <b>{settings.payment_asia_pay || "-"}</b>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={settings.contact_phone ? `tel:${settings.contact_phone}` : "#"}
            style={{
              textDecoration: "none",
              background: "#111827",
              color: "#fff",
              borderRadius: 10,
              padding: "9px 12px",
              fontWeight: 800,
              pointerEvents: settings.contact_phone ? "auto" : "none",
              opacity: settings.contact_phone ? 1 : 0.6,
            }}
          >
            اتصال بالإدارة
          </a>
          <a
            href={settings.contact_whatsapp || "#"}
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: "none",
              background: "#0f766e",
              color: "#fff",
              borderRadius: 10,
              padding: "9px 12px",
              fontWeight: 800,
              pointerEvents: settings.contact_whatsapp ? "auto" : "none",
              opacity: settings.contact_whatsapp ? 1 : 0.6,
            }}
          >
            واتساب الإدارة
          </a>
          <button
            onClick={logout}
            style={{
              background: "#e5e7eb",
              border: 0,
              borderRadius: 10,
              padding: "9px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    </div>
  );
}
