import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import api from "./api";
import { useAuth } from "./AuthContext";
import styles from "./RestaurantDashboard.module.css";
import { SOCKET_BASE_URL } from "./runtimeConfig";
import { showSystemNotification } from "./notifications";

const toLocalDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
const today = toLocalDate(new Date());
const asIqd = (value) =>
  `${Math.round(Number(value || 0)).toLocaleString("en-US")} د.ع`;
const asTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
};

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [pendingLiveOrders, setPendingLiveOrders] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [tab, setTab] = useState("new");
  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
  });
  const [quickRange, setQuickRange] = useState("today");
  const [warningBar, setWarningBar] = useState("");
  const [dueSummary, setDueSummary] = useState({
    due_amount: 0,
    completed_count: 0,
  });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    order_type: "",
    order_amount: "",
    delivery_fee: "",
  });

  const loadOrders = async () => {
    const qs = new URLSearchParams({
      start_date: filters.start_date || today,
      end_date: filters.end_date || today,
    });
    const [res, pendingRes] = await Promise.all([
      api.get(`/restaurants/orders?${qs.toString()}`),
      api.get("/restaurants/orders?status=pending"),
    ]);
    setOrders(Array.isArray(res.data) ? res.data : []);
    setPendingLiveOrders(Array.isArray(pendingRes.data) ? pendingRes.data : []);
  };

  const loadTracking = async () => {
    const res = await api.get("/restaurants/active-order-tracking");
    setTracking(Array.isArray(res.data) ? res.data : []);
  };

  const loadDueSummary = async () => {
    try {
      const res = await api.get("/restaurants/due-summary");
      setDueSummary(res.data || { due_amount: 0, completed_count: 0 });
    } catch {
      setDueSummary({ due_amount: 0, completed_count: 0 });
    }
  };

  const loadProfileFlags = async () => {
    const p = await api.get("/restaurants/profile");
    if (p?.data?.status === "suspended") {
      navigate("/restaurant-suspended", { replace: true });
      return;
    }
    setWarningBar(
      p?.data?.suspension_warning_at
        ? "تحذير من الإدارة: قد يتم غلق الحساب لعدم تسديد المستحقات"
        : "",
    );
  };

  useEffect(() => {
    const run = async () => {
      try {
        setNetworkError("");
        await Promise.all([
          loadOrders(),
          loadTracking(),
          loadDueSummary(),
          loadProfileFlags(),
        ]);
      } catch (e) {
        setNetworkError(
          "تعذر الاتصال بالخادم مؤقتًا. سيتم إعادة المحاولة تلقائيًا.",
        );
      }
    };
    run();
  }, [filters.start_date, filters.end_date]);

  useEffect(() => {
    if (!networkError) return undefined;
    const t = setTimeout(async () => {
      try {
        await Promise.all([
          loadOrders(),
          loadTracking(),
          loadDueSummary(),
          loadProfileFlags(),
        ]);
        setNetworkError("");
      } catch {}
    }, 2500);
    return () => clearTimeout(t);
  }, [networkError]);

  useEffect(() => {
    if (!user?.id) return;
    const s = io(SOCKET_BASE_URL);
    const refreshAll = () =>
      Promise.all([loadOrders(), loadTracking(), loadDueSummary(), loadProfileFlags()]).catch(() => {});
    s.emit("join", { userType: "restaurant", userId: user.id });
    s.on("connect", refreshAll);
    s.on("reconnect", refreshAll);
    s.on("order_accepted", async (payload) => {
      await Promise.all([loadOrders(), loadTracking(), loadDueSummary()]);
      showOrderAcceptedToast(payload);
    });
    [
      "order_picked_up",
      "order_delivered",
      "order_returned",
      "new_order",
    ].forEach((evt) => {
      s.on(evt, () => {
        loadOrders();
        loadTracking();
        loadDueSummary();
      });
    });
    s.on("admin_payment_reminder", (payload) => {
      Swal.fire({
        icon: "info",
        title: "تنبيه من الإدارة",
        text: payload?.message || "يرجى تسديد المستحقات",
        confirmButtonColor: "#e31e24",
      });
    });
    s.on("admin_suspension_warning", (payload) => {
      setWarningBar(
        payload?.message ||
          "تحذير من الإدارة: قد يتم غلق الحساب لعدم تسديد المستحقات",
      );
    });
    s.on("admin_clear_warnings", () => {
      setWarningBar("");
      loadProfileFlags();
      loadDueSummary();
    });
    s.on("admin_account_suspended", () => loadProfileFlags());
    const intervalId = setInterval(refreshAll, 12000);
    return () => {
      clearInterval(intervalId);
      s.close();
    };
  }, [user?.id]);

  const applyQuickRange = (type) => {
    const now = new Date();
    const end = toLocalDate(now);
    const startDate = new Date(now);
    if (type === "week") startDate.setDate(now.getDate() - 6);
    else if (type === "month") startDate.setDate(now.getDate() - 29);
    else if (type === "year") startDate.setDate(now.getDate() - 364);
    const start = type === "today" ? end : toLocalDate(startDate);
    setFilters({ start_date: start, end_date: end });
    setQuickRange(type);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    try {
      await api.post("/orders", form);
      await Swal.fire({
        icon: "success",
        title: "تم إرسال الطلبية",
        confirmButtonColor: "#e31e24",
      });
      setForm({
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        order_type: "",
        order_amount: "",
        delivery_fee: "",
      });
      await loadOrders();
      setTab("pending");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const cancelPendingOrder = async (id) => {
    const r = await Swal.fire({
      title: "إلغاء الطلبية",
      text: "سيتم حذف الطلبية نهائيًا من القوائم والإحصائيات",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "تأكيد الإلغاء",
      cancelButtonText: "تراجع",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    await api.delete(`/restaurants/orders/${id}`);
    await Swal.fire({
      icon: "success",
      title: "تم إلغاء الطلبية",
      confirmButtonColor: "#e31e24",
    });
    await loadOrders();
    await loadDueSummary();
  };

  const showDriverInfo = async (order) => {
    const phone = String(order?.driver_phone || "").trim();
    const tel = phone ? `tel:${phone.replace(/\s+/g, "")}` : "";
    await Swal.fire({
      title: "معلومات السائق",
      icon: "info",
      confirmButtonColor: "#e31e24",
      confirmButtonText: "إغلاق",
      html: `
        <div style="text-align:right;line-height:1.9">
          <div><b>الاسم:</b> ${order?.driver_name || "-"}</div>
          <div><b>المركبة:</b> ${order?.vehicle_type || "-"}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px">
            <span><b>الهاتف:</b> ${phone || "-"}</span>
            ${
              tel
                ? `<a href="${tel}" style="background:#16a34a;color:#fff;text-decoration:none;padding:7px 10px;border-radius:8px;font-weight:700">📞 اتصال</a>`
                : ""
            }
          </div>
        </div>
      `,
    });
  };

  const showOrderAcceptedToast = async (payload) => {
    const orderId = Number(payload?.orderId || 0);
    if (!orderId) return;

    let order = null;
    try {
      const res = await api.get(`/orders/${orderId}`);
      order = res?.data || null;
    } catch {
      order = null;
    }

    const driverName = payload?.driverName || order?.driver_name || "-";
    const driverPhone = payload?.driverPhone || order?.driver_phone || "-";
    const customerName = order?.customer_name || "-";
    const orderType = order?.order_type || "طلب";
    const orderAmount = asIqd(order?.order_amount || 0);
    const deliveryAmount = asIqd(order?.delivery_fee || 0);
    await showSystemNotification("تم قبول طلبية", {
      body: `${customerName} | ${orderType} | الطلب ${orderAmount} | التوصيل ${deliveryAmount} | السائق: ${driverName}`,
      tag: `order-accepted-${orderId}`,
    });

    await Swal.fire({
      toast: true,
      position: "top-end",
      timer: 5200,
      timerProgressBar: true,
      showConfirmButton: false,
      icon: "success",
      title: "تم قبول طلبية من قبل سائق",
      html: `
        <div style="text-align:right;line-height:1.7">
          <div><b>الزبون:</b> ${customerName}</div>
          <div><b>الطلب:</b> ${orderType} | <b>المبلغ:</b> ${orderAmount} | <b>التوصيل:</b> ${deliveryAmount}</div>
          <div><b>👤 السائق:</b> ${driverName} (${driverPhone})</div>
          <div style="font-size:.82rem;color:#64748b">معلومات السائق الكاملة موجودة داخل زر 👤 في الطلبات النشطة</div>
        </div>
      `,
    });
  };

  const pendingOrders = useMemo(() => pendingLiveOrders, [pendingLiveOrders]);
  const activeOrders = useMemo(
    () => orders.filter((o) => ["accepted", "picked_up"].includes(o.status)),
    [orders],
  );
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === "delivered"),
    [orders],
  );
  const returnedOrders = useMemo(
    () => orders.filter((o) => o.status === "returned"),
    [orders],
  );
  const sumAmounts = (arr) =>
    arr.reduce((acc, o) => acc + Number(o?.order_amount || 0), 0);

  const stats = useMemo(
    () => ({
      pendingCount: pendingOrders.length,
      pendingAmount: sumAmounts(pendingOrders),
      activeCount: activeOrders.length,
      activeAmount: sumAmounts(activeOrders),
      completedCount: completedOrders.length,
      completedAmount: sumAmounts(completedOrders),
      returnedCount: returnedOrders.length,
      returnedAmount: sumAmounts(returnedOrders),
    }),
    [pendingOrders, activeOrders, completedOrders, returnedOrders],
  );

  const viewOrders =
    tab === "pending"
      ? pendingOrders
      : tab === "active"
      ? tracking
      : completedOrders;

  return (
    <div className={styles.restaurantDashboardContainer} dir="rtl">
      <div className={styles.pageShell}>
        <div className={styles.dashboardHeader}>
          <div className={styles.headerSideRight}>
            <img
              src="/icon-512.png"
              alt="Ajel Logo"
              className={styles.headerLogo}
            />
          </div>
          <h1 className={styles.headerCenterTitle}>{user?.name}</h1>
          <div className={styles.headerSideLeft}>
            <button
              onClick={() => navigate("/settings")}
              className={styles.logoutButton}
            >
              ⚙
            </button>
          </div>
        </div>

        {networkError ? (
          <div
            className={styles.warningBar}
            style={{
              background: "#fff1f2",
              color: "#b91c1c",
              border: "1px solid #fecdd3",
            }}
          >
            {networkError}
          </div>
        ) : null}
        {warningBar ? (
          <div className={styles.warningBar}>{warningBar}</div>
        ) : null}

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>معلقة</div>
            <div className={styles.summaryValue}>{stats.pendingCount}</div>
            <div className={styles.summaryAmount}>
              {asIqd(stats.pendingAmount)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>نشطة</div>
            <div className={styles.summaryValue}>{stats.activeCount}</div>
            <div className={styles.summaryAmount}>
              {asIqd(stats.activeAmount)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>مكتملة</div>
            <div className={styles.summaryValue}>{stats.completedCount}</div>
            <div className={styles.summaryAmount}>
              {asIqd(stats.completedAmount)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>راجعة</div>
            <div className={styles.summaryValue}>{stats.returnedCount}</div>
            <div className={styles.summaryAmount}>
              {asIqd(stats.returnedAmount)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>المستحق</div>
            <div className={styles.summaryValue}>
              {dueSummary.completed_count || 0}
            </div>
            <div className={styles.summaryAmount}>
              {asIqd(dueSummary.due_amount || 0)}
            </div>
          </div>
        </div>

        <div className={styles.dateRangeWrap}>
          <input
            className={styles.formInput}
            type="date"
            value={filters.start_date}
            onChange={(e) =>
              setFilters({ ...filters, start_date: e.target.value || today })
            }
          />
          <input
            className={styles.formInput}
            type="date"
            value={filters.end_date}
            onChange={(e) =>
              setFilters({ ...filters, end_date: e.target.value || today })
            }
          />
        </div>
        <div className={styles.quickRow}>
          {[
            ["today", "اليوم"],
            ["week", "الأسبوع"],
            ["month", "الشهر"],
            ["year", "السنة"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={`${styles.quickBtn} ${
                quickRange === k ? styles.quickBtnActive : ""
              }`}
              onClick={() => applyQuickRange(k)}
            >
              {l}
            </button>
          ))}
        </div>

        <div className={styles.tabsContainer}>
          <button
            onClick={() => setTab("new")}
            className={`${styles.tabButton} ${
              tab === "new" ? styles.tabButtonActive : ""
            }`}
          >
            إضافة طلب
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`${styles.tabButton} ${
              tab === "pending" ? styles.tabButtonActive : ""
            }`}
          >
            معلقة
          </button>
          <button
            onClick={() => setTab("active")}
            className={`${styles.tabButton} ${
              tab === "active" ? styles.tabButtonActive : ""
            }`}
          >
            نشطة
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`${styles.tabButton} ${
              tab === "completed" ? styles.tabButtonActive : ""
            }`}
          >
            مكتملة
          </button>
        </div>

        {tab === "new" && (
          <form onSubmit={submit} className={styles.orderFormCard}>
            <div className={styles.filterRow}>
              <input
                className={styles.formInput}
                placeholder="اسم الزبون"
                value={form.customer_name}
                onChange={(e) =>
                  setForm({ ...form, customer_name: e.target.value })
                }
                required
              />
              <input
                className={styles.formInput}
                placeholder="رقم الزبون"
                value={form.customer_phone}
                onChange={(e) =>
                  setForm({ ...form, customer_phone: e.target.value })
                }
                required
              />
            </div>
            <input
              className={styles.formInput}
              placeholder="العنوان الدقيق"
              value={form.customer_address}
              onChange={(e) =>
                setForm({ ...form, customer_address: e.target.value })
              }
              required
            />
            <div className={styles.filterRow}>
              <input
                className={styles.formInput}
                placeholder="نوع الطلب (مثال: دجاج)"
                value={form.order_type}
                onChange={(e) =>
                  setForm({ ...form, order_type: e.target.value })
                }
                required
              />
              <input
                className={styles.formInput}
                type="number"
                placeholder="سعر الطلب"
                value={form.order_amount}
                onChange={(e) =>
                  setForm({ ...form, order_amount: e.target.value })
                }
                required
              />
            </div>
            <input
              className={styles.formInput}
              type="number"
              placeholder="سعر التوصيل"
              value={form.delivery_fee}
              onChange={(e) =>
                setForm({ ...form, delivery_fee: e.target.value })
              }
              required
            />
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmittingOrder}
              style={{
                opacity: isSubmittingOrder ? 0.7 : 1,
                cursor: isSubmittingOrder ? "not-allowed" : "pointer",
              }}
            >
              {isSubmittingOrder ? "جارٍ الإرسال..." : "إرسال الطلبية"}
            </button>
          </form>
        )}

        {tab !== "new" && (
          <div className={styles.ordersList}>
            {viewOrders.map((o) => (
              <div key={o.id} className={styles.orderStrip}>
                <div className={styles.stripMain}>
                  <div>
                    <div className={styles.line1}>
                      {o.customer_name} | {o.order_type || "طلب"} | الطلب:{" "}
                      {asIqd(o.order_amount)} | التوصيل:{" "}
                      {asIqd(o.delivery_fee || 0)}
                    </div>
                    <div className={styles.line2}>
                      {o.customer_address || "-"} | وقت الرفع:{" "}
                      {asTime(o.created_at || o.accepted_at || o.updated_at)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    {o.driver_id ? (
                      <button
                        onClick={() => showDriverInfo(o)}
                        title="معلومات السائق"
                        style={{
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          color: "#0f172a",
                          borderRadius: 10,
                          padding: "8px 10px",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        👤
                      </button>
                    ) : null}
                    {tab === "pending" ? (
                      <button
                        onClick={() => cancelPendingOrder(o.id)}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fee2e2",
                          color: "#b91c1c",
                          borderRadius: 10,
                          padding: "5px 7px",
                          fontWeight: 800,
                          fontSize: ".66rem",
                          cursor: "pointer",
                        }}
                      >
                        إلغاء الطلبية
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
