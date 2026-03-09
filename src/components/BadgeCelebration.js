// src/components/BadgeCelebration.js
import React, { useEffect, useState } from "react";

/**
 * Full-screen celebration modal when badges are earned
 * Auto-dismisses after 3 seconds
 */
export default function BadgeCelebration({ badges, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Allow fade-out animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!badges || badges.length === 0) return null;

  const formatBadgeText = (badge) => {
    if (badge.type === "streak") {
      return `${badge.value}-Day Streak!`;
    }
    if (badge.type === "multiplier") {
      const level =
        badge.level.charAt(0).toUpperCase() + badge.level.slice(1);
      return `${level} Goal Badge!`;
    }
    if (badge.type === "time") {
      const hours = Math.floor(badge.value / 3600);
      const mins = Math.floor((badge.value % 3600) / 60);
      if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}m Achievement!` : `${hours}h Achievement!`;
      }
      return `${mins}m Achievement!`;
    }
    return "Badge Earned!";
  };

  const getBadgeIcon = (badge) => {
    if (badge.type === "streak") return "🔥";
    if (badge.type === "multiplier") return "🏆";
    if (badge.type === "time") return "⏱️";
    return "🎉";
  };

  // Show first badge (if multiple earned, they'll celebrate one at a time)
  const badge = badges[0];

  return (
    <div
      className="badge-celebration"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      <div className="badge-celebration-content">
        <div className="badge-celebration-icon">{getBadgeIcon(badge)}</div>
        <h2 className="badge-celebration-title">New Badge Earned!</h2>
        <p className="badge-celebration-text">{formatBadgeText(badge)}</p>
        {badges.length > 1 && (
          <p
            style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.8)",
              marginTop: "10px",
            }}
          >
            +{badges.length - 1} more badge{badges.length > 2 ? "s" : ""}!
          </p>
        )}
      </div>

      {/* Confetti animation */}
      <div className="confetti">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${2 + Math.random()}s`,
              backgroundColor: [
                "#ff6b6b",
                "#ffd93d",
                "#6c5ce7",
                "#22c55e",
                "#3b82f6",
              ][Math.floor(Math.random() * 5)],
            }}
          />
        ))}
      </div>
    </div>
  );
}
