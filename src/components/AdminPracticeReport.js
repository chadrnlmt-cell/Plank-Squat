// src/components/AdminPracticeReport.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

function formatSeconds(sec) {
  const s = Number(sec) || 0;
  if (s === 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPracticeReport({ practiceId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [lastRun, setLastRun] = useState(null);

  useEffect(() => {
    if (practiceId) loadReport();
  }, [practiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReport = async () => {
    setLoading(true);
    try {
      // Get all userChallenges for practice (any status that has sessions)
      const ucQ = query(
        collection(db, "userChallenges"),
        where("challengeId", "==", practiceId)
      );
      const ucSnap = await getDocs(ucQ);

      const reportRows = [];

      for (const ucDoc of ucSnap.docs) {
        const ucData = ucDoc.data();
        const userId = ucData.userId;
        if (!userId) continue;

        // Load all successful attempts for this user
        const attQ = query(
          collection(db, "attempts"),
          where("userId", "==", userId),
          where("challengeId", "==", practiceId),
          where("success", "==", true)
        );
        const attSnap = await getDocs(attQ);
        if (attSnap.empty) continue; // skip users with no sessions

        const sessions = attSnap.docs.map((d) => d.data());
        const totalSessions = sessions.length;
        const totalSeconds = sessions.reduce((s, a) => s + (a.actualValue || 0), 0);
        const avgSeconds = totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;
        const bestSeconds = sessions.reduce((b, a) => Math.max(b, a.actualValue || 0), 0);

        // Sort timestamps to get last session
        const sortedByTime = [...sessions].sort((a, b) => {
          const aMs = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const bMs = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return bMs - aMs;
        });
        const lastSession = sortedByTime[0]?.timestamp || null;

        // Calculate current streak from badge data
        let currentStreak = 0;
        let bestStreak = 0;
        try {
          const statsSnap = await getDoc(doc(db, "userStats", userId));
          if (statsSnap.exists()) {
            const statsData = statsSnap.data();
            const challengeBadges = statsData?.badges?.challenges?.[practiceId] || {};
            currentStreak = challengeBadges.currentStreak || 0;

            // Best streak = highest completed streak badge level earned
            const completedStreakBadges = challengeBadges.completedStreakBadges || {};
            const levels = [28, 21, 14, 7, 3];
            for (const lvl of levels) {
              if ((completedStreakBadges[lvl] || 0) > 0 || (challengeBadges.currentStreakBadgeLevel || 0) >= lvl) {
                bestStreak = lvl;
                break;
              }
            }
            if (currentStreak > bestStreak) bestStreak = currentStreak;
          }
        } catch (e) {
          console.error("Error loading userStats for", userId, e);
        }

        // Earned badges summary
        let badgeSummary = "—";
        try {
          const statsSnap = await getDoc(doc(db, "userStats", userId));
          if (statsSnap.exists()) {
            const statsData = statsSnap.data();
            const cb = statsData?.badges?.challenges?.[practiceId] || {};
            const parts = [];
            const streakMilestones = [3, 7, 14, 21, 28];
            for (const m of streakMilestones) {
              const count = (cb.completedStreakBadges?.[m] || 0) + (cb.currentStreakBadgeLevel >= m ? 1 : 0);
              if (count > 0) parts.push(`🔥${m}d×${count}`);
            }
            if (cb.doubleBadgeCount > 0) parts.push(`⚡2x×${cb.doubleBadgeCount}`);
            if (cb.tripleBadgeCount > 0) parts.push(`🚀3x×${cb.tripleBadgeCount}`);
            if (cb.quadrupleBadgeCount > 0) parts.push(`👑4x×${cb.quadrupleBadgeCount}`);
            if (parts.length > 0) badgeSummary = parts.join(" ");
          }
        } catch (e) { /* already logged above */ }

        reportRows.push({
          userId,
          displayName: ucData.displayName || userId,
          totalSessions,
          totalSeconds,
          avgSeconds,
          bestSeconds,
          currentStreak,
          bestStreak,
          lastSession,
          badgeSummary,
        });
      }

      // Sort by total sessions desc
      reportRows.sort((a, b) => b.totalSessions - a.totalSessions);
      setRows(reportRows);
      setLastRun(new Date());
    } catch (err) {
      console.error("AdminPracticeReport loadReport error:", err);
    } finally {
      setLoading(false);
    }
  };

  const userOptions = [{ value: "all", label: "All Users" }, ...rows.map((r) => ({ value: r.userId, label: r.displayName }))];
  const filtered = filterUser === "all" ? rows : rows.filter((r) => r.userId === filterUser);

  return (
    <div style={{ padding: "0" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>🏋️ Practice Day Report</h2>
          {lastRun && (
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Last updated: {lastRun.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          style={{
            padding: "10px 20px", fontSize: "14px",
            backgroundColor: "#10b981", color: "white",
            border: "none", borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading..." : "🔄 Refresh Report"}
        </button>
      </div>

      {/* Filter */}
      {rows.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", marginRight: "8px" }}>Filter by user:</label>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "13px" }}
          >
            {userOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Loading practice data...</div>
      ) : rows.length === 0 ? (
        <div
          style={{
            padding: "40px", textAlign: "center",
            backgroundColor: "white", borderRadius: "8px",
            color: "#9ca3af",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏋️</div>
          <p style={{ margin: 0, fontSize: "16px" }}>No practice sessions recorded yet.</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "13px" }}>Users who complete Practice Day sessions will appear here.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
            <thead>
              <tr style={{ backgroundColor: "#065f46", color: "white" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600" }}>User</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>Sessions</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>Total Time</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>Avg Time</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>Best</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>🔥 Streak</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>Best Streak</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: "600" }}>Last Session</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "600" }}>Badges</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={row.userId}
                  style={{ backgroundColor: i % 2 === 0 ? "white" : "#f9fafb", borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: "600", color: "#111827" }}>{row.displayName}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{row.totalSessions}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{formatSeconds(row.totalSeconds)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{formatSeconds(row.avgSeconds)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{formatSeconds(row.bestSeconds)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: "bold", color: row.currentStreak > 0 ? "#b45309" : "#9ca3af" }}>
                    {row.currentStreak > 0 ? `🔥 ${row.currentStreak}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    {row.bestStreak > 0 ? `${row.bestStreak} days` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", color: "#6b7280" }}>{formatDate(row.lastSession)}</td>
                  <td style={{ padding: "10px 12px", fontSize: "12px" }}>{row.badgeSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary footer */}
          <div style={{ marginTop: "16px", padding: "12px 16px", backgroundColor: "#ecfdf5", borderRadius: "8px", border: "1px solid #a7f3d0", fontSize: "13px", color: "#065f46" }}>
            <strong>Summary:</strong> {filtered.length} user{filtered.length !== 1 ? "s" : ""} ·{" "}
            {filtered.reduce((s, r) => s + r.totalSessions, 0)} total sessions ·{" "}
            {formatSeconds(filtered.reduce((s, r) => s + r.totalSeconds, 0))} total practice time
          </div>
        </div>
      )}
    </div>
  );
}
