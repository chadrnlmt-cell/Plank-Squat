// src/components/BadgeDisplay.js
import React, { useMemo } from "react";

// Motivational labels for time badge progress — randomly rotated each render
const TIME_MOTIVATIONS = [
  (minsLeft, nextLabel) => `${minsLeft} more for your ${nextLabel} badge! ⏱️`,
  (minsLeft, nextLabel) => `Almost there — just ${minsLeft} away from ${nextLabel}! 🔥`,
  (minsLeft, nextLabel) => `Keep planking! ${minsLeft} left to unlock ${nextLabel} ⏱️`,
  (_minsLeft, nextLabel) => `Next milestone: ${nextLabel} total (keep going!)`,
  (minsLeft, nextLabel) => `🔓 Unlock ${nextLabel} badge — ${minsLeft} of planking left!`,
];

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
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      if (mins > 0) return `${hours}h ${mins}m`;
      return `${hours}h`;
    }
    return `${mins}m`;
  };

  const formatTimeLeft = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      if (mins > 0) return `${hours}h ${mins}m`;
      return `${hours}h`;
    }
    return `${mins}m`;
  };

  const getNextStreakMilestone = () => {
    const milestones = [3, 7, 14, 21, 28];
    for (const m of milestones) {
      if (currentStreak < m) return m;
    }
    return null;
  };

  // Active challenge: 15-min steps up to 5 hours (18000s)
  const getNextTimeMilestone = () => {
    const milestones = [];
    for (let i = 900; i <= 18000; i += 900) milestones.push(i);
    for (const m of milestones) {
      if (totalPlankSeconds < m) return m;
    }
    return null;
  };

  const nextStreakMilestone = getNextStreakMilestone();
  const nextTimeMilestone = getNextTimeMilestone();

  // Pick a motivation label, rotating based on totalPlankSeconds so it changes each session
  const timeMotivationLabel = useMemo(() => {
    if (!nextTimeMilestone) return null;
    const idx = Math.floor(totalPlankSeconds / 900) % TIME_MOTIVATIONS.length;
    const secsLeft = nextTimeMilestone - totalPlankSeconds;
    const minsLeft = formatTimeLeft(secsLeft);
    const nextLabel = formatTime(nextTimeMilestone);
    return TIME_MOTIVATIONS[idx](minsLeft, nextLabel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPlankSeconds, nextTimeMilestone]);

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

  const hasCompletedBadges = Object.values(completedStreakBadges).some((count) => count > 0);
  const hasCompletedTimeBadges = Object.keys(completedTimeBadges).length > 0;

  const getStreakMotivationLabel = () => {
    if (!nextStreakMilestone) return null;
    const daysLeft = nextStreakMilestone - currentStreak;
    return daysLeft === 1
      ? `1 more day for your ${nextStreakMilestone}-day badge! 🔥`
      : `${daysLeft} more days for your ${nextStreakMilestone}-day badge! 🔥`;
  };

  const streakMotivationLabel = getStreakMotivationLabel();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? "12px" : "16px" }}>
      {nextStreakMilestone && (
        <div>
          <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
            🔥 Streak Progress
          </div>
          <div style={{ padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "2px solid #e5e7eb" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#6b7280" }}>
              {streakMotivationLabel}
            </div>
            <div style={{ position: "relative", width: "100%", height: "40px", backgroundColor: "#e5e7eb", borderRadius: "8px", overflow: "hidden", border: "2px solid #d1d5db" }}>
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(currentStreak / nextStreakMilestone) * 100}%`, backgroundColor: "#fbbf24", transition: "width 0.5s ease", borderRight: currentStreak > 0 && currentStreak < nextStreakMilestone ? "2px solid #f59e0b" : "none" }} />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", color: currentStreak >= nextStreakMilestone / 2 ? "#78350f" : "#374151", textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}>
                {currentStreak}/{nextStreakMilestone} days
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div key={days} style={{ ...badgeStyle, backgroundColor: "#fef3c7", border: "2px solid #fbbf24", color: "#78350f" }}>
                  🔥 {days}d {count > 1 ? `(x${count})` : ""}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {totalPlankSeconds > 0 && (
        <div>
          <div style={{ fontSize: compact ? "12px" : "13px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text-secondary)" }}>
            ⏱️ Time Milestones
          </div>
          {nextTimeMilestone && (
            <div style={{ padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "2px solid #e5e7eb", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#6b7280" }}>
                {timeMotivationLabel}
              </div>
              <div style={{ position: "relative", width: "100%", height: "40px", backgroundColor: "#e5e7eb", borderRadius: "8px", overflow: "hidden", border: "2px solid #d1d5db" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(totalPlankSeconds / nextTimeMilestone) * 100}%`, backgroundColor: "#22c55e", transition: "width 0.5s ease", borderRight: totalPlankSeconds > 0 && totalPlankSeconds < nextTimeMilestone ? "2px solid #16a34a" : "none" }} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "bold", color: totalPlankSeconds >= nextTimeMilestone / 2 ? "#14532d" : "#374151", textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}>
                  {formatTime(totalPlankSeconds)}/{formatTime(nextTimeMilestone)}
                </div>
              </div>
            </div>
          )}
          {hasCompletedTimeBadges && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "#6b7280" }}>🏆 Earned Time Badges</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {Object.keys(completedTimeBadges).map(Number).sort((a, b) => b - a).map((seconds) => {
                  const count = completedTimeBadges[seconds] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={seconds} style={{ ...badgeStyle, backgroundColor: "#dcfce7", border: "2px solid #22c55e", color: "#14532d" }}>
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

// ---------------------------------------------------------------------------
// LIFETIME ACHIEVEMENTS BADGE DISPLAY
// ---------------------------------------------------------------------------

function formatLegacyTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    if (mins > 0) return `${hours}h ${mins}m`;
    return `${hours}h`;
  }
  return `${mins}m`;
}

function TrophyCard({ label, sublabel, color = "#eab308", bgColor = "#fef9c3", borderColor = "#eab308", emoji = "🏆" }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "80px",
        minHeight: "88px",
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "8px 4px",
        boxShadow: "0 2px 8px rgba(234,179,8,0.18)",
      }}
    >
      <div style={{ fontSize: "22px", lineHeight: 1, marginBottom: "4px" }}>{emoji}</div>
      <div style={{ fontSize: "26px", fontWeight: "900", color: color, lineHeight: 1, letterSpacing: "-0.5px" }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: "11px", fontWeight: "600", color: color, opacity: 0.8, marginTop: "3px", textAlign: "center", lineHeight: 1.2 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

export function LegacyBadgeDisplay({
  consecutiveRun = 0,
  consecutiveRunBadgeLevel = 0,
  earnedConsecutiveRunBadges = [],
  earnedTimeBadges = [],
  totalPlankSeconds = 0,
}) {
  // Lifetime run milestones: unchanged
  const RUN_MILESTONES = (() => {
    const m = [];
    for (let i = 30; i <= 365; i += 30) m.push(i);
    if (!m.includes(365)) m.push(365);
    return m;
  })();

  // Lifetime time milestones: unchanged — 30-min steps up to 10 hours
  const TIME_MILESTONES = (() => {
    const m = [];
    for (let i = 1800; i <= 36000; i += 1800) m.push(i);
    return m;
  })();

  const runValues = earnedConsecutiveRunBadges.map((item) =>
    typeof item === "object" ? item.value : item
  );
  const timeValues = earnedTimeBadges.map((item) =>
    typeof item === "object" ? item.value : item
  );

  const nextRunMilestone = RUN_MILESTONES.find((m) => consecutiveRun < m) || null;
  const nextTimeMilestone = TIME_MILESTONES.find((m) => !timeValues.includes(m)) || null;

  const hasEarnedRunBadges = runValues.length > 0;
  const hasEarnedTimeBadges = timeValues.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Best Consecutive Run */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px", color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          🔥 Best Consecutive Run
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "12px" }}>
          <span style={{ fontSize: "40px", fontWeight: "900", color: "#eab308", lineHeight: 1 }}>
            {consecutiveRun}
          </span>
          <span style={{ fontSize: "16px", fontWeight: "600", color: "#92400e" }}>days</span>
          {consecutiveRun > 0 && (
            <span style={{ fontSize: "13px", color: "#a16207", marginLeft: "4px" }}>🔥 running</span>
          )}
        </div>

        {nextRunMilestone && (
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#92400e" }}>
              Next trophy: {nextRunMilestone} days
            </div>
            <div style={{ position: "relative", width: "100%", height: "36px", backgroundColor: "#fef3c7", borderRadius: "8px", overflow: "hidden", border: "2px solid #fde68a" }}>
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${Math.min((consecutiveRun / nextRunMilestone) * 100, 100)}%`, background: "linear-gradient(90deg, #fbbf24, #eab308)", transition: "width 0.5s ease" }} />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "bold", color: "#78350f", textShadow: "0 1px 2px rgba(255,255,255,0.7)" }}>
                {consecutiveRun}/{nextRunMilestone} days
              </div>
            </div>
          </div>
        )}

        {hasEarnedRunBadges ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {[...runValues].sort((a, b) => b - a).map((milestone) => (
              <TrophyCard key={milestone} emoji="🏆" label={`${milestone}`} sublabel="days" color="#92400e" bgColor="#fef3c7" borderColor="#eab308" />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "#a16207", fontStyle: "italic" }}>
            Complete your first 30-day run to earn a trophy!
          </div>
        )}
      </div>

      {/* Lifetime Plank Time */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "10px", color: "#065f46", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          ⏱️ Lifetime Plank Time
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "12px" }}>
          <span style={{ fontSize: "32px", fontWeight: "900", color: "#059669", lineHeight: 1 }}>
            {formatLegacyTime(totalPlankSeconds)}
          </span>
          <span style={{ fontSize: "13px", color: "#065f46" }}>total</span>
        </div>

        {nextTimeMilestone && (
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "#065f46" }}>
              Next trophy: {formatLegacyTime(nextTimeMilestone)}
            </div>
            <div style={{ position: "relative", width: "100%", height: "36px", backgroundColor: "#d1fae5", borderRadius: "8px", overflow: "hidden", border: "2px solid #a7f3d0" }}>
              {(() => {
                const lastEarned = timeValues.length > 0 ? Math.max(...timeValues) : 0;
                const rangeStart = lastEarned;
                const rangeEnd = nextTimeMilestone;
                const progress = Math.min(
                  ((totalPlankSeconds - rangeStart) / (rangeEnd - rangeStart)) * 100,
                  100
                );
                return (
                  <>
                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #34d399, #059669)", transition: "width 0.5s ease" }} />
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "bold", color: "#064e3b", textShadow: "0 1px 2px rgba(255,255,255,0.7)" }}>
                      {formatLegacyTime(totalPlankSeconds)}/{formatLegacyTime(nextTimeMilestone)}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {hasEarnedTimeBadges ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {[...timeValues].sort((a, b) => b - a).map((milestone) => (
              <TrophyCard key={milestone} emoji="⏱️" label={formatLegacyTime(milestone)} sublabel="plank" color="#064e3b" bgColor="#d1fae5" borderColor="#34d399" />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "#059669", fontStyle: "italic" }}>
            Reach 30 minutes of total plank time to earn your first trophy!
          </div>
        )}
      </div>
    </div>
  );
}
