import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import RestaurantDashboard from "./RestaurantDashboard.jsx";
import DriverDashboard from "./DriverDashboard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import SettingsPage from "./SettingsPage.jsx";
import AboutPolicyPage from "./AboutPolicyPage.jsx";
import ContactPage from "./ContactPage.jsx";
import RestaurantSuspendedPage from "./RestaurantSuspendedPage.jsx";
import DriverSuspendedPage from "./DriverSuspendedPage.jsx";
import { useEffect, useState } from "react";
import io from "socket.io-client";
import { SOCKET_BASE_URL } from "./runtimeConfig";

function Guard({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.userType !== role) {
    if (user.userType === "admin") return <Navigate to="/admin" replace />;
    if (user.userType === "restaurant")
      return <Navigate to="/restaurant" replace />;
    return <Navigate to="/driver" replace />;
  }
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.userType === "admin") return <Navigate to="/admin" replace />;
  if (user.userType === "restaurant")
    return <Navigate to="/restaurant" replace />;
  return <Navigate to="/driver" replace />;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  if (user.userType === "admin") return <Navigate to="/admin" replace />;
  if (user.userType === "restaurant")
    return <Navigate to="/restaurant" replace />;
  return <Navigate to="/driver" replace />;
}

function InstallPromptBar() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => {
    try {
      return localStorage.getItem("ajel_app_installed") === "1";
    } catch {
      return false;
    }
  });
  const ua = window.navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOSSafari = isIOS && isSafari;

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      setInstalled(true);
      try {
        localStorage.setItem("ajel_app_installed", "1");
      } catch {}
    }

    const onBefore = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.setItem("ajel_app_installed", "1");
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!user || installed) return null;

  const isSmallScreen = window.innerWidth <= 520;
  const barStyle = {
    position: "fixed",
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 9999,
    background: "#111",
    color: "#fff",
    padding: isSmallScreen ? "8px 10px" : "10px 12px",
    borderRadius: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  };
  const textStyle = {
    fontWeight: 700,
    fontSize: isSmallScreen ? "12px" : "14px",
    lineHeight: 1.45,
    flex: 1,
  };

  if (isIOSSafari) {
    return (
      <div style={barStyle}>
        <span style={textStyle}>
          لتثبيت التطبيق على iPhone: اضغط زر المشاركة في Safari ثم اختر اضافة
          الى الشاشة الرئيسية
        </span>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div style={barStyle}>
      <span style={textStyle}>ثبّت تطبيق عاجل على جهازك لتجربة أسرع</span>
      <button
        style={{
          background: "#e31e24",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          padding: isSmallScreen ? "7px 10px" : "8px 12px",
          fontWeight: 800,
          fontSize: isSmallScreen ? "12px" : "14px",
        }}
        onClick={async () => {
          try {
            if (deferredPrompt && typeof deferredPrompt.prompt === "function") {
              deferredPrompt.prompt();
              if (deferredPrompt.userChoice) {
                await deferredPrompt.userChoice;
              }
            }
          } catch (e) {
            // ignore unsupported/expired prompt object errors on some mobile browsers
          } finally {
            setDeferredPrompt(null);
          }
        }}
      >
        تثبيت
      </button>
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="splashOverlay" dir="rtl">
      <div className="splashCenter">
        <div className="splashLogoRing">
          <img src="/icon-512.png" alt="Ajel Logo" className="splashLogoImg" />
        </div>
      </div>
    </div>
  );
}

function SessionSocketBridge() {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user?.id || !user?.userType) return undefined;
    const s = io(SOCKET_BASE_URL);
    s.emit("join", {
      userType: user.userType,
      userId: user.id,
      province: user.province || undefined,
    });
    s.on("account_deleted", () => logout());
    return () => s.close();
  }, [user?.id, user?.userType, user?.province, logout]);

  return null;
}

function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    const onPending = (e) => setPendingCount(Number(e?.detail?.count || 0));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("api:pending", onPending);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("api:pending", onPending);
    };
  }, []);

  if (!(isOffline && pendingCount > 0)) return null;
  return (
    <div className="offlineOverlay" dir="rtl">
      <div className="offlineCard">
        <span className="loader" />
        <div className="offlineTitle">لا يوجد اتصال بالإنترنت</div>
        <div className="offlineSub">بانتظار عودة الشبكة...</div>
      </div>
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const suppressNetworkOverlay = (message) =>
      /Failed to fetch|NetworkError|Load failed|load faild/i.test(
        String(message || ""),
      );
    const onUnhandledRejection = (event) => {
      const msg = event?.reason?.message || event?.reason;
      if (suppressNetworkOverlay(msg)) event.preventDefault();
    };
    const onGlobalError = (event) => {
      const msg = event?.message || "";
      if (suppressNetworkOverlay(msg)) {
        event.preventDefault();
        return false;
      }
      return undefined;
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onGlobalError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onGlobalError);
    };
  }, []);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isIOSSafari = isIOS && isSafari;
    if (!isIOSSafari) return undefined;

    const onError = (event) => {
      const msg = String(event?.message || "");
      if (msg.toLowerCase().includes("script error")) {
        event.preventDefault();
      }
    };
    const onRejection = (event) => {
      const reason = event?.reason || {};
      const name = String(reason?.name || "");
      const message = String(reason?.message || "");
      if (name === "AbortError" || message.toLowerCase().includes("abort")) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true;
    if (!isStandalone) return undefined;

    let startX = 0;
    let startY = 0;
    const EDGE = 24;
    const SWIPE_DISTANCE = 40;
    const VERTICAL_TOLERANCE = 28;

    const onTouchStart = (e) => {
      if (!e.touches || !e.touches.length) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (!e.touches || !e.touches.length) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - startX;
      const dy = y - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const nearLeftEdge = startX <= EDGE;
      const nearRightEdge = startX >= window.innerWidth - EDGE;
      const horizontalGesture =
        absDx > SWIPE_DISTANCE && absDy < VERTICAL_TOLERANCE;

      if (
        horizontalGesture &&
        ((nearLeftEdge && dx > 0) || (nearRightEdge && dx < 0))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <SessionSocketBridge />
        <OfflineOverlay />
        {showSplash ? <SplashScreen /> : null}
        <InstallPromptBar />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <Register />
              </PublicOnly>
            }
          />
          <Route
            path="/restaurant"
            element={
              <Guard role="restaurant">
                <RestaurantDashboard />
              </Guard>
            }
          />
          <Route
            path="/restaurant-suspended"
            element={
              <Guard role="restaurant">
                <RestaurantSuspendedPage />
              </Guard>
            }
          />
          <Route
            path="/driver"
            element={
              <Guard role="driver">
                <DriverDashboard />
              </Guard>
            }
          />
          <Route
            path="/driver-suspended"
            element={
              <Guard role="driver">
                <DriverSuspendedPage />
              </Guard>
            }
          />
          <Route
            path="/admin"
            element={
              <Guard role="admin">
                <AdminDashboard />
              </Guard>
            }
          />
          <Route
            path="/settings"
            element={
              <Guard>
                <SettingsPage />
              </Guard>
            }
          />
          <Route
            path="/about-policy"
            element={
              <Guard>
                <AboutPolicyPage />
              </Guard>
            }
          />
          <Route
            path="/contact"
            element={
              <Guard>
                <ContactPage />
              </Guard>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
