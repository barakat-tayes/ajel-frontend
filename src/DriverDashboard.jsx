import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import api from "./api";
import { useAuth } from "./AuthContext";
import styles from "./DriverDashboard.module.css";
import { SOCKET_BASE_URL } from "./runtimeConfig";

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const toLocalDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  const asIqd = (value) =>
    `${Math.round(Number(value || 0)).toLocaleString("en-US")} د.ع`;

  const [availableOrders, setAvailableOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [stats, setStats] = useState({
    completedOrders: 0,
    completedAmount: 0,
    returnedOrders: 0,
    returnedAmount: 0,
  });
  const [filters, setFilters] = useState(() => {
    const t = toLocalDate(new Date());
    return { start_date: t, end_date: t };
  });
  const [quickRange, setQuickRange] = useState("today");

  const handleBlockedDriver = (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.error || error?.message || "";
    if (status === 403 && message) {
      navigate("/driver-suspended", { replace: true, state: { message } });
      return true;
    }
    return false;
  };

  const load = async () => {
    if (!filters.start_date || !filters.end_date) return;
    try {
      const cur = await api.get("/drivers/current-order");
      setCurrentOrder(cur.data);
      if (!cur.data) {
        const av = await api.get("/orders/available");
        setAvailableOrders(av.data || []);
      } else {
        setAvailableOrders([]);
      }
      const qs = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
      });
      const st = await api.get(`/drivers/stats?${qs.toString()}`);
      setStats(st.data || {});
    } catch (error) {
      if (handleBlockedDriver(error)) return;
      console.error(error);
    }
  };

  useEffect(() => {
    if (!filters.start_date || !filters.end_date) return;
    const s = io(SOCKET_BASE_URL);
    s.emit("join", {
      userType: "driver",
      userId: user.id,
      province: user.province,
    });

    [
      "new_order",
      "order_returned",
      "connect",
      "reconnect",
      "order_accepted",
      "order_picked_up",
      "order_delivered",
    ].forEach((e) => s.on(e, load));

    s.on("admin_driver_suspended", async (payload) => {
      const msg = payload?.message || "تم إيقاف حسابك من قبل إدارة التطبيق.";
      await Swal.fire({
        icon: "warning",
        title: "تم إيقاف الحساب",
        text: msg,
        confirmButtonColor: "#e31e24",
      });
      navigate("/driver-suspended", { replace: true, state: { message: msg } });
    });
    s.on("admin_driver_unsuspended", async () => {
      await Swal.fire({
        icon: "success",
        title: "تم تفعيل الحساب",
        text: "يمكنك متابعة العمل الآن",
        confirmButtonColor: "#16a34a",
      });
      load();
    });
    s.on("order_cancelled_by_restaurant", async ({ orderId }) => {
      const isCurrent =
        currentOrder && Number(currentOrder.id) === Number(orderId);
      setAvailableOrders((prev) =>
        (prev || []).filter((o) => Number(o.id) !== Number(orderId)),
      );
      setCurrentOrder((prev) =>
        prev && Number(prev.id) === Number(orderId) ? null : prev,
      );
      if (isCurrent) {
        await Swal.fire({
          icon: "info",
          title: "تنبيه",
          text: "تم إلغاء هذه الطلبية من قبل التاجر",
          confirmButtonColor: "#e31e24",
        });
      }
      load();
    });

    load();
    return () => s.close();
  }, [user.id, user.province, filters.start_date, filters.end_date]);

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

  const accept = async (id) => {
    try {
      await api.post(`/drivers/accept-order/${id}`);
    } catch (e) {
      await Swal.fire({
        icon: "info",
        title: "تنبيه",
        text: e?.message || "تم إلغاء هذه الطلبية من قبل التاجر",
        confirmButtonColor: "#e31e24",
      });
    }
    load();
  };
  const reject = async (id) => {
    const r = await Swal.fire({
      title: "رفض الطلب",
      text: "سيختفي هذا الطلب من قائمتك",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "تأكيد",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    await api.post(`/drivers/reject-order/${id}`);
    load();
  };

  const pickedUp = async (id) => {
    await api.put(`/drivers/order/${id}/picked-up`);
    load();
  };
  const cancelReservation = async (id) => {
    const r = await Swal.fire({
      title: "إلغاء التوصيل",
      text: "سيتم إلغاء حجزك لهذه الطلبية",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "تأكيد",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    await api.put(`/drivers/order/${id}/cancel-reservation`);
    load();
  };
  const markDelivered = async (id) => {
    await api.put(`/drivers/order/${id}/delivered`);
    load();
  };
  const markReturned = async (id) => {
    const r = await Swal.fire({
      title: "رفض استلام الطلب",
      text: "يرجى إرجاع الطلب إلى التاجر",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "متابعة",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    const got = await Swal.fire({
      title: "هل استلمت شيئًا من مبلغ التوصيل؟",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "نعم",
      cancelButtonText: "لا",
      confirmButtonColor: "#e31e24",
    });
    let fee = 0;
    if (got.isConfirmed) {
      const a = await Swal.fire({
        title: "اذكر المبلغ المستلم",
        input: "number",
        inputAttributes: { min: "0", step: "250" },
        showCancelButton: true,
        confirmButtonText: "حفظ",
        cancelButtonText: "إلغاء",
        confirmButtonColor: "#e31e24",
      });
      if (a.dismiss) return;
      fee = Number(a.value || 0);
    }
    await api.put(`/drivers/order/${id}/returned`, {
      collected_delivery_fee: fee,
    });
    load();
  };

  return (
    <div className={styles.driverDashboardContainer} dir="rtl">
      <div className={styles.stickyTop}>
        <div className={styles.dashboardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/icon-512.png"
              alt="Ajel Logo"
              className={styles.headerLogo}
            />
            <h2 className={styles.welcomeTitle}>السائق {user?.name}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate("/settings")}
              className={styles.acceptButton}
            >
              ⚙
            </button>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>مكتملة</div>
            <div className={styles.statValue}>{stats.completedOrders || 0}</div>
            <div className={styles.statAmount}>
              {asIqd(stats.completedAmount || 0)}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>راجعة</div>
            <div className={styles.statValue}>{stats.returnedOrders || 0}</div>
            <div className={styles.statAmount}>
              {asIqd(stats.returnedAmount || 0)}
            </div>
          </div>
        </div>

        <div className={styles.dateRangeWrap}>
          <input
            className={styles.dateInput}
            type="date"
            value={filters.start_date}
            onChange={(e) => {
              setFilters({ ...filters, start_date: e.target.value });
              setQuickRange("");
            }}
          />
          <input
            className={styles.dateInput}
            type="date"
            value={filters.end_date}
            onChange={(e) => {
              setFilters({ ...filters, end_date: e.target.value });
              setQuickRange("");
            }}
          />
        </div>
        <div className={styles.quickRow}>
          {[
            ["today", "هذا اليوم"],
            ["week", "هذا الأسبوع"],
            ["month", "هذا الشهر"],
            ["year", "هذا العام"],
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
      </div>

      {currentOrder ? (
        <div className={styles.currentOrderCard}>
          <div className={styles.currentOrderHeader}>
            <h3 className={styles.currentOrderTitle}>طلب جاري</h3>
            <span className={styles.currentOrderStatus}>
              {currentOrder.status === "accepted"
                ? "بانتظار الاستلام"
                : "قيد التنفيذ"}
            </span>
          </div>
          <div className={styles.currentOrderBody}>
            <div className={styles.orderBottomRow}>
              <p className={styles.address}>
                الزبون: {currentOrder.customer_name || "-"}
              </p>
              <p className={styles.address}>
                الهاتف: {currentOrder.customer_phone || "-"}
              </p>
            </div>
            <div className={styles.orderTopRow}>
              <p className={styles.deliveryFeeBadge}>
                الطلب {asIqd(currentOrder.order_amount)}
              </p>
              <p className={styles.deliveryFeeBadge}>
                التوصيل {asIqd(currentOrder.delivery_fee)}
              </p>
            </div>
            <div className={styles.orderBottomRow}>
              <p className={styles.address}>{currentOrder.customer_address}</p>
              <p className={styles.address}>
                النوع: {currentOrder.order_type || "-"}
              </p>
            </div>
            <div className={styles.orderThirdRow}>
              <a
                className={styles.mapIconBtn}
                href={
                  currentOrder.restaurant_location_link ||
                  (currentOrder.restaurant_location_lat &&
                  currentOrder.restaurant_location_lng
                    ? `https://maps.google.com/?q=${currentOrder.restaurant_location_lat},${currentOrder.restaurant_location_lng}`
                    : `https://maps.google.com/?q=${encodeURIComponent(
                        currentOrder.restaurant_name || "restaurant",
                      )}`)
                }
                target="_blank"
                rel="noreferrer"
              >
                📍
              </a>
              <p className={styles.restaurantHint}>
                {currentOrder.restaurant_name}
              </p>
            </div>
          </div>
          <div
            className={`${styles.currentOrderActions} ${
              currentOrder.status === "accepted"
                ? styles.currentOrderActionsAccepted
                : styles.currentOrderActionsThree
            }`}
          >
            {currentOrder.status === "accepted" ? (
              <>
                <button
                  className={styles.pickupBtn}
                  onClick={() => pickedUp(currentOrder.id)}
                >
                  استلام من التاجر
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => cancelReservation(currentOrder.id)}
                >
                  إلغاء التوصيل
                </button>
              </>
            ) : (
              <>
                <a
                  href={`tel:${String(
                    currentOrder.customer_phone || "",
                  ).replace(/\s+/g, "")}`}
                  className={styles.callBtn}
                >
                  📞
                </a>
                <button
                  className={styles.acceptPillBtn}
                  onClick={() => markDelivered(currentOrder.id)}
                >
                  تم تسليم الطلب
                </button>
                <button
                  className={styles.rejectWideBtn}
                  onClick={() => markReturned(currentOrder.id)}
                >
                  رفض استلام الطلب
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.availableOrdersSection}>
          <h3 className={styles.availableOrdersTitle}>
            الطلبات المتاحة
            <span
              style={{
                marginInlineStart: 8,
                background: "#fee2e2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: 999,
                fontSize: ".76rem",
                fontWeight: 900,
                padding: "2px 9px",
              }}
            >
              {availableOrders.length}
            </span>
          </h3>
          <div className={styles.availableOrdersGrid}>
            {availableOrders.map((o) => (
              <div key={o.id} className={styles.availableOrderCard}>
                <div className={styles.availableOrderContent}>
                  <div className={styles.orderActionsColumn}>
                    <button
                      className={styles.acceptPillBtn}
                      onClick={() => accept(o.id)}
                      title="قبول"
                      aria-label="قبول"
                    />
                    <button
                      className={styles.rejectIconBtn}
                      onClick={() => reject(o.id)}
                      title="رفض"
                      aria-label="رفض"
                    />
                  </div>
                  <div className={styles.availableOrderBody}>
                    <div className={styles.availableOrderRestaurantBar}>
                      <span className={styles.restaurantBarName}>
                        {o.restaurant_name || "-"}
                      </span>
                      <a
                        className={`${styles.mapIconBtn} ${styles.restaurantMapBtn}`}
                        href={
                          o.restaurant_location_link ||
                          (o.restaurant_location_lat &&
                          o.restaurant_location_lng
                            ? `https://maps.google.com/?q=${o.restaurant_location_lat},${o.restaurant_location_lng}`
                            : `https://maps.google.com/?q=${encodeURIComponent(
                                o.restaurant_name || "restaurant",
                              )}`)
                        }
                        target="_blank"
                        rel="noreferrer"
                        title="موقع المطعم"
                      >
                        📍
                      </a>
                    </div>
                    <div className={styles.orderTopRow}>
                      <p className={styles.deliveryFeeBadge}>
                        الطلب {asIqd(o.order_amount)}
                      </p>
                      <p className={styles.deliveryFeeBadge}>
                        التوصيل {asIqd(o.delivery_fee)}
                      </p>
                    </div>
                    <div className={styles.orderBottomRow}>
                      <p className={styles.address}>
                        العنوان: {o.customer_address || "-"}
                      </p>
                      <p className={styles.address}>الطلبية: {o.order_type || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
