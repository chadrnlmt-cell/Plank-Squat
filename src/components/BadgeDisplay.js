// src/components/BadgeDisplay.js
import React from "react";

/**
 * Badge display component - Progressive reveal with left-to-right fill
 * Shows only the NEXT badge to earn, with completed badges below
 */
export default function BadgeDisplay({
  currentStreak = 0,
  currentStreakBadgeLevel = 0,
  completedStreakBadges = { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
  doubleBadgeCount = 0,
  tripleBadgeCount = 0,
  quadrupleBadgeCount = 0,
  totalPlankSeconds = 0,
  currentTimeBadgeLevel = 0,
  completedTimeBadges = {},
  showProgress = true,
  compact = false,
}) {
  // Format time in minutes/hours
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      if (mins > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${hours}h`;
    }
    return `${mins}m`;
  };

  // Get next streak milestone to achieve
  const getNextStreakMilestone = () => {
    const milestones = [3, 7, 14, 21, 28];
    for (const m of milestones) {
      if (currentStreak < m) return m;
    }
    return null; // Maxed out at 28
  };

  // Get next time milestone (30 min increments up to 10 hours)
  const getNextTimeMilestone = () => {
    const milestones = [];
    for (let i = 1800; i <= 36000; i += 1800) {
      milestones.push(i);
    }
    for (const m of milestones) {
      if (totalPlankSeconds < m) return m;
    }
    return null; // Maxed out at 10 hours
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

  // Count total completed streak badges for display
  const hasCompletedBadges = Object.values(completedStreakBadges).some(count => count > 0);
  const hasCompletedTimeBadges = Object.keys(completedTimeBadges).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? "12px" : "16px" }}>
      {/* Streak Progress - Only show NEXT badge */}
      {nextStreakMilestone && (
        <div>
          <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
            🔥 Streak Progress
          </div>
          
          {/* Next Badge Card */}
          <div
            style={{
              padding: "12px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              border: "2px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#6b7280" }}>
              Next Badge: {nextStreakMilestone} Day Streak 🔥
            </div>
            
            {/* Progress Bar Badge */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "40px",
                backgroundColor: "#e5e7eb",
                borderRadius: "8px",
                overflow: "hidden",
                border: "2px solid #d1d5db",
              }}
            >
              {/* Filled portion */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${(currentStreak / nextStreakMilestone) * 100}%`,
                  backgroundColor: "#fbbf24",
                  transition: "width 0.5s ease",
                  borderRight: currentStreak > 0 && currentStreak < nextStreakMilestone ? "2px solid #f59e0b" : "none",
                }}
              />
              
              {/* Text overlay */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: currentStreak >= nextStreakMilestone / 2 ? "#78350f" : "#374151",
                  textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                }}
              >
                {currentStreak}/{nextStreakMilestone} days
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Streak Badges */}
      {hasCompletedBadges && (
        <div>
          <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
            🏆 Earned Streak Badges
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[28, 21, 14, 7, 3].map((days) => {
              const count = completedStreakBadges[days] || 0;
              if (count === 0) return null;
              return (
                <div
                  key={days}
                  style={{
                    ...badgeStyle,
                    backgroundColor: "#fef3c7",
                    border: "2px solid #fbbf24",
                    color: "#78350f",
                  }}
                >
                  🔥 {days}d {count > 1 ? `(x${count})` : ""}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Time Badges (Plank only) - Progressive reveal like streaks */}
      {totalPlankSeconds > 0 && (
        <div>
          <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
            ⏱️ Time Milestones
          </div>
          
          {/* Next Time Badge Card */}
          {nextTimeMilestone && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                border: "2px solid #e5e7eb",
                marginBottom: "12px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#6b7280" }}>
                Next Badge: {formatTime(nextTimeMilestone)} Total Time ⏱️
              </div>
              
              {/* Progress Bar Badge */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "40px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "2px solid #d1d5db",
                }}
              >
                {/* Filled portion */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${(totalPlankSeconds / nextTimeMilestone) * 100}%`,
                    backgroundColor: "#22c55e",
                    transition: "width 0.5s ease",
                    borderRight: totalPlankSeconds > 0 && totalPlankSeconds < nextTimeMilestone ? "2px solid #16a34a" : "none",
                  }}
                />
                
                {/* Text overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: totalPlankSeconds >= nextTimeMilestone / 2 ? "#14532d" : "#374151",
                    textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                  }}
                >
                  {formatTime(totalPlankSeconds)}/{formatTime(nextTimeMilestone)}
                </div>
              </div>
            </div>
          )}

          {/* Completed Time Badges */}
          {hasCompletedTimeBadges && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "#6b7280" }}>
                🏆 Earned Time Badges
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {Object.keys(completedTimeBadges)
                  .map(Number)
                  .sort((a, b) => b - a)
                  .map((seconds) => {
                    const count = completedTimeBadges[seconds] || 0;
                    if (count === 0) return null;
                    return (
                      <div
                        key={seconds}
                        style={{
                          ...badgeStyle,
                          backgroundColor: "#dcfce7",
                          border: "2px solid #22c55e",
                          color: "#14532d",
                        }}
                      >
                        ⏱️ {formatTime(seconds)} {count > 1 ? `(x${count})` : ""}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
