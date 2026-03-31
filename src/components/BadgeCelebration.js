// src/components/BadgeCelebration.js
import React, { useEffect } from "react";

/**
 * Badge celebration modal - shows newly earned badges with animation.
 * Auto-closes after 3 seconds UNLESS isLifetimeStreak=true,
 * in which case it stays open until user taps "Awesome!".
 */
export default function BadgeCelebration({ badges, onClose, isLifetimeStreak = false }) {
  useEffect(() => {
    // No auto-close for lifetime streak milestones — user must tap Awesome
    if (isLifetimeStreak) return;

    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose, isLifetimeStreak]);

  const getBadgeDisplay = (badge) => {
    if (badge.type === "legacyRun") {
      return {
        emoji: "🏆",
        title: `${badge.value}-Day Lifetime Streak!`,
        subtitle: "Lifetime Achievement Unlocked",
        color: "#f59e0b",
      };
    }

    if (badge.type === "streak") {
      return {
        emoji: "🔥",
        title: `${badge.value} Day Streak!`,
        color: "#fbbf24",
      };
    }

    if (badge.type === "multiplier") {
      if (badge.level === "double") {
        return {
          emoji: "⚡",
          title: "Double Trouble!",
          subtitle: `Badge #${badge.count}`,
          color: "#3b82f6",
        };
      }
      if (badge.level === "triple") {
        return {
          emoji: "🚀",
          title: "Triple Threat!",
          subtitle: `Badge #${badge.count}`,
          color: "#ec4899",
        };
      }
      if (badge.level === "quadruple") {
        return {
          emoji: "👑",
          title: "4x Champion!",
          subtitle: `Badge #${badge.count}`,
          color: "#a855f7",
        };
      }
    }

    if (badge.type === "time") {
      const hours = Math.floor(badge.value / 3600);
      const mins = Math.floor((badge.value % 3600) / 60);
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      return {
        emoji: "⏱️",
        title: `${timeStr} Total Time!`,
        color: "#22c55e",
      };
    }

    return { emoji: "🎉", title: "New Badge!", color: "#8b5cf6" };
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        animation: "fadeIn 0.3s ease-in",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          padding: isLifetimeStreak ? "48px 40px" : "40px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          animation: "scaleIn 0.3s ease-out",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: isLifetimeStreak ? "64px" : "48px",
              marginBottom: "20px",
              animation: "bounce 0.6s ease-in-out",
            }}
          >
            {isLifetimeStreak ? "🏆" : "🎉"}
          </div>
          <h2
            style={{
              margin: "0 0 24px 0",
              color: "var(--color-text)",
              fontSize: isLifetimeStreak ? "28px" : "24px",
            }}
          >
            {isLifetimeStreak ? "Lifetime Achievement!" : `New Badge${badges.length > 1 ? "s" : ""} Earned!`}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {badges.map((badge, index) => {
              const display = getBadgeDisplay(badge);
              return (
                <div
                  key={index}
                  style={{
                    padding: isLifetimeStreak ? "24px" : "20px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "12px",
                    border: `3px solid ${display.color}`,
                    animation: `slideInUp 0.4s ease-out ${index * 0.1}s backwards`,
                  }}
                >
                  <div style={{ fontSize: isLifetimeStreak ? "48px" : "36px", marginBottom: "8px" }}>
                    {display.emoji}
                  </div>
                  <div
                    style={{
                      fontSize: isLifetimeStreak ? "24px" : "20px",
                      fontWeight: "bold",
                      color: display.color,
                    }}
                  >
                    {display.title}
                  </div>
                  {display.subtitle && (
                    <div
                      style={{
                        fontSize: isLifetimeStreak ? "16px" : "14px",
                        color: "var(--color-text-secondary)",
                        marginTop: "4px",
                      }}
                    >
                      {display.subtitle}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lifetime streak requires explicit dismiss */}
          {isLifetimeStreak && (
            <button
              onClick={onClose}
              style={{
                marginTop: "28px",
                padding: "14px 40px",
                fontSize: "18px",
                fontWeight: "700",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                animation: "fadeIn 0.4s ease-in 0.5s backwards",
              }}
            >
              Awesome! 💪
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes slideInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
