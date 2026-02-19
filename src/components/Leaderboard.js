// src/components/Leaderboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Leaderboard({ user, challenges }) {
  const [movementType, setMovementType] = useState("plank"); // "plank" | "squat"
  const [loading, setLoading] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [entries, setEntries] = useState([]);

  // Find the active challenge for the selected movement type
  useEffect(() => {
    if (!challenges || challenges.length === 0) {
      setActiveChallenge(null);
      return;
    }
    const candidate = challenges.find(
      (c) => c.type === movementType && c.isActive
    );
    setActiveChallenge(candidate || null);
  }, [movementType, challenges]);

  // Load leaderboard entries when active challenge changes
  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!activeChallenge) {
        setEntries([]);
        return;
      }

      setLoading(true);
      try {
        const statsRef = collection(db, "challengeUserStats");
        const qStats = query(
          statsRef,
          where("challengeId", "==", activeChallenge.id)
        );
        const snap = await getDocs(qStats);

        const rows = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            userId: data.userId || null,
            displayName: data.displayName || "Anonymous",
            photoURL: data.photoURL || null,
            totalSeconds: data.totalSeconds || 0,
            totalReps: data.totalReps || 0,
            bestSeconds: data.bestSeconds || 0,
            bestReps: data.bestReps || 0,
            firstAchievedAt: data.firstAchievedAt || null,
          };
        });

        setEntries(rows);
      } catch (err) {
        console.error("Error loading leaderboard:", err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [activeChallenge]);

  const isPlank = movementType === "plank";

  // Sorting helpers with tie-breakers
  const compareTotals = (a, b) => {
    const aVal = isPlank ? a.totalSeconds : a.totalReps;
    const bVal = isPlank ? b.totalSeconds : b.totalReps;

    if (bVal !== aVal) return bVal - aVal; // higher total first

    const aTime = a.firstAchievedAt?.toMillis
      ? a.firstAchievedAt.toMillis()
      : null;
    const bTime = b.firstAchievedAt?.toMillis
      ? b.firstAchievedAt.toMillis()
      : null;

    if (aTime && bTime && aTime !== bTime) {
      return aTime - bTime; // earlier firstAchievedAt wins
    }

    const nameA = (a.displayName || "").toLowerCase();
    const nameB = (b.displayName || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  };

  const compareBests = (a, b) => {
    const aVal = isPlank ? a.bestSeconds : a.bestReps;
    const bVal = isPlank ? b.bestSeconds : b.bestReps;

    if (bVal !== aVal) return bVal - aVal; // higher best first

    const aTime = a.firstAchievedAt?.toMillis
      ? a.firstAchievedAt.toMillis()
      : null;
    const bTime = b.firstAchievedAt?.toMillis
      ? b.firstAchievedAt.toMillis()
      : null;

    if (aTime && bTime && aTime !== bTime) {
      return aTime - bTime; // earlier firstAchievedAt wins
    }

    const nameA = (a.displayName || "").toLowerCase();
    const nameB = (b.displayName || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  };

  const topTotal = [...entries].sort(compareTotals).slice(0, 10);
  const topBest = [...entries].sort(compareBests).slice(0, 5);

  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  return (
    <div>
      <h2>Leaderboards</h2>

      {/* Movement Toggle */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={() => setMovementType("plank")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            backgroundColor: isPlank ? "#4CAF50" : "#fff",
            color: isPlank ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          Plank
        </button>
        <button
          onClick={() => setMovementType("squat")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            backgroundColor: !isPlank ? "#4CAF50" : "#fff",
            color: !isPlank ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          Squat
        </button>
      </div>

      {/* Active Challenge Info */}
      {!activeChallenge && (
        <p style={{ color: "#999" }}>
          No active {movementType} challenge found.
        </p>
      )}

      {activeChallenge && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: "#f5f5f5",
          }}
        >
          <div style={{ fontWeight: "600" }}>{activeChallenge.name}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {activeChallenge.description}
          </div>
        </div>
      )}

      {loading && <p>Loading leaderboard...</p>}

      {!loading && activeChallenge && entries.length === 0 && (
        <p style={{ color: "#999" }}>No stats yet for this challenge.</p>
      )}

      {!loading && activeChallenge && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Top 10 total */}
          <div>
            <h3 style={{ marginBottom: "8px" }}>
              Top 10 by{" "}
              {isPlank ? "Total Plank Time (seconds)" : "Total Squat Reps"}
            </h3>
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid #ddd",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead
                  style={{
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px",
                      }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTotal.map((row, idx) => {
                    const totalVal = isPlank ? row.totalSeconds : row.totalReps;
                    return (
                      <tr
                        key={row.id}
                        style={{
                          backgroundColor:
                            row.userId === user?.uid ? "#e8f5e9" : "white",
                          borderTop: "1px solid #eee",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px",
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                          }}
                        >
                          {row.displayName || "Anonymous"}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            textAlign: "right",
                          }}
                        >
                          {isPlank ? formatSeconds(totalVal) : totalVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 best single day */}
          <div>
            <h3 style={{ marginBottom: "8px" }}>Top 5 by Best Single Day</h3>
            <div
              style={{
                borderRadius: "8px",
                border: "1px solid #ddd",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead
                  style={{
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px",
                      }}
                    >
                      Best Day
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topBest.map((row, idx) => {
                    const bestVal = isPlank ? row.bestSeconds : row.bestReps;
                    return (
                      <tr
                        key={row.id}
                        style={{
                          backgroundColor:
                            row.userId === user?.uid ? "#e8f5e9" : "white",
                          borderTop: "1px solid #eee",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px",
                          }}
                        >
                          {idx + 1}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                          }}
                        >
                          {row.displayName || "Anonymous"}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            textAlign: "right",
                          }}
                        >
                          {isPlank ? formatSeconds(bestVal) : bestVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
