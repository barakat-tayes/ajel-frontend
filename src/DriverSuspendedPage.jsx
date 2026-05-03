import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import api from "./api";
import { useAuth } from "./AuthContext";

export default function DriverSuspendedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [message, setMessage] = useState(
    location.state?.message ||
      "تم إيقاف حسابك من قبل إدارة التطبيق. يرجى التواصل مع الإدارة لمعرفة التفاصيل."
  );
  const [contact, setContact] = useState({
    contact_phone: "",
    contact_whatsapp: "",
  });

  const checkActivation = async () => {
    try {
      await api.get("/drivers/current-order");
      navigate("/driver", { replace: true });
    } catch (e) {
      const status = e?.response?.status;
      if (status !== 403) navigate("/driver", { replace: true });
    }
  };

  useEffect(() => {
    const loadContact = async () => {
      try {
        const res = await api.get("/public/contact-payment");
        setContact({
          contact_phone: res.data?.contact_phone || "",
          contact_whatsapp: res.data?.contact_whatsapp || "",
        });
      } catch {}
    };
    loadContact();
  }, []);

  useEffect(() => {
    const t = setInterval(checkActivation, 8000);
    checkActivation();
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const s = io(`http://${window.location.hostname}:5000`);
    s.emit("join", { userType: "driver", userId: user.id, province: user.province });
    s.on("admin_driver_suspended", (payload) => {
      if (payload?.message) setMessage(payload.message);
    });
    s.on("admin_driver_unsuspended", () => {
      navigate("/driver", { replace: true });
    });
    return () => s.close();
  }, [user?.id, user?.province]);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#fff7f7", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#fff", border: "1px solid #fecaca", borderRadius: 16, padding: 20, boxShadow: "0 12px 24px rgba(220,38,38,0.12)" }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: "#fee2e2", color: "#b91c1c", display: "grid", placeItems: "center", fontSize: 28, marginBottom: 10 }}>
          !
        </div>
        <h2 style={{ margin: 0, marginBottom: 8, color: "#991b1b" }}>الحساب موقوف</h2>
        <p style={{ margin: 0, color: "#334155", lineHeight: 1.9 }}>{message}</p>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={contact.contact_phone ? `tel:${contact.contact_phone}` : "#"}
            style={{
              background: "#e31e24",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 800,
              pointerEvents: contact.contact_phone ? "auto" : "none",
              opacity: contact.contact_phone ? 1 : 0.6,
            }}
          >
            الاتصال بالإدارة
          </a>
          <button
            onClick={logout}
            style={{ background: "#059669", color: "#fff", border: 0, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            تسجيل الخروج
          </button>
          <button
            onClick={() => navigate("/contact")}
            style={{ background: "#111827", color: "#fff", border: 0, borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            صفحة التواصل
          </button>
        </div>
      </div>
    </div>
  );
}
