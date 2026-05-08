import { API_BASE_URL } from "./runtimeConfig";

let refreshPromise = null;
let inFlightRequests = 0;
const emitPending = () => {
  window.dispatchEvent(
    new CustomEvent("api:pending", { detail: { count: inFlightRequests } }),
  );
};

const tryRefreshToken = async () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) throw new Error("No token");
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ token: currentToken }),
      credentials: "include",
    });
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();
    if (!response.ok || !data?.token) {
      throw new Error((data && data.error) || "Refresh failed");
    }
    localStorage.setItem("token", data.token);
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
    return data.token;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const apiFetch = async (url, options = {}, isRetry = false) => {
  const token = localStorage.getItem("token");
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});

  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  inFlightRequests += 1;
  emitPending();
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      method,
      headers,
      body,
      credentials: "include",
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const isAuthEndpoint =
        url.startsWith("/auth/login") || url.startsWith("/auth/refresh");
      if (response.status === 401 && !isRetry && !isAuthEndpoint) {
        try {
          await tryRefreshToken();
          return apiFetch(url, options, true);
        } catch {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          if (window.location.pathname !== "/login")
            window.location.href = "/login";
        }
      }
      const err = new Error((data && data.error) || data || "Request failed");
      err.response = { data, status: response.status };
      throw err;
    }

    return { data, status: response.status };
  } catch (error) {
    const isNetworkError =
      error instanceof TypeError ||
      /Failed to fetch|NetworkError|Load failed|load faild/i.test(
        String(error?.message || ""),
      );
    if (isNetworkError) {
      window.dispatchEvent(
        new CustomEvent("api:network-failure", {
          detail: { at: Date.now(), message: String(error?.message || "") },
        }),
      );
    }
    throw error;
  } finally {
    inFlightRequests = Math.max(0, inFlightRequests - 1);
    emitPending();
  }
};

const syncPending = async () => ({ synced: 0, left: 0 });
const getPendingCount = () => 0;

const api = {
  get: (url, config = {}) => apiFetch(url, { ...config, method: "GET" }),
  post: (url, data, config = {}) =>
    apiFetch(url, { ...config, method: "POST", body: data }),
  put: (url, data, config = {}) =>
    apiFetch(url, { ...config, method: "PUT", body: data }),
  delete: (url, config = {}) => apiFetch(url, { ...config, method: "DELETE" }),
  syncPending,
  getPendingCount,
};

window.addEventListener("online", () => {
  api.syncPending();
});

export default api;
