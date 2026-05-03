import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import styles from "./Login.module.css";
import api from "./api";

export default function Login() {
  const [credentials, setCredentials] = useState({ identifier: "", password: "", userType: "restaurant" });
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [contact, setContact] = useState({
    contact_phone: "",
    contact_whatsapp: "",
  });
  const { login } = useAuth();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(credentials.identifier, credentials.password, credentials.userType);
      if (user.userType === "admin") navigate("/admin", { replace: true });
      else if (user.userType === "restaurant") navigate("/restaurant", { replace: true });
      else navigate("/driver", { replace: true });
    } catch (err) {
      setError(err?.message || "حدث خطأ أثناء تسجيل الدخول");
    }
  };

  return (
    <div className={styles.authPage} dir="rtl">
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <img src="/icon-512.png" alt="Ajel Logo" className={styles.logoImage} />
          <h2 className={styles.title}>تسجيل الدخول</h2>
          <p className={styles.subtitle}>نفس حسابك.. أسرع وصول للطلبات</p>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <select className={styles.input} value={credentials.userType} onChange={(e) => setCredentials({ ...credentials, userType: e.target.value })}>
            <option value="restaurant">تاجر</option>
            <option value="driver">سائق توصيل</option>
          </select>
          <input
            className={styles.input}
            placeholder="رقم الهاتف"
            value={credentials.identifier}
            onChange={(e) => setCredentials({ ...credentials, identifier: e.target.value })}
            required
          />
          <input
            type="password"
            className={styles.input}
            placeholder="كلمة المرور"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            required
          />
          <button type="submit" className={styles.primaryBtn}>دخول</button>
        </form>
        <div className={styles.linkRow}>
          <button type="button" className={styles.linkButton} onClick={() => { setForgotOpen(true); setError(""); }}>
            نسيت كلمة المرور؟
          </button>
        </div>
        <div className={styles.linkRow}>ليس لديك حساب؟ <Link to="/register" className={styles.link}>سجل الآن</Link></div>
      </div>

      {forgotOpen && (
        <div className={styles.modalOverlay} onClick={() => setForgotOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.title} style={{ fontSize: 24, marginTop: 0 }}>نسيت كلمة المرور</h3>
            <div className={styles.form}>
              <div className={styles.ok} style={{ marginBottom: 0 }}>
                في حال نسيان كلمة المرور، تواصل مع إدارة التطبيق لإعادة تعيين كلمة مرور مؤقتة.
              </div>
              <div className={styles.linkRow}>
                رقم الدعم: {contact.contact_phone ? <a className={styles.link} href={`tel:${contact.contact_phone}`}>{contact.contact_phone}</a> : "-"}
              </div>
              <div className={styles.linkRow}>
                واتساب: {contact.contact_whatsapp ? <a className={styles.link} href={contact.contact_whatsapp} target="_blank" rel="noreferrer">راسل الإدارة</a> : "-"}
              </div>
              <button className={styles.primaryBtn} type="button" onClick={() => setForgotOpen(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
