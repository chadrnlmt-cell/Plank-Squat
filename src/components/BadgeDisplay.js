// src/components/BadgeDisplay.js
import React from "react";

/**
 * Badge display component - shows earned badges with progress indicators
 * Used in Active tab and Profile
 */
export default function BadgeDisplay({
  streakBadges = [],
  currentStreak = 0,
  doubleBadgeCount = 0,
  tripleBadgeCount = 0,
  quadrupleBadgeCount = 0,
  timeBadges = [],
  totalPlankSeconds = 0,
  showProgress = true,
  compact = false,
}) {
  // Format time in minutes/hours
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Get next streak milestone
  const getNextStreakMilestone = () => {
    const milestones = [7, 14, 21, 28];
    for (const m of milestones) {
      if (currentStreak < m) return m;
    }
    return null;
  };

  // Get next time milestone
  const getNextTimeMilestone = () => {
    const nextMilestone = Math.ceil(totalPlankSeconds / 1800) * 1800;
    return nextMilestone > totalPlankSeconds ? nextMilestone : null;
  };

  const nextStreakMilestone = getNextStreakMilestone();
  const nextTimeMilestone = getNextTimeMilestone();

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: compact ? "6px 12px" : "8px 16px",
    backgroundColor: "#fef3c7",
    border: "2px solid #fbbf24",
    borderRadius: "20px",
    fontSize: compact ? "13px" : "14px",
    fontWeight: "600",
    color: "#78350f",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? "12px" : "16px" }}>
      {/* Streak Badges */}
      <div>
        <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
          🔥 Streak Badges
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[7, 14, 21, 28].map((days) => {
            const earned = streakBadges.includes(days);
            return (
              <div
                key={days}
                style={{
                  ...badgeStyle,
                  opacity: earned ? 1 : 0.3,
                  backgroundColor: earned ? "#fef3c7" : "#f3f4f6",
                  border: earned ? "2px solid #fbbf24" : "2px solid #d1d5db",
                  color: earned ? "#78350f" : "#6b7280",
                }}
              >
                🔥 {days}d
              </div>
            );
          })}
        </div>
        {showProgress && nextStreakMilestone && (
          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Progress: {currentStreak}/{nextStreakMilestone} days
            <div style={{ width: "100%", height: "6px", backgroundColor: "#e5e7eb", borderRadius: "3px", marginTop: "4px", overflow: "hidden" }}>
              <div style={{ width: `${(currentStreak / nextStreakMilestone) * 100}%`, height: "100%", backgroundColor: "#fbbf24", transition: "width 0.3s ease" }} />
            </div>
          </div>
        )}
      </div>

      {/* Performance Badges */}
      <div>
        <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
          💪 Performance Badges
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {doubleBadgeCount > 0 && (
            <div style={{ ...badgeStyle, backgroundColor: "#dbeafe", border: "2px solid #3b82f6", color: "#1e3a8a" }}>
              ⚡ Double Trouble x{doubleBadgeCount}
            </div>
          )}
          {tripleBadgeCount > 0 && (
            <div style={{ ...badgeStyle, backgroundColor: "#fce7f3", border: "2px solid #ec4899", color: "#831843" }}>
              🚀 Triple Threat x{tripleBadgeCount}
            </div>
          )}
          {quadrupleBadgeCount > 0 && (
            <div style={{ ...badgeStyle, backgroundColor: "#f3e8ff", border: "2px solid #a855f7", color: "#581c87" }}>
              👑 4x Champion x{quadrupleBadgeCount}
            </div>
          )}
          {doubleBadgeCount === 0 && tripleBadgeCount === 0 && quadrupleBadgeCount === 0 && (
            <div style={{ fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>
              Double, triple, or quadruple your goal to earn badges!
            </div>
          )}
        </div>
      </div>

      {/* Time Badges (Plank only) */}
      {totalPlankSeconds > 0 && (
        <div>
          <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
            ⏱️ Time Milestones
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[1800, 3600, 7200, 18000, 36000].map((seconds) => {
              const earned = timeBadges.includes(seconds);
              return (
                <div
                  key={seconds}
                  style={{
                    ...badgeStyle,
                    opacity: earned ? 1 : 0.3,
                    backgroundColor: earned ? "#dcfce7" : "#f3f4f6",
                    border: earned ? "2px solid #22c55e" : "2px solid #d1d5db",
                    color: earned ? "#14532d" : "#6b7280",
                  }}
                >
                  ⏱️ {formatTime(seconds)}
                </div>
              );
            })}
          </div>
          {showProgress && nextTimeMilestone && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Progress: {formatTime(totalPlankSeconds)}/{formatTime(nextTimeMilestone)}
              <div style={{ width: "100%", height: "6px", backgroundColor: "#e5e7eb", borderRadius: "3px", marginTop: "4px", overflow: "hidden" }}>
                <div style={{ width: `${(totalPlankSeconds / nextTimeMilestone) * 100}%`, height: "100%", backgroundColor: "#22c55e", transition: "width 0.3s ease" }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
