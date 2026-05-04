import { API_BASE_URL } from "./runtimeConfig";

const apiFetch = async(url, options = {}) => {
    const token = localStorage.getItem("token");
    const method = options.method || "GET";
    const headers = new Headers(options.headers || {});

    if (token) headers.set("Authorization", `Bearer ${token}`);

    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body === "object") {
        if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        body = JSON.stringify(body);
    }

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
        const err = new Error((data && data.error) || data || "Request failed");
        err.response = { data, status: response.status };
        throw err;
    }

    return { data, status: response.status };
};

const syncPending = async() => ({ synced: 0, left: 0 });
const getPendingCount = () => 0;

const api = {
    get: (url, config = {}) => apiFetch(url, {...config, method: "GET" }),
    post: (url, data, config = {}) => apiFetch(url, {...config, method: "POST", body: data }),
    put: (url, data, config = {}) => apiFetch(url, {...config, method: "PUT", body: data }),
    delete: (url, config = {}) => apiFetch(url, {...config, method: "DELETE" }),
    syncPending,
    getPendingCount,
};

window.addEventListener("online", () => {
    api.syncPending();
});

export default api;
