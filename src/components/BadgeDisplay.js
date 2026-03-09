// src/components/BadgeDisplay.js
import React from "react";

/**
 * Reusable badge display component
 * Shows badges with icons, counts, and progress bars
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
  // Calculate next streak badge target
  const streakTargets = [7, 14, 21, 28];
  const nextStreakTarget =
    streakTargets.find((t) => !streakBadges.includes(t)) || 28;
  const streakProgress = Math.min((currentStreak / nextStreakTarget) * 100, 100);

  // Calculate next time badge target (30 min increments)
  const nextTimeTarget = Math.ceil(totalPlankSeconds / 1800) * 1800;
  const timeProgress =
    nextTimeTarget > 0
      ? Math.min((totalPlankSeconds / nextTimeTarget) * 100, 100)
      : 0;

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const hasAnyBadges =
    streakBadges.length > 0 ||
    doubleBadgeCount > 0 ||
    tripleBadgeCount > 0 ||
    quadrupleBadgeCount > 0 ||
    timeBadges.length > 0;

  if (!hasAnyBadges && !showProgress) {
    return (
      <div
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "14px",
          textAlign: "center",
          padding: "10px",
        }}
      >
        Complete challenges to earn badges!
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "12px" : "16px",
      }}
    >
      {/* Streak Badges */}
      {(streakBadges.length > 0 || showProgress) && (
        <div>
          <div
            style={{
              fontSize: compact ? "13px" : "14px",
              fontWeight: "600",
              marginBottom: "8px",
              color: "var(--color-text)",
            }}
          >
            🔥 Streak Badges
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: showProgress ? "8px" : "0",
            }}
          >
            {streakBadges.length === 0 && (
              <div
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "13px",
                }}
              >
                Complete consecutive days to earn
              </div>
            )}
            {streakBadges.map((days) => (
              <div key={days} className={`badge badge-streak-${days}`}>
                {days}-day
              </div>
            ))}
          </div>
          {showProgress && (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Progress: {currentStreak}/{nextStreakTarget} days
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${streakProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Goal Multiplier Badges */}
      {(doubleBadgeCount > 0 ||
        tripleBadgeCount > 0 ||
        quadrupleBadgeCount > 0) && (
        <div>
          <div
            style={{
              fontSize: compact ? "13px" : "14px",
              fontWeight: "600",
              marginBottom: "8px",
              color: "var(--color-text)",
            }}
          >
            🏆 Goal Multipliers
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {doubleBadgeCount > 0 && (
              <div className="badge badge-double">
                Double
                <span className="badge-count">x{doubleBadgeCount}</span>
              </div>
            )}
            {tripleBadgeCount > 0 && (
              <div className="badge badge-triple">
                Triple
                <span className="badge-count">x{tripleBadgeCount}</span>
              </div>
            )}
            {quadrupleBadgeCount > 0 && (
              <div className="badge badge-quadruple">
                Quad
                <span className="badge-count">x{quadrupleBadgeCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time Badges (Plank only) */}
      {(timeBadges.length > 0 || (showProgress && totalPlankSeconds > 0)) && (
        <div>
          <div
            style={{
              fontSize: compact ? "13px" : "14px",
              fontWeight: "600",
              marginBottom: "8px",
              color: "var(--color-text)",
            }}
          >
            ⏱️ Time Achievements
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: showProgress && totalPlankSeconds > 0 ? "8px" : "0",
            }}
          >
            {timeBadges.length === 0 && (
              <div
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "13px",
                }}
              >
                Accumulate plank time to earn
              </div>
            )}
            {timeBadges.map((seconds) => (
              <div
                key={seconds}
                className={`badge badge-time-${Math.floor(seconds / 1800)}`}
              >
                {formatTime(seconds)}
              </div>
            ))}
          </div>
          {showProgress && totalPlankSeconds > 0 && (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                }}
              >
                Progress: {formatTime(totalPlankSeconds)}/
                {formatTime(nextTimeTarget)}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${timeProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
