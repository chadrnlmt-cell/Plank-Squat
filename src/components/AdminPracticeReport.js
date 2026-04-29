// src/components/AdminPracticeReport.js
// Admin Practice tab — loads on-demand. Pulls from practiceUserStats
// (one doc per user) plus practiceAttempts for the most recent session
// timestamp.

import React, { useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { PRACTICE_CHALLENGE_ID } from "../practiceConstants";

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

export default function AdminPracticeReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const [lastRun, setLastRun] = useState(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      // Pull every practiceUserStats doc (one per user)
      const statsSnap = await getDocs(collection(db, "practiceUserStats"));
      const reportRows = [];

      for (const statsDoc of statsSnap.docs) {
        const data = statsDoc.data();
        const userId = data.userId || statsDoc.id;
        const totalSessions = data.totalSessions || 0;

        // Skip users with no sessions
        if (totalSessions <= 0) continue;

        // Fetch the most recent attempt timestamp (best-effort)
        let lastSession = data.lastSessionAt || null;
        if (!lastSession) {
          try {
            const attQ = query(
              collection(db, "practiceAttempts"),
              where("userId", "==", userId),
              orderBy("timestamp", "desc"),
              limit(1)
            );
            const attSnap = await getDocs(attQ);
            if (!attSnap.empty) {
              lastSession = attSnap.docs[0].data().timestamp || null;
            }
          } catch (e) {
            // orderBy may require an index; ignore failure, lastSessionAt is enough
          }
        }

        // Build badge summary
        const parts = [];
        const streakMilestones = [3, 7, 14, 21, 28];
        const completedStreakBadges = data.completedStreakBadges || {};
        const currentStreakBadgeLevel = data.currentStreakBadgeLevel || 0;
        for (const m of streakMilestones) {
          const count =
            (completedStreakBadges[m] || 0) +
            (currentStreakBadgeLevel >= m ? 1 : 0);
          if (count > 0) parts.push(`🔥${m}d×${count}`);
        }
        if (data.doubleBadgeCount > 0) parts.push(`⚡2x×${data.doubleBadgeCount}`);
        if (data.tripleBadgeCount > 0) parts.push(`🚀3x×${data.tripleBadgeCount}`);
        if (data.quadrupleBadgeCount > 0) parts.push(`👑4x×${data.quadrupleBadgeCount}`);
        const badgeSummary = parts.length > 0 ? parts.join(" ") : "—";

        reportRows.push({
          userId,
          displayName: data.displayName || userId,
          totalSessions,
          totalSeconds: data.totalSeconds || 0,
          avgSeconds: data.avgSeconds || 0,
          bestSeconds: data.bestSeconds || 0,
          currentStreak: data.currentStreak || 0,
          bestStreak: data.bestStreak || 0,
          lastSession,
          badgeSummary,
          joined: !!data.joined,
        });
      }

      reportRows.sort((a, b) => b.totalSessions - a.totalSessions);
      setRows(reportRows);
      setLastRun(new Date());
      setHasLoaded(true);
    } catch (err) {
      console.error("AdminPracticeReport loadReport error:", err);
      alert("Failed to load practice report. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const userOptions = [
    { value: "all", label: "All Users" },
    ...rows.map((r) => ({ value: r.userId, label: r.displayName })),
  ];
  const filtered = filterUser === "all" ? rows : rows.filter((r) => r.userId === filterUser);

  return (
    <div style={{ padding: "0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>🏋️ Practice Session Report</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
            Built-in challenge id: <code>{PRACTICE_CHALLENGE_ID}</code>
            {lastRun && <> · Last updated: {lastRun.toLocaleTimeString()}</>}
          </p>
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
          {loading ? "Loading..." : hasLoaded ? "🔄 Refresh Report" : "Load Practice Report"}
        </button>
      </div>

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

      {!hasLoaded && !loading ? (
        <div
          style={{
            padding: "40px", textAlign: "center",
            backgroundColor: "white", borderRadius: "8px",
            color: "#6b7280", border: "1px dashed #d1d5db",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏋️</div>
          <p style={{ margin: 0, fontSize: "15px" }}>Click "Load Practice Report" to fetch the latest practice data.</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px" }}>This report runs on-demand to keep reads efficient.</p>
        </div>
      ) : loading ? (
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
          <p style={{ margin: "8px 0 0 0", fontSize: "13px" }}>Users who complete Practice Sessions will appear here.</p>
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
                  <td style={{ padding: "10px 12px", fontWeight: "600", color: "#111827" }}>
                    {row.displayName}
                    {!row.joined && (
                      <span style={{ marginLeft: "6px", fontSize: "10px", color: "#9ca3af" }}>(left)</span>
                    )}
                  </td>
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
