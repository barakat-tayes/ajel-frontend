import React, { createContext, useContext, useState } from "react";
import api from "./api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const getTokenPayload = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = token.split(".")[1];
      if (!payload) return null;
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    const payload = getTokenPayload();
    if (!parsedUser || !payload) return null;
    if (parsedUser.id !== payload.id || parsedUser.userType !== payload.userType) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return null;
    }
    return parsedUser;
  });

  const login = async (identifier, password, userType) => {
    try {
      const payload = { username: identifier, password, userType };
      const res = await api.post("/auth/login", payload);
      const { token, user: userData } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      return userData;
    } catch (error) {
      console.error("Login error:", error);
      const message = error.response?.data?.error || error.message || "حدث خطأ";
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
