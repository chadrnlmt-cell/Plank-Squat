// src/components/PracticeCard.js
// Renders the active Practice card — shown on the Active tab after the user
// has joined. ChallengeReminder is rendered by App.js (outside this card),
// exactly like real challenge cards.
import React, { useState, useEffect } from "react";
import { getPracticeStats, leavePractice } from "../practiceHelpers";

function formatSeconds(sec) {
  const s = Number(sec) || 0;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins === 0) return `${s}s`;
  return `${mins}m ${rem}s`;
}

export default function PracticeCard({
  userId,
  onStartPractice,
  onLeft,
}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPracticeStats(userId);
      setStats(data || {});
    } catch (err) {
      console.error("PracticeCard loadData error:", err);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leavePractice(userId);
      setShowLeaveConfirm(false);
      if (onLeft) onLeft();
    } catch (err) {
      console.error("PracticeCard leave error:", err);
      alert("Could not leave Practice Session. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const totalSessions = stats?.totalSessions || 0;
  const totalSeconds = stats?.totalSeconds || 0;
  const bestSeconds = stats?.bestSeconds || 0;
  const avgSeconds = stats?.avgSeconds || 0;
  const currentStreak = stats?.currentStreak || 0;
  const bestStreak = stats?.bestStreak || 0;

  const completedStreaks = stats?.completedStreakBadges || {};
  const currentStreakBadgeLevel = stats?.currentStreakBadgeLevel || 0;

  const doubles = stats?.doubleBadgeCount || 0;
  const triples = stats?.tripleBadgeCount || 0;
  const quads = stats?.quadrupleBadgeCount || 0;

  const streakPillConfig = [
    { days: 3,  label: "3-Day",  fontSize: 12 },
    { days: 7,  label: "7-Day",  fontSize: 13 },
    { days: 14, label: "14-Day", fontSize: 14 },
    { days: 21, label: "21-Day", fontSize: 15 },
    { days: 28, label: "28-Day", fontSize: 16 },
  ];

  const streakPills = streakPillConfig
    .map((cfg) => ({
      ...cfg,
      count: (completedStreaks[cfg.days] || 0) + (currentStreakBadgeLevel >= cfg.days ? 1 : 0),
    }))
    .filter((p) => p.count > 0);

  const multiplierPills = [
    doubles > 0 && { emoji: "⚡", label: "2x", count: doubles, bg: "#dbeafe", border: "#3b82f6", color: "#1e3a8a" },
    triples > 0 && { emoji: "🚀", label: "3x", count: triples, bg: "#fce7f3", border: "#ec4899", color: "#831843" },
    quads > 0 && { emoji: "👑", label: "4x", count: quads, bg: "#f3e8ff", border: "#a855f7", color: "#581c87" },
  ].filter(Boolean);

  const hasBadges = streakPills.length > 0 || multiplierPills.length > 0;

  // Shared style for stat value text — slightly smaller to fit 4 columns comfortably
  const statValueStyle = { fontSize: "17px", fontWeight: "bold", color: "#065f46" };
  const statLabelStyle = { fontSize: "11px", color: "#047857" };
  const dividerStyle = { width: "1px", background: "#a7f3d0", flexShrink: 0 };

  return (
    <>
      {showLeaveConfirm && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2000, padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-card)",
              padding: "28px", borderRadius: "12px",
              maxWidth: "380px", width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏋️</div>
            <h3 style={{ margin: "0 0 10px 0", color: "var(--color-text)" }}>Leave Practice Session?</h3>
            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Your badges, streaks, and session history are saved. Any reminders will be turned off automatically.
              You can rejoin anytime from the Available tab.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleLeave}
                disabled={leaving}
                style={{
                  flex: 1, padding: "12px", fontSize: "15px",
                  backgroundColor: "#ef4444", color: "white",
                  border: "none", borderRadius: "8px", cursor: leaving ? "not-allowed" : "pointer",
                  opacity: leaving ? 0.7 : 1,
                }}
              >
                {leaving ? "Leaving..." : "Yes, Leave"}
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                style={{
                  flex: 1, padding: "12px", fontSize: "15px",
                  backgroundColor: "#6b7280", color: "white",
                  border: "none", borderRadius: "8px", cursor: "pointer",
                }}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Green practice card — identical structure to a challenge card */}
      <div
        className="card"
        style={{
          border: "2px solid #10b981",
          background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
          position: "relative",
        }}
      >
        <div className="card__body">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#065f46", display: "flex", alignItems: "center", gap: "8px" }}>
                🏋️ Practice Session
              </h3>
              <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#047857" }}>
                Always available · 60s plank · No end date
              </p>
            </div>
            {currentStreak > 0 && (
              <div
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  background: "#fef3c7", border: "2px solid #fbbf24",
                  borderRadius: "12px", padding: "6px 12px", minWidth: "56px",
                }}
              >
                <span style={{ fontSize: "20px" }}>🔥</span>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#78350f", lineHeight: 1 }}>{currentStreak}</span>
                <span style={{ fontSize: "10px", color: "#92400e" }}>day streak</span>
              </div>
            )}
          </div>

          {loading ? (
            <p style={{ fontSize: "13px", color: "#6b7280" }}>Loading...</p>
          ) : (
            <>
              {totalSessions > 0 && (
                <div
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    borderRadius: "10px", padding: "10px 12px",
                    marginBottom: "14px",
                  }}
                >
                  {/* Row 1: Sessions | Total Time | Avg Time | Best */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={statValueStyle}>{totalSessions}</div>
                      <div style={statLabelStyle}>Sessions</div>
                    </div>
                    <div style={dividerStyle} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={statValueStyle}>{formatSeconds(totalSeconds)}</div>
                      <div style={statLabelStyle}>Total Time</div>
                    </div>
                    <div style={dividerStyle} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={statValueStyle}>{formatSeconds(avgSeconds)}</div>
                      <div style={statLabelStyle}>Avg Time</div>
                    </div>
                    <div style={dividerStyle} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={statValueStyle}>{formatSeconds(bestSeconds)}</div>
                      <div style={statLabelStyle}>Best</div>
                    </div>
                  </div>

                  {/* Row 2: Best Streak — only shown when bestStreak > 0 */}
                  {bestStreak > 0 && (
                    <>
                      <div style={{ height: "1px", background: "#a7f3d0", margin: "8px 0" }} />
                      <div style={{ textAlign: "center" }}>
                        <div style={statValueStyle}>
                          🔥 {bestStreak} {bestStreak === 1 ? "day" : "days"}
                        </div>
                        <div style={statLabelStyle}>Best Streak</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {hasBadges && (
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#065f46", marginBottom: "6px" }}>BADGES</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {streakPills.map((pill) => (
                      <span
                        key={pill.days}
                        style={{
                          padding: "4px 10px",
                          background: "#fef3c7", border: "1.5px solid #fbbf24",
                          borderRadius: "20px", fontSize: `${pill.fontSize}px`,
                          fontWeight: "600", color: "#78350f",
                        }}
                      >
                        🔥 {pill.label} ×{pill.count}
                      </span>
                    ))}
                    {multiplierPills.map((pill) => (
                      <span
                        key={pill.label}
                        style={{
                          padding: "4px 10px",
                          background: pill.bg, border: `1.5px solid ${pill.border}`,
                          borderRadius: "20px", fontSize: "12px",
                          fontWeight: "600", color: pill.color,
                        }}
                      >
                        {pill.emoji} {pill.label} ×{pill.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {totalSessions === 0 && (
                <p style={{ fontSize: "13px", color: "#047857", marginBottom: "14px" }}>
                  Start your first practice session and begin building your streak! 💪
                </p>
              )}
            </>
          )}

          <button
            className="btn btn--primary"
            onClick={onStartPractice}
            style={{
              width: "100%", fontSize: "16px", fontWeight: "bold",
              backgroundColor: "#10b981", borderColor: "#10b981",
              padding: "14px",
            }}
          >
            🏋️ Start Practice Session
          </button>

          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button
              onClick={() => setShowLeaveConfirm(true)}
              style={{
                background: "none", border: "none",
                fontSize: "12px", color: "#9ca3af",
                cursor: "pointer", textDecoration: "underline",
              }}
            >
              Leave Practice Session
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
