import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import Swal from "sweetalert2";
import api from "./api";
import { useAuth } from "./AuthContext";
import styles from "./AdminDashboard.module.css";
import { SOCKET_BASE_URL } from "./runtimeConfig";

const ALL_PROVINCES = "__all__";
const asIqd = (value) => `${Math.round(Number(value || 0)).toLocaleString("en-US")} د.ع`;

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("restaurants");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState(ALL_PROVINCES);
  const [ledger, setLedger] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [pending, setPending] = useState({ restaurants: [], drivers: [] });
  const [perOrderFee, setPerOrderFee] = useState(0);
  const [payValues, setPayValues] = useState({});
  const [tempReset, setTempReset] = useState({ userType: "restaurant", phone: "", tempPassword: "" });
  const [lookupUser, setLookupUser] = useState(null);
  const [adminSettings, setAdminSettings] = useState({
    per_order_fee: 0,
    contact_phone: "",
    contact_whatsapp: "",
    payment_master_card: "",
    payment_zain_cash: "",
    payment_asia_pay: "",
    policy_text: "",
  });
  const [adminAccount, setAdminAccount] = useState({ username: "", password: "" });

  const load = async () => {
    const provinceParam = selectedProvince || ALL_PROVINCES;
    const [l, p, d] = await Promise.all([
      api.get("/admin/restaurants-ledger"),
      api.get("/admin/pending-approvals"),
      api.get(`/admin/drivers?province=${encodeURIComponent(provinceParam)}`),
    ]);
    setLedger(l.data?.rows || []);
    setPerOrderFee(l.data?.perOrderFee || 0);
    setPending(p.data || { restaurants: [], drivers: [] });
    setDrivers(Array.isArray(d.data) ? d.data : []);
    const settingsRes = await api.get("/admin/settings");
    const s = settingsRes.data || {};
    setAdminSettings({
      per_order_fee: Number(s.per_order_fee || 0),
      contact_phone: s.contact_phone || "",
      contact_whatsapp: s.contact_whatsapp || "",
      payment_master_card: s.payment_master_card || "",
      payment_zain_cash: s.payment_zain_cash || "",
      payment_asia_pay: s.payment_asia_pay || "",
      policy_text: s.policy_text || "",
    });
    setAdminAccount((prev) => ({ ...prev, username: s.username || prev.username || "" }));
  };

  useEffect(() => {
    if (!user || user.userType !== "admin") return;
    load();
  }, [user, selectedProvince]);

  useEffect(() => {
    if (!user || user.userType !== "admin") return;
    const s = io(SOCKET_BASE_URL);
    s.emit("join", { userType: "admin", userId: user.id });
    ["new_order_created", "order_accepted", "order_delivered", "order_returned", "order_cancelled", "driver_rejected", "new_join_request"].forEach((evt) =>
      s.on(evt, () => load())
    );
    return () => s.close();
  }, [user?.id, selectedProvince]);

  useEffect(() => {
    const phone = String(tempReset.phone || "").replace(/[^\d]/g, "");
    if (phone.length !== 11) {
      setLookupUser(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/admin/lookup-by-phone?userType=${encodeURIComponent(tempReset.userType)}&phone=${encodeURIComponent(phone)}`);
        setLookupUser(res.data?.found ? res.data.user : null);
      } catch {
        setLookupUser(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [tempReset.phone, tempReset.userType]);

  const restaurantProvinces = useMemo(
    () => Array.from(new Set((ledger || []).map((r) => r.province).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")),
    [ledger]
  );

  const filteredLedger = useMemo(() => {
    if (!selectedProvince || selectedProvince === ALL_PROVINCES) return ledger;
    return (ledger || []).filter((r) => r.province === selectedProvince);
  }, [ledger, selectedProvince]);

  const driversFiltered = useMemo(() => {
    if (!selectedProvince || selectedProvince === ALL_PROVINCES) return drivers;
    return (drivers || []).filter((d) => d.province === selectedProvince);
  }, [drivers, selectedProvince]);

  const pendingRequests = useMemo(() => (pending.restaurants?.length || 0) + (pending.drivers?.length || 0), [pending]);
  const restaurantsDue = useMemo(() => filteredLedger.reduce((acc, r) => acc + Number(r.current_due || 0), 0), [filteredLedger]);

  const doAction = async (id, action) => {
    const confirm = await Swal.fire({
      title: "تأكيد الإجراء",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "تنفيذ",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#e31e24",
    });
    if (!confirm.isConfirmed) return;

    if (action === "pay") {
      const value = Number(payValues[id] || 0);
      if (value <= 0) {
        await Swal.fire({ icon: "warning", title: "أدخل مبلغ تسديد صحيح", confirmButtonColor: "#e31e24" });
        return;
      }
      await api.put(`/admin/restaurants-ledger/${id}/pay`, { paid_amount: value });
      setPayValues((prev) => ({ ...prev, [id]: "" }));
    }
    if (action === "remind") await api.put(`/admin/restaurants-ledger/${id}/remind`);
    if (action === "warn") await api.put(`/admin/restaurants-ledger/${id}/toggle-warning`);
    if (action === "suspend") await api.put(`/admin/restaurants-ledger/${id}/toggle-suspend`);
    if (action === "deleteRestaurant") await api.delete(`/admin/restaurants/${id}`);
    if (action === "suspend24h") await api.put(`/admin/drivers/${id}/suspend-24h`);
    if (action === "suspend72h") await api.put(`/admin/drivers/${id}/suspend-72h`);
    if (action === "toggleDriverSuspend") await api.put(`/admin/drivers/${id}/toggle-suspend`);
    if (action === "clearDriverSuspend") await api.put(`/admin/drivers/${id}/clear-suspend`);
    if (action === "deleteDriver") await api.delete(`/admin/drivers/${id}`);

    await Swal.fire({ icon: "success", title: "تم التنفيذ", confirmButtonColor: "#e31e24" });
    await load();
  };

  const driverActionLabel = (driver, mode) => {
    const suspended = driver?.account_status === "suspended";
    const reason = driver?.suspension_reason || "";
    if (mode === "24h") return suspended && reason === "24h" ? "إلغاء إيقاف يوم" : "إيقاف يوم";
    if (mode === "72h") return suspended && reason === "72h" ? "إلغاء إيقاف 3 أيام" : "إيقاف 3 أيام";
    return suspended && (!driver?.suspended_until || reason === "manual") ? "تفعيل" : "إيقاف";
  };

  const driverActionKey = (driver, mode) => {
    const suspended = driver?.account_status === "suspended";
    const reason = driver?.suspension_reason || "";
    if (mode === "24h") return suspended && reason === "24h" ? "clearDriverSuspend" : "suspend24h";
    if (mode === "72h") return suspended && reason === "72h" ? "clearDriverSuspend" : "suspend72h";
    return "toggleDriverSuspend";
  };

  const updatePerOrderFee = async () => {
    const result = await Swal.fire({
      title: "تسعيرة الأدمن لكل طلبية مكتملة",
      input: "number",
      inputValue: perOrderFee || 0,
      inputAttributes: { min: "0", step: "250" },
      showCancelButton: true,
      confirmButtonText: "حفظ",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#e31e24",
    });
    if (!result.isConfirmed) return;
    await api.put("/admin/settings", { per_order_fee: Number(result.value || 0) });
    await Swal.fire({ icon: "success", title: "تم حفظ التسعيرة", confirmButtonColor: "#e31e24" });
    await load();
  };

  const resetTempPassword = async () => {
    if (!tempReset.phone || !tempReset.tempPassword) {
      await Swal.fire({ icon: "warning", title: "أدخل رقم الهاتف وكلمة المرور المؤقتة", confirmButtonColor: "#e31e24" });
      return;
    }
    await api.put("/admin/temporary-password", tempReset);
    await Swal.fire({ icon: "success", title: "تم تعيين كلمة مرور مؤقتة", confirmButtonColor: "#e31e24" });
    setTempReset({ userType: "restaurant", phone: "", tempPassword: "" });
    setLookupUser(null);
  };

  const requestsRows = [
    ...(pending.restaurants || []).map((r) => ({ ...r, t: "restaurant" })),
    ...(pending.drivers || []).map((d) => ({ ...d, t: "driver" })),
  ].filter((x) => selectedProvince === ALL_PROVINCES || x.province === selectedProvince);

  const openMap = (x) => {
    const link = x.location_link || (x.location_lat && x.location_lng ? `https://www.google.com/maps?q=${x.location_lat},${x.location_lng}` : "");
    if (link) window.open(link, "_blank");
  };
  const switchView = (nextView) => {
    setView(nextView);
    setSidebarOpen(false);
  };

  return (
    <div dir="rtl" className={styles.adminShell}>
      <aside className={`${styles.adminSidebar} ${sidebarOpen ? styles.adminSidebarOpen : ""}`}>
        <div className={styles.sidebarHeadMobile}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <div style={{ fontWeight: 900, fontSize: 20, color: "#fff", marginBottom: 10 }}>Ajel Admin</div>
        <button onClick={() => switchView("restaurants")} className={`${styles.sidebarTab} ${view === "restaurants" ? styles.sidebarTabActive : ""}`}>التجار</button>
        <button onClick={() => switchView("drivers")} className={`${styles.sidebarTab} ${view === "drivers" ? styles.sidebarTabActive : ""}`}>السائقون</button>
        <button onClick={() => switchView("requests")} className={`${styles.sidebarTab} ${view === "requests" ? styles.sidebarTabActive : ""}`}>
          طلبات الانضمام
          {pendingRequests > 0 ? <span style={badgeStyle}>{pendingRequests}</span> : null}
        </button>
        <button onClick={() => switchView("settings")} className={`${styles.sidebarTab} ${view === "settings" ? styles.sidebarTabActive : ""}`}>إعدادات الأدمن</button>
        <div style={{ marginTop: "auto" }}>
          <button onClick={logout} className={styles.sidebarTab} style={{ width: "100%", background: "#dc2626", color: "#fff", justifyContent: "center", borderColor: "#dc2626" }}>تسجيل الخروج</button>
        </div>
      </aside>

      <main className={styles.adminMain}>
        <div className={styles.mobileTopBar}>
          {!sidebarOpen ? <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>☰</button> : null}
          <strong>لوحة الأدمن</strong>
        </div>
        <div className={styles.stickyTop}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
            <StatCard title="عدد التجار" value={filteredLedger.length} />
            <StatCard title="عدد السائقين" value={driversFiltered.length} />
            <StatCard title="المستحق الكلي" value={asIqd(restaurantsDue)} accent />
            <StatCard title="طلبات الانضمام" value={pendingRequests} />
          </div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>المحافظة:</div>
            <select value={selectedProvince} onChange={(e) => setSelectedProvince(e.target.value)} style={{ minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
              <option value={ALL_PROVINCES}>الكل</option>
              {restaurantProvinces.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button onClick={updatePerOrderFee} style={{ marginInlineStart: "auto", background: "#111827", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px", fontWeight: 800 }}>
              تسعيرة الأدمن: {asIqd(perOrderFee)}
            </button>
          </div>
        </div>

        <div className={styles.contentArea}>
          {view === "restaurants" && (
            <div style={{ display: "grid", gap: 8 }}>
              {filteredLedger.map((r) => (
                <div key={r.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr auto", gap: 8, alignItems: "center" }}>
                    <div><strong>{r.name}</strong><div style={{ fontSize: 12, color: "#475569" }}>المالك: {r.owner_name || "-"}</div></div>
                    <div>{r.phone}</div>
                    <div>{r.province || "-"}</div>
                    <div style={{ fontSize: 12 }}>{r.address}</div>
                    <div style={{ fontWeight: 900, color: "#e31e24" }}>{asIqd(r.current_due)}</div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => openMap(r)} style={miniBtn("#111827", "#fff")}>الموقع</button>
                    <input
                      type="number"
                      min="0"
                      step="250"
                      placeholder="المبلغ المسدد"
                      value={payValues[r.id] ?? ""}
                      onChange={(e) => setPayValues((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ width: 150, borderRadius: 8, border: "1px solid #cbd5e1", padding: "7px 8px" }}
                    />
                    <button onClick={() => doAction(r.id, "pay")} style={miniBtn("#059669", "#fff")}>تسديد</button>
                    <button onClick={() => doAction(r.id, "remind")} style={miniBtn("#f59e0b", "#111")}>تنبيه</button>
                    <button onClick={() => doAction(r.id, "warn")} style={miniBtn(r.suspension_warning_at ? "#dc2626" : "#fb7185", "#fff")}>
                      {r.suspension_warning_at ? "إلغاء التحذير" : "تحذير"}
                    </button>
                    <button onClick={() => doAction(r.id, "suspend")} style={miniBtn(r.status === "suspended" ? "#2563eb" : "#dc2626", "#fff")}>
                      {r.status === "suspended" ? "إلغاء الغلق" : "غلق الحساب"}
                    </button>
                    <button onClick={() => doAction(r.id, "deleteRestaurant")} style={miniBtn("#7f1d1d", "#fff")}>حذف التاجر</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "drivers" && (
            <div style={{ display: "grid", gap: 8 }}>
              {driversFiltered.map((d) => (
                <div key={d.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center" }}>
                    <div><strong>{d.name}</strong></div>
                    <div>{d.phone || "-"}</div>
                    <div>{d.province || "-"}</div>
                    <div>{d.vehicle_type || "-"}</div>
                    <div>{d.vehicle_plate || "-"}</div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => doAction(d.id, driverActionKey(d, "24h"))}
                      style={miniBtn(d.account_status === "suspended" && d.suspension_reason === "24h" ? "#2563eb" : "#f59e0b", d.account_status === "suspended" && d.suspension_reason === "24h" ? "#fff" : "#111")}
                    >
                      {driverActionLabel(d, "24h")}
                    </button>
                    <button
                      onClick={() => doAction(d.id, driverActionKey(d, "72h"))}
                      style={miniBtn(d.account_status === "suspended" && d.suspension_reason === "72h" ? "#2563eb" : "#fb7185", "#fff")}
                    >
                      {driverActionLabel(d, "72h")}
                    </button>
                    <button onClick={() => doAction(d.id, driverActionKey(d, "manual"))} style={miniBtn(d.account_status === "suspended" && (!d.suspended_until || d.suspension_reason === "manual") ? "#2563eb" : "#dc2626", "#fff")}>
                      {driverActionLabel(d, "manual")}
                    </button>
                    <button onClick={() => doAction(d.id, "deleteDriver")} style={miniBtn("#7f1d1d", "#fff")}>حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "requests" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <strong>إعادة تعيين كلمة مرور مؤقتة</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <select value={tempReset.userType} onChange={(e) => setTempReset((p) => ({ ...p, userType: e.target.value }))} style={{ minWidth: 130, borderRadius: 8, border: "1px solid #cbd5e1", padding: "8px 10px" }}>
                    <option value="restaurant">تاجر</option>
                    <option value="driver">سائق</option>
                  </select>
                  <input value={tempReset.phone} onChange={(e) => setTempReset((p) => ({ ...p, phone: e.target.value }))} placeholder="رقم الهاتف المسجل" style={{ minWidth: 190, borderRadius: 8, border: "1px solid #cbd5e1", padding: "8px 10px" }} />
                  <input value={tempReset.tempPassword} onChange={(e) => setTempReset((p) => ({ ...p, tempPassword: e.target.value }))} placeholder="كلمة مرور مؤقتة" style={{ minWidth: 180, borderRadius: 8, border: "1px solid #cbd5e1", padding: "8px 10px" }} />
                  <button onClick={resetTempPassword} style={miniBtn("#111827", "#fff")}>حفظ</button>
                </div>
                {lookupUser ? (
                  <div style={{ marginTop: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", fontSize: 13, color: "#334155", display: "grid", gridTemplateColumns: tempReset.userType === "restaurant" ? "1fr 1fr 1fr 1fr 1.4fr" : "1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center" }}>
                    <div><b>الاسم:</b> {lookupUser.name || "-"}</div>
                    {tempReset.userType === "restaurant" ? <div><b>المالك:</b> {lookupUser.owner_name || "-"}</div> : <div><b>المركبة:</b> {lookupUser.vehicle_type || "-"}</div>}
                    <div><b>الهاتف:</b> {lookupUser.phone || "-"}</div>
                    <div><b>المحافظة:</b> {lookupUser.province || "-"}</div>
                    {tempReset.userType === "restaurant" ? <div><b>العنوان:</b> {lookupUser.address || "-"}</div> : <div><b>اللوحة:</b> {lookupUser.vehicle_plate || "-"}</div>}
                  </div>
                ) : null}
              </div>

              {requestsRows.map((x) => (
                <div key={`${x.t}-${x.id}`} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ alignSelf: "flex-start", background: x.t === "restaurant" ? "#dcfce7" : "#dbeafe", color: x.t === "restaurant" ? "#166534" : "#1e40af", border: `1px solid ${x.t === "restaurant" ? "#86efac" : "#93c5fd"}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>
                    {x.t === "restaurant" ? "تاجر" : "سائق"}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: "#334155" }}>
                    {x.t === "restaurant" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1.3fr 0.9fr", gap: 8, alignItems: "center" }}>
                        <div><strong>المتجر:</strong> {x.name || "-"}</div>
                        <div><strong>المالك:</strong> {x.owner_name || "-"}</div>
                        <div><strong>الهاتف:</strong> {x.phone || "-"}</div>
                        <div><strong>العنوان:</strong> {x.address || "-"}</div>
                        <div><strong>المحافظة:</strong> {x.province || "-"}</div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center" }}>
                        <div><strong>السائق:</strong> {x.name || "-"}</div>
                        <div><strong>الهاتف:</strong> {x.phone || "-"}</div>
                        <div><strong>المحافظة:</strong> {x.province || "-"}</div>
                        <div><strong>المركبة:</strong> {x.vehicle_type || "-"}</div>
                        <div><strong>اللوحة:</strong> {x.vehicle_plate || "-"}</div>
                      </div>
                    )}
                  </div>
                  {x.t === "restaurant" ? <button onClick={() => openMap(x)} style={miniBtn("#111827", "#fff")}>الموقع</button> : null}
                  <button onClick={async () => { await api.put(`/admin/approve/${x.t}/${x.id}`); await load(); }} style={miniBtn("#16a34a", "#fff")}>قبول</button>
                  <button onClick={async () => { await api.put(`/admin/reject/${x.t}/${x.id}`); await load(); }} style={miniBtn("#dc2626", "#fff")}>رفض</button>
                </div>
              ))}
            </div>
          )}

          {view === "settings" && (
            <div style={{ display: "grid", gap: 8 }}>
              <form
                onSubmit={async (e) => {
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
                  await Swal.fire({ icon: "success", title: "تم حفظ إعدادات الأدمن", confirmButtonColor: "#e31e24" });
                  await load();
                }}
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}
              >
                <strong>إعدادات الأدمن</strong>
                <input value={adminSettings.contact_phone} onChange={(e) => setAdminSettings((p) => ({ ...p, contact_phone: e.target.value }))} placeholder="رقم التواصل" style={adminInputStyle} />
                <input value={adminSettings.contact_whatsapp} onChange={(e) => setAdminSettings((p) => ({ ...p, contact_whatsapp: e.target.value }))} placeholder="رابط واتساب (wa.me)" style={adminInputStyle} />
                <input value={adminSettings.payment_master_card} onChange={(e) => setAdminSettings((p) => ({ ...p, payment_master_card: e.target.value }))} placeholder="رقم الماستر كارد" style={adminInputStyle} />
                <input value={adminSettings.payment_zain_cash} onChange={(e) => setAdminSettings((p) => ({ ...p, payment_zain_cash: e.target.value }))} placeholder="رقم زين كاش" style={adminInputStyle} />
                <input value={adminSettings.payment_asia_pay} onChange={(e) => setAdminSettings((p) => ({ ...p, payment_asia_pay: e.target.value }))} placeholder="رقم آسيا باي" style={adminInputStyle} />
                <textarea rows={6} value={adminSettings.policy_text} onChange={(e) => setAdminSettings((p) => ({ ...p, policy_text: e.target.value }))} placeholder="سياسة التطبيق" style={{ ...adminInputStyle, resize: "vertical" }} />
                <button type="submit" style={miniBtn("#111827", "#fff")}>حفظ إعدادات الأدمن</button>
              </form>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api.put("/admin/account", {
                    username: adminAccount.username,
                    password: adminAccount.password,
                  });
                  setAdminAccount((prev) => ({ ...prev, password: "" }));
                  await Swal.fire({ icon: "success", title: "تم تحديث بيانات دخول الأدمن", confirmButtonColor: "#e31e24" });
                  await load();
                }}
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}
              >
                <strong>بيانات دخول الأدمن</strong>
                <input value={adminAccount.username} onChange={(e) => setAdminAccount((p) => ({ ...p, username: e.target.value }))} placeholder="اسم مستخدم الأدمن" required style={adminInputStyle} />
                <input type="password" value={adminAccount.password} onChange={(e) => setAdminAccount((p) => ({ ...p, password: e.target.value }))} placeholder="كلمة مرور جديدة (اختياري)" style={adminInputStyle} />
                <button type="submit" style={miniBtn("#111827", "#fff")}>حفظ بيانات الدخول</button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, accent = false }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ color: "#64748b", fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent ? "#e31e24" : "#0f172a" }}>{value}</div>
    </div>
  );
}

function miniBtn(bg, color) {
  return {
    background: bg,
    color,
    border: 0,
    borderRadius: 8,
    padding: "7px 10px",
    fontWeight: 800,
    cursor: "pointer",
  };
}

const badgeStyle = {
  minWidth: 20,
  height: 20,
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  paddingInline: 6,
  fontWeight: 900,
};

const adminInputStyle = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  padding: "8px 10px",
  fontFamily: "inherit",
};
