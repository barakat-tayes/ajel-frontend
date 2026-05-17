import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "./api";
import styles from "./Login.module.css";
import { ensureNotificationPermission, setNotificationsEnabled } from "./notifications";

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
  const [locating, setLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasArabicChars = (value = "") =>
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(value));
  const hasWhitespace = (value = "") => /\s/.test(String(value));
  const onChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const resetRegisterForm = () =>
    setFormData({
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

  const switchAccountType = (nextType) => {
    if (nextType === accountType) return;
    setAccountType(nextType);
    resetRegisterForm();
    setError("");
    setOk("");
    setLocating(false);
  };

  const pickCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((p) => ({
          ...p,
          location_lat: String(pos.coords.latitude),
          location_lng: String(pos.coords.longitude),
        }));
        setLocating(false);
      },
      (geoError) => {
        const map = {
          1: "تم رفض إذن الموقع. فعّل إذن الموقع من المتصفح.",
          2: "تعذر تحديد موقعك الحالي.",
          3: "انتهت مهلة تحديد الموقع. حاول مرة أخرى.",
        };
        setError(map[geoError?.code] || "تعذر تحديد الموقع الحالي.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (hasArabicChars(formData.password) || hasWhitespace(formData.password)) {
      setError("كلمة المرور يجب أن تكون بدون أحرف عربية وبدون فراغات");
      return;
    }
    if (
      accountType === "restaurant" &&
      (!String(formData.location_lat || "").trim() ||
        !String(formData.location_lng || "").trim())
    ) {
      setError("يرجى تحديد الموقع قبل التسجيل");
      return;
    }

    try {
      if (accountType === "restaurant") {
        await api.post("/auth/register/restaurant", formData);
      } else {
        await api.post("/auth/register/driver", formData);
      }

      const ask = await Swal.fire({
        icon: "question",
        title: "تفعيل الإشعارات",
        text: "هل تريد تفعيل الإشعارات الآن؟ يمكنك إيقافها لاحقًا من الإعدادات.",
        showCancelButton: true,
        confirmButtonText: "نعم",
        cancelButtonText: "لاحقًا",
        confirmButtonColor: "#e31e24",
      });
      if (ask.isConfirmed) {
        const perm = await ensureNotificationPermission();
        setNotificationsEnabled(perm === "granted");
      } else {
        setNotificationsEnabled(false);
      }

      setOk("تم إنشاء الحساب بنجاح");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "تعذر التسجيل");
    }
  };

  return (
    <div className={styles.authPage} dir="rtl">
      <div className={styles.card} style={{ maxWidth: 700 }}>
        <div className={styles.logoWrap}>
          <img src="/icon-512.png" alt="Ajel Logo" className={styles.logoImage} />
          <h2 className={styles.title}>تسجيل حساب جديد</h2>
          <p className={styles.subtitle}>أدخل بياناتك الأساسية كما هي لطلب التفعيل</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {ok && <div className={styles.ok}>{ok}</div>}

        <div className={styles.formScrollArea}>
          <form key={accountType} onSubmit={submit} className={styles.form}>
            <div className={styles.accountTypeSwitch}>
              <button
                type="button"
                className={`${styles.accountTypeBtn} ${accountType === "restaurant" ? styles.accountTypeBtnActive : ""}`}
                onClick={() => switchAccountType("restaurant")}
              >
                حساب تاجر
              </button>
              <button
                type="button"
                className={`${styles.accountTypeBtn} ${accountType === "driver" ? styles.accountTypeBtnActive : ""}`}
                onClick={() => switchAccountType("driver")}
              >
                حساب سائق
              </button>
            </div>

            <div className={styles.grid2}>
              <input
                name="name"
                className={styles.input}
                placeholder={accountType === "restaurant" ? "اسم الشركة" : "اسم السائق"}
                onChange={onChange}
                required
              />
              {accountType === "restaurant" ? (
                <input name="owner_name" className={styles.input} placeholder="اسم المالك" onChange={onChange} required />
              ) : (
                <input name="vehicle_type" className={styles.input} placeholder="نوع المركبة" onChange={onChange} required />
              )}
            </div>

            <div className={styles.grid2}>
              <input name="phone" className={styles.input} placeholder="رقم الهاتف" onChange={onChange} required />
              {accountType === "restaurant" ? (
                <input name="address" className={styles.input} placeholder="العنوان الدقيق" onChange={onChange} required />
              ) : (
                <input name="vehicle_plate" className={styles.input} placeholder="رقم اللوحة" onChange={onChange} required />
              )}
            </div>

            <div className={styles.grid2}>
              <select name="province" className={styles.input} value={formData.province} onChange={onChange}>
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
                  <input name="location_lat" className={styles.input} placeholder="خط العرض" value={formData.location_lat} onChange={onChange} readOnly />
                  <input name="location_lng" className={styles.input} placeholder="خط الطول" value={formData.location_lng} onChange={onChange} readOnly />
                </div>
                <button type="button" className={styles.linkButton} onClick={pickCurrentLocation} disabled={locating}>
                  {locating ? "جاري التحديد..." : "تحديد موقعي الحالي"}
                </button>
              </>
            ) : null}

            <div className={styles.grid2}>
              <div className={styles.passwordWrap}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className={styles.input}
                  placeholder="كلمة المرور"
                  onChange={onChange}
                  required
                />
                <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              <div className={styles.passwordWrap}>
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className={styles.input}
                  placeholder="تأكيد كلمة المرور"
                  onChange={onChange}
                  required
                />
                <button type="button" className={styles.passwordToggle} onClick={() => setShowConfirmPassword((v) => !v)}>
                  {showConfirmPassword ? "🙈" : "👁"}
                </button>
              </div>
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

