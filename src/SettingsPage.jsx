import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";
import { useAuth } from "./AuthContext";
import styles from "./SettingsPage.module.css";
import Swal from "sweetalert2";

const PROVINCES = [
  "بغداد",
  "البصرة",
  "نينوى",
  "أربيل",
  "النجف",
  "كربلاء",
  "الأنبار",
  "ديالى",
  "صلاح الدين",
  "كركوك",
  "بابل",
  "واسط",
  "ذي قار",
  "ميسان",
  "المثنى",
  "القادسية",
  "دهوك",
  "السليمانية",
];

const DEFAULT_POLICY =
  "باستخدامك للتطبيق، أنت توافق على الالتزام بقواعد الاستخدام ودقة بيانات الطلبات. يحق للإدارة تعليق أو إيقاف الحساب عند وجود إساءة استخدام أو مستحقات غير مسددة.";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState(
    user?.userType === "admin" ? "admin" : "profile",
  );
  const [form, setForm] = useState({});
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [adminSettings, setAdminSettings] = useState({
    per_order_fee: 0,
    contact_phone: "",
    contact_whatsapp: "",
    payment_master_card: "",
    payment_zain_cash: "",
    payment_asia_pay: "",
    policy_text: "",
  });
  const [adminAccount, setAdminAccount] = useState({
    username: "",
    password: "",
  });
  const [msg, setMsg] = useState("");
  const [locating, setLocating] = useState(false);
  const isRestaurant = user?.userType === "restaurant";

  const confirmLogout = async () => {
    const result = await Swal.fire({
      title: "تأكيد تسجيل الخروج",
      text: "هل أنت متأكد أنك تريد تسجيل الخروج؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، تسجيل الخروج",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#e31e24",
      cancelButtonColor: "#64748b",
    });
    if (result.isConfirmed) logout();
  };

  useEffect(() => {
    const load = async () => {
      if (user.userType === "admin") {
        const settingsRes = await api.get("/admin/settings");
        const s = settingsRes.data || {};
        setAdminSettings({
          per_order_fee: Number(s.per_order_fee || 0),
          contact_phone: s.contact_phone || "",
          contact_whatsapp: s.contact_whatsapp || "",
          payment_master_card: s.payment_master_card || "",
          payment_zain_cash: s.payment_zain_cash || "",
          payment_asia_pay: s.payment_asia_pay || "",
          policy_text: s.policy_text || DEFAULT_POLICY,
        });
        setAdminAccount((prev) => ({
          ...prev,
          username: s.username || prev.username || "",
        }));
        return;
      }

      const settingsRes = await api.get("/public/contact-payment");
      const s = settingsRes.data || {};
      setAdminSettings((prev) => ({
        ...prev,
        contact_phone: s.contact_phone || "",
        contact_whatsapp: s.contact_whatsapp || "",
        payment_master_card: s.payment_master_card || "",
        payment_zain_cash: s.payment_zain_cash || "",
        payment_asia_pay: s.payment_asia_pay || "",
        policy_text: s.policy_text || DEFAULT_POLICY,
      }));

      const base =
        user.userType === "restaurant"
          ? "/restaurants/profile"
          : "/drivers/profile";
      const profileRes = await api.get(base);
      setForm(profileRes.data || {});
    };
    load();
  }, [user.userType]);

  const saveProfile = async (e) => {
    e.preventDefault();
    const base =
      user.userType === "restaurant"
        ? "/restaurants/profile"
        : "/drivers/profile";
    await api.put(base, form);
    setMsg("تم حفظ البيانات بنجاح");
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const base =
      user.userType === "restaurant"
        ? "/restaurants/change-password"
        : "/drivers/change-password";
    await api.put(base, passwords);
    setPasswords({ currentPassword: "", newPassword: "" });
    setMsg("تم تغيير كلمة المرور بنجاح");
  };

  const saveAdminSettings = async (e) => {
    e.preventDefault();
    await api.put("/admin/settings", {
      per_order_fee: Number(adminSettings.per_order_fee || 0),
      contact_phone: adminSettings.contact_phone,
      contact_whatsapp: adminSettings.contact_whatsapp,
      payment_master_card: adminSettings.payment_master_card,
      payment_zain_cash: adminSettings.payment_zain_cash,
      payment_asia_pay: adminSettings.payment_asia_pay,
      policy_text: adminSettings.policy_text,
    });
    setMsg("تم حفظ إعدادات الأدمن بنجاح");
  };

  const saveAdminAccount = async (e) => {
    e.preventDefault();
    await api.put("/admin/account", {
      username: adminAccount.username,
      password: adminAccount.password,
    });
    setAdminAccount((prev) => ({ ...prev, password: "" }));
    setMsg("تم تحديث بيانات دخول الأدمن");
  };

  const pickCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMsg("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          location_lat: String(pos.coords.latitude),
          location_lng: String(pos.coords.longitude),
        }));
        setLocating(false);
        setMsg("تم تحديث الإحداثيات من موقعك الحالي");
      },
      (geoError) => {
        const map = {
          1: "تم رفض إذن الموقع. فعّل إذن الموقع من المتصفح.",
          2: "تعذر تحديد موقعك الحالي.",
          3: "انتهت مهلة تحديد الموقع. حاول مرة أخرى.",
        };
        setLocating(false);
        setMsg(map[geoError?.code] || "تعذر تحديد الموقع الحالي.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.wrap}>
        <div className={styles.head}>
          <strong>الإعدادات</strong>
          <button className={styles.btn} onClick={() => navigate(-1)}>
            رجوع
          </button>
        </div>

        {user.userType !== "admin" ? (
          <div className={styles.tiles}>
            <button
              className={`${styles.tile} ${
                section === "profile" ? styles.tileActive : ""
              }`}
              onClick={() => setSection("profile")}
            >
              البيانات الشخصية
            </button>
            {isRestaurant ? (
              <button
                className={`${styles.tile} ${
                  section === "payments" ? styles.tileActive : ""
                }`}
                onClick={() => setSection("payments")}
              >
                وسائل الدفع
              </button>
            ) : null}
            <button
              className={`${styles.tile} ${
                section === "policy" ? styles.tileActive : ""
              }`}
              onClick={() => setSection("policy")}
            >
              سياسة التطبيق
            </button>
            <button
              className={`${styles.tile} ${
                section === "contact" ? styles.tileActive : ""
              }`}
              onClick={() => setSection("contact")}
            >
              اتصل بنا
            </button>
            <button
              className={`${styles.tile} ${styles.tileDanger}`}
              onClick={confirmLogout}
            >
              تسجيل الخروج
            </button>
          </div>
        ) : null}

        {msg ? <div className={styles.card}>{msg}</div> : null}

        {user.userType === "admin" ? (
          <>
            <form onSubmit={saveAdminSettings} className={styles.card}>
              <strong>إعدادات الأدمن</strong>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="250"
                value={adminSettings.per_order_fee}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    per_order_fee: e.target.value,
                  }))
                }
                placeholder="سعر الأدمن لكل طلبية مكتملة (د.ع)"
              />
              <input
                className={styles.input}
                value={adminSettings.contact_phone}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    contact_phone: e.target.value,
                  }))
                }
                placeholder="رقم التواصل"
              />
              <input
                className={styles.input}
                value={adminSettings.contact_whatsapp}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    contact_whatsapp: e.target.value,
                  }))
                }
                placeholder="رابط واتساب (wa.me)"
              />
              <input
                className={styles.input}
                value={adminSettings.payment_master_card}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    payment_master_card: e.target.value,
                  }))
                }
                placeholder="رقم الماستر كارد"
              />
              <input
                className={styles.input}
                value={adminSettings.payment_zain_cash}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    payment_zain_cash: e.target.value,
                  }))
                }
                placeholder="رقم زين كاش"
              />
              <input
                className={styles.input}
                value={adminSettings.payment_asia_pay}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    payment_asia_pay: e.target.value,
                  }))
                }
                placeholder="رقم آسيا باي"
              />
              <textarea
                className={styles.input}
                rows={6}
                value={adminSettings.policy_text}
                onChange={(e) =>
                  setAdminSettings((p) => ({
                    ...p,
                    policy_text: e.target.value,
                  }))
                }
                placeholder="نص سياسة التطبيق"
              />
              <button className={styles.btn} type="submit">
                حفظ إعدادات الأدمن
              </button>
            </form>

            <form onSubmit={saveAdminAccount} className={styles.card}>
              <strong>بيانات دخول الأدمن</strong>
              <input
                className={styles.input}
                value={adminAccount.username}
                onChange={(e) =>
                  setAdminAccount((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="اسم مستخدم الأدمن"
                required
              />
              <input
                className={styles.input}
                type="password"
                value={adminAccount.password}
                onChange={(e) =>
                  setAdminAccount((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="كلمة مرور جديدة (اختياري)"
              />
              <button className={styles.btn} type="submit">
                حفظ بيانات دخول الأدمن
              </button>
            </form>
          </>
        ) : null}

        {user.userType !== "admin" && section === "profile" ? (
          <>
            <form onSubmit={saveProfile} className={styles.card}>
              <strong>البيانات الشخصية</strong>
              <input
                className={styles.input}
                value={form.name || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="الاسم"
              />
              <input
                className={styles.input}
                value={form.phone || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="الهاتف"
              />
              {user.userType === "restaurant" ? (
                <>
                  <input
                    className={styles.input}
                    value={form.address || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, address: e.target.value }))
                    }
                    placeholder="العنوان"
                  />
                  <input
                    className={styles.input}
                    value={form.city || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, city: e.target.value }))
                    }
                    placeholder="المدينة"
                  />
                  <select
                    className={styles.input}
                    value={form.province || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, province: e.target.value }))
                    }
                  >
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className={styles.coordsRow}>
                    <input
                      className={`${styles.input} ${styles.coordInput}`}
                      value={form.location_lat || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, location_lat: e.target.value }))
                      }
                      placeholder="خط العرض"
                    />
                    <input
                      className={`${styles.input} ${styles.coordInput}`}
                      value={form.location_lng || ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, location_lng: e.target.value }))
                      }
                      placeholder="خط الطول"
                    />
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={pickCurrentLocation}
                      disabled={locating}
                    >
                      {locating ? "جاري التحديد..." : "تحديد موقعي الحالي"}
                    </button>
                  </div>
                  <input
                    className={styles.input}
                    value={form.location_link || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, location_link: e.target.value }))
                    }
                    placeholder="رابط الموقع"
                  />
                </>
              ) : (
                <>
                  <input
                    className={styles.input}
                    value={form.vehicle_type || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, vehicle_type: e.target.value }))
                    }
                    placeholder="نوع المركبة"
                  />
                  <input
                    className={styles.input}
                    value={form.vehicle_plate || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, vehicle_plate: e.target.value }))
                    }
                    placeholder="رقم اللوحة"
                  />
                  <select
                    className={styles.input}
                    value={form.province || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, province: e.target.value }))
                    }
                  >
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button className={styles.btn} type="submit">
                حفظ التعديلات
              </button>
            </form>

            <form onSubmit={savePassword} className={styles.card}>
              <strong>تغيير كلمة المرور</strong>
              <input
                className={styles.input}
                type="password"
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords((p) => ({
                    ...p,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="كلمة المرور الحالية"
                required
              />
              <input
                className={styles.input}
                type="password"
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords((p) => ({ ...p, newPassword: e.target.value }))
                }
                placeholder="كلمة المرور الجديدة"
                required
              />
              <button className={styles.btn} type="submit">
                تحديث كلمة المرور
              </button>
            </form>
          </>
        ) : null}

        {user.userType !== "admin" && isRestaurant && section === "payments" ? (
          <div className={styles.card}>
            <strong>وسائل الدفع المتاحة للتسديد</strong>
            <div className={styles.payRow}>
              <span>رقم الماستر كارد</span>
              <b>{adminSettings.payment_master_card || "-"}</b>
            </div>
            <div className={styles.payRow}>
              <span>زين كاش</span>
              <b>{adminSettings.payment_zain_cash || "-"}</b>
            </div>
            <div className={styles.payRow}>
              <span>آسيا باي</span>
              <b>{adminSettings.payment_asia_pay || "-"}</b>
            </div>
          </div>
        ) : null}

        {user.userType !== "admin" && section === "contact" ? (
          <div className={styles.card}>
            <strong>اتصل بنا</strong>
            <div className={styles.payRow}>
              <span>رقم التواصل</span>
              <b>{adminSettings.contact_phone || "-"}</b>
            </div>
            <div className={styles.payRow}>
              <span>واتساب</span>
              <a
                href={adminSettings.contact_whatsapp || "#"}
                target="_blank"
                rel="noreferrer"
              >
                {adminSettings.contact_whatsapp || "-"}
              </a>
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <a
                className={styles.btn}
                href={`tel:${adminSettings.contact_phone || ""}`}
              >
                اتصال مباشر
              </a>
              <a
                className={styles.btn}
                href={adminSettings.contact_whatsapp || "#"}
                target="_blank"
                rel="noreferrer"
              >
                فتح واتساب
              </a>
            </div>
          </div>
        ) : null}

        {user.userType !== "admin" && section === "policy" ? (
          <div className={styles.card}>
            <strong>سياسة التطبيق</strong>
            <p
              className={styles.policyScroll}
              style={{
                margin: "10px 0",
                lineHeight: 1.9,
                color: "#334155",
                whiteSpace: "pre-wrap",
              }}
            >
              {adminSettings.policy_text || DEFAULT_POLICY}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
