import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./api";
import styles from "./Login.module.css";

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

export default function Register() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState("restaurant");
  const [formData, setFormData] = useState({
    name: "",
    owner_name: "",
    phone: "",
    province: "نينوى",
    address: "",
    location_lat: "",
    location_lng: "",
    location_link: "",
    vehicle_type: "",
    vehicle_plate: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const onChange = (e) =>
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const pickCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setFormData((p) => ({
        ...p,
        location_lat: String(pos.coords.latitude),
        location_lng: String(pos.coords.longitude),
      }));
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    try {
      if (accountType === "restaurant") {
        await api.post("/auth/register/restaurant", formData);
      } else {
        await api.post("/auth/register/driver", formData);
      }
      setOk("تم إرسال طلب التسجيل بنجاح");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "تعذر التسجيل");
    }
  };

  return (
    <div className={styles.authPage} dir="rtl">
      <div className={styles.card} style={{ maxWidth: 700 }}>
        <div className={styles.logoWrap}>
          <img
            src="/icon-512.png"
            alt="Ajel Logo"
            className={styles.logoImage}
          />
          <h2 className={styles.title}>تسجيل حساب جديد</h2>
          <p className={styles.subtitle}>
            أدخل بياناتك الأساسية كما هي لطلب التفعيل
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {ok && <div className={styles.ok}>{ok}</div>}

        <div className={styles.formScrollArea}>
        <form onSubmit={submit} className={styles.form}>
          <div className={styles.accountTypeSwitch}>
            <button
              type="button"
              className={`${styles.accountTypeBtn} ${
                accountType === "restaurant" ? styles.accountTypeBtnActive : ""
              }`}
              onClick={() => setAccountType("restaurant")}
            >
              حساب تاجر
            </button>
            <button
              type="button"
              className={`${styles.accountTypeBtn} ${
                accountType === "driver" ? styles.accountTypeBtnActive : ""
              }`}
              onClick={() => setAccountType("driver")}
            >
              حساب سائق
            </button>
          </div>

          <div className={styles.grid2}>
            <input
              name="name"
              className={styles.input}
              placeholder={
                accountType === "restaurant" ? "اسم الشركة" : "اسم السائق"
              }
              onChange={onChange}
              required
            />
            {accountType === "restaurant" ? (
              <input
                name="owner_name"
                className={styles.input}
                placeholder="اسم المالك"
                onChange={onChange}
                required
              />
            ) : (
              <input
                name="vehicle_type"
                className={styles.input}
                placeholder="نوع المركبة"
                onChange={onChange}
                required
              />
            )}
          </div>

          <div className={styles.grid2}>
            <input
              name="phone"
              className={styles.input}
              placeholder="رقم الهاتف"
              onChange={onChange}
              required
            />
            {accountType === "restaurant" ? (
              <input
                name="address"
                className={styles.input}
                placeholder="العنوان الدقيق"
                onChange={onChange}
                required
              />
            ) : (
              <input
                name="vehicle_plate"
                className={styles.input}
                placeholder="رقم اللوحة"
                onChange={onChange}
                required
              />
            )}
          </div>

          <div className={styles.grid2}>
            <select
              name="province"
              className={styles.input}
              value={formData.province}
              onChange={onChange}
            >
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {accountType === "restaurant" ? (
              <input
                name="location_link"
                className={styles.input}
                placeholder="رابط الموقع على الخريطة (اختياري)"
                value={formData.location_link}
                onChange={onChange}
              />
            ) : (
              <div />
            )}
          </div>

          {accountType === "restaurant" ? (
            <>
              <div className={styles.grid2}>
                <input
                  name="location_lat"
                  className={styles.input}
                  placeholder="خط العرض"
                  value={formData.location_lat}
                  onChange={onChange}
                  readOnly
                />
                <input
                  name="location_lng"
                  className={styles.input}
                  placeholder="خط الطول"
                  value={formData.location_lng}
                  onChange={onChange}
                  readOnly
                />
              </div>

              <button
                type="button"
                className={styles.linkButton}
                onClick={pickCurrentLocation}
              >
                تحديد موقعي الحالي
              </button>
            </>
          ) : null}

          <div className={styles.grid2}>
            <input
              name="password"
              type="password"
              className={styles.input}
              placeholder="كلمة المرور"
              onChange={onChange}
              required
            />
            <input
              name="confirmPassword"
              type="password"
              className={styles.input}
              placeholder="تأكيد كلمة المرور"
              onChange={onChange}
              required
            />
          </div>

          <button className={styles.primaryBtn}>إنشاء الحساب</button>
          <div className={styles.linkRow}>
            لديك حساب؟{" "}
            <Link to="/login" className={styles.link}>
              تسجيل الدخول
            </Link>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
