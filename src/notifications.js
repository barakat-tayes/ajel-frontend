import api from "./api";
const NOTIFICATIONS_KEY = "ajel_notifications_enabled";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isNotificationsEnabled() {
  if (typeof localStorage === "undefined") return true;
  const v = localStorage.getItem(NOTIFICATIONS_KEY);
  return v === null ? true : v === "1";
}

export function setNotificationsEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_KEY, enabled ? "1" : "0");
}

export async function ensureNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function showSystemNotification(title, options = {}) {
  if (!notificationsSupported()) return false;
  if (!isNotificationsEnabled()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          dir: "rtl",
          lang: "ar",
          ...options,
        });
        return true;
      }
    }
    // eslint-disable-next-line no-new
    new Notification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "ar",
      ...options,
    });
    return true;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushSubscription() {
  if (!notificationsSupported()) return false;
  if (!isNotificationsEnabled()) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const keyRes = await api.get("/push/public-key");
  const publicKey = keyRes?.data?.publicKey;
  const enabled = Boolean(keyRes?.data?.enabled);
  if (!enabled || !publicKey) return false;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.post("/push/subscribe", { subscription: subscription.toJSON() });
  return true;
}

export async function unregisterPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return true;
  try {
    await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
  } catch {}
  await subscription.unsubscribe();
  return true;
}
