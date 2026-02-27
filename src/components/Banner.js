// src/components/Banner.js
import React, { useEffect, useState } from "react";

export default function Banner({ message, type = "info", duration = 5000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const backgroundColor = type === "warning" ? "#fbbf24" : "#3b82f6";
  const textColor = type === "warning" ? "#78350f" : "white";

  return (
    <div
      onClick={() => {
        setIsVisible(false);
        if (onClose) onClose();
      }}
      style={{
        position: "fixed",
        top: "70px",
        left: "20px",
        right: "20px",
        backgroundColor,
        color: textColor,
        padding: "16px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 1000,
        cursor: "pointer",
        animation: "slideInDown 0.3s ease-out",
        fontSize: "16px",
        fontWeight: "500",
        textAlign: "center",
      }}
    >
      {message}
      <style>{`
        @keyframes slideInDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
