import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

const DEFAULT_POLICY =
  "باستخدامك للتطبيق، أنت توافق على الالتزام بقواعد الاستخدام ودقة بيانات الطلبات. يحق للإدارة تعليق أو إيقاف الحساب عند وجود إساءة استخدام أو مستحقات غير مسددة.";

export default function AboutPolicyPage() {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(DEFAULT_POLICY);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/public/contact-payment");
        setPolicy(res.data?.policy_text || DEFAULT_POLICY);
      } catch {
        setPolicy(DEFAULT_POLICY);
      }
    };
    load();
  }, []);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#ffb800", padding: 16 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", border: "2px solid #111", borderRadius: 14, padding: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: "#e31e24", color: "#fff", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 800 }}>
          رجوع
        </button>
        <h2>سياسة التطبيق</h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{policy}</p>
      </div>
    </div>
  );
}
