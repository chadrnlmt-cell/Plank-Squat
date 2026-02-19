// src/components/TabNavigation.js
import React from "react";

export default function TabNavigation({ activeTab, onTabChange, user }) {
  const ADMIN_EMAIL = "chadrnlmt@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;
  console.log("ADMIN CHECK", user?.email, ADMIN_EMAIL, isAdmin);

  const tabs = [
    { id: "available", label: "Available", icon: "🏆" },
    { id: "active", label: "Active", icon: "💪" },
    { id: "leaderboards", label: "Leaders", icon: "📊" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  // Always show admin tab (access control is in AdminPanel.js)
  tabs.push({ id: "admin", label: "Admin", icon: "⚙️" });

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        justifyContent: "space-around",
        padding: "8px 0",
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
            color:
              activeTab === tab.id
                ? "var(--color-primary)"
                : "var(--color-text-secondary)",
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
