import React from "react";

export default function TabNavigation({ activeTab, onTabChange, user }) {
  if (!user) return null;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: "1px solid #ddd",
        backgroundColor: "white",
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 0",
        zIndex: 100,
      }}
    >
      <button
        onClick={() => onTabChange("available")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: activeTab === "available" ? "#1976d2" : "#666",
          fontWeight: activeTab === "available" ? "bold" : "normal",
        }}
      >
        Available
      </button>
      <button
        onClick={() => onTabChange("active")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: activeTab === "active" ? "#1976d2" : "#666",
          fontWeight: activeTab === "active" ? "bold" : "normal",
        }}
      >
        Active
      </button>
      <button
        onClick={() => onTabChange("leaderboards")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: activeTab === "leaderboards" ? "#1976d2" : "#666",
          fontWeight: activeTab === "leaderboards" ? "bold" : "normal",
        }}
      >
        Leaderboards
      </button>
      <button
        onClick={() => onTabChange("profile")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: activeTab === "profile" ? "#1976d2" : "#666",
          fontWeight: activeTab === "profile" ? "bold" : "normal",
        }}
      >
        Profile
      </button>
      <button
        onClick={() => onTabChange("challengeGuide")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: activeTab === "challengeGuide" ? "#1976d2" : "#666",
          fontWeight: activeTab === "challengeGuide" ? "bold" : "normal",
        }}
      >
        Challenge Guide
      </button>
      <button
        onClick={() => onTabChange("admin")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: activeTab === "admin" ? "#1976d2" : "#666",
          fontWeight: activeTab === "admin" ? "bold" : "normal",
        }}
      >
        Admin
      </button>
    </nav>
  );
}
