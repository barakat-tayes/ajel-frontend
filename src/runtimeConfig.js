const host = window.location.hostname || "localhost";

const trim = (v = "") => String(v).replace(/\/+$/, "");

export const API_BASE_URL = process.env.REACT_APP_API_URL
  ? trim(process.env.REACT_APP_API_URL)
  : `http://${host}:5000/api`;

export const SOCKET_BASE_URL = process.env.REACT_APP_SOCKET_URL
  ? trim(process.env.REACT_APP_SOCKET_URL)
  : `http://${host}:5000`;

