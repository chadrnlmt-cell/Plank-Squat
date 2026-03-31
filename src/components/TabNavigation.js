// src/components/TabNavigation.js
import React from "react";

export default function TabNavigation({ activeTab, onTabChange, user }) {
  if (!user) return null;

  const ADMIN_EMAIL = "chadrnlmt@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const tabs = [
    { id: "available", label: "Available", icon: "🏆" },
    { id: "active", label: "Active", icon: "💪" },
    { id: "leaderboards", label: "Leaders", icon: "📊" },
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "challengeGuide", label: "Guide", icon: "ℹ️" },
  ];

  if (isAdmin) {
    tabs.push({ id: "admin", label: "Admin", icon: "⚙️" });
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.15)",
        display: "flex",
        justifyContent: "space-around",
        padding: "8px 0",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: activeTab === tab.id ? "#4a5568" : "#6b7280",
            fontWeight: activeTab === tab.id ? "600" : "400",
            transition: "color 0.2s",
          }}
        >
          <span style={{ fontSize: "20px", marginBottom: "4px" }}>
            {tab.icon}
          </span>
          <span style={{ fontSize: "12px" }}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
