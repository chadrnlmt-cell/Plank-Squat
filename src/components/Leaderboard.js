// src/components/Leaderboard.js
import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function Leaderboard({ user, challenges }) {
  const [movementType, setMovementType] = useState("plank"); // "plank" | "squat"
  const [loading, setLoading] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [entries, setEntries] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState("all"); // "all" or teamId
  const [teamStandings, setTeamStandings] = useState([]);
  const [lastFetched, setLastFetched] = useState(null); // timestamp of last fetch

  // Cache refs
  const cacheRef = useRef({
    challengeId: null,
    entries: [],
    teams: [],
    teamStandings: [],
    timestamp: null,
  });

  // Check if active challenge is a team challenge
  const isTeamChallenge = activeChallenge?.isTeamChallenge || false;

  // Load teams (cached with same 5-min logic)
  useEffect(() => {
    const loadTeams = async () => {
      // Check cache first
      if (
        cacheRef.current.teams.length > 0 &&
        cacheRef.current.timestamp &&
        Date.now() - cacheRef.current.timestamp < CACHE_DURATION_MS
      ) {
        setTeams(cacheRef.current.teams);
        return;
      }

      try {
        const q = query(collection(db, "teams"));
        const snapshot = await getDocs(q);
        const teamData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTeams(teamData);
        cacheRef.current.teams = teamData;
        cacheRef.current.timestamp = Date.now();
      } catch (error) {
        console.error("Error loading teams:", error);
        setTeams([]);
      }
    };
    loadTeams();
  }, []);

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
        setTeamStandings([]);
        setLastFetched(null);
        return;
      }

      // Check cache: if same challenge and within 5 minutes, use cached data
      if (
        cacheRef.current.challengeId === activeChallenge.id &&
        cacheRef.current.timestamp &&
        Date.now() - cacheRef.current.timestamp < CACHE_DURATION_MS
      ) {
        console.log("Using cached leaderboard data");
        setEntries(cacheRef.current.entries);
        setTeamStandings(cacheRef.current.teamStandings);
        setLastFetched(new Date(cacheRef.current.timestamp));
        return;
      }

      setLoading(true);
      try {
        // Load user stats - NOW includes teamId directly!
        const statsRef = collection(db, "challengeUserStats");
        const qStats = query(
          statsRef,
          where("challengeId", "==", activeChallenge.id)
        );
        const snap = await getDocs(qStats);

        // NO MORE userChallenges query needed! teamId is in challengeUserStats now
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
            teamId: data.teamId || null, // NEW: read directly from challengeUserStats!
          };
        });

        setEntries(rows);

        // Calculate team standings ONLY if this is a team challenge
        if (isTeamChallenge) {
          const teamTotals = {};
          rows.forEach((row) => {
            if (row.teamId) {
              if (!teamTotals[row.teamId]) {
                teamTotals[row.teamId] = {
                  teamId: row.teamId,
                  totalSeconds: 0,
                  totalReps: 0,
                  memberCount: 0,
                };
              }
              teamTotals[row.teamId].totalSeconds += row.totalSeconds || 0;
              teamTotals[row.teamId].totalReps += row.totalReps || 0;
              teamTotals[row.teamId].memberCount += 1;
            }
          });

          const standings = Object.values(teamTotals).map((t) => {
            const team = teams.find((tm) => tm.id === t.teamId);
            return {
              ...t,
              teamName: team?.name || "Unknown Team",
              teamColor: team?.color || "#999",
            };
          });

          setTeamStandings(standings);
        } else {
          setTeamStandings([]);
        }

        // Cache the results
        const now = Date.now();
        cacheRef.current = {
          challengeId: activeChallenge.id,
          entries: rows,
          teamStandings: isTeamChallenge ? teamStandings : [],
          timestamp: now,
          teams: teams, // cache teams too
        };
        setLastFetched(new Date(now));

        console.log("Leaderboard data fetched and cached");
      } catch (err) {
        console.error("Error loading leaderboard:", err);
        setEntries([]);
        setTeamStandings([]);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [activeChallenge, teams, isTeamChallenge]);

  // Manual refresh function
  const handleRefresh = () => {
    cacheRef.current.timestamp = null; // invalidate cache
    setActiveChallenge({ ...activeChallenge }); // trigger reload
  };

  const isPlank = movementType === "plank";

  // Filter entries by selected team (only for team challenges)
  const filteredEntries =
    isTeamChallenge && selectedTeamFilter !== "all"
      ? entries.filter((e) => e.teamId === selectedTeamFilter)
      : entries;

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

  const topTotal = [...filteredEntries].sort(compareTotals).slice(0, 10);
  const topBest = [...filteredEntries].sort(compareBests).slice(0, 5);

  // Sort team standings
  const sortedTeamStandings = [...teamStandings].sort((a, b) => {
    const aVal = isPlank ? a.totalSeconds : a.totalReps;
    const bVal = isPlank ? b.totalSeconds : b.totalReps;
    return bVal - aVal;
  });

  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  // Helper to get team info
  const getTeamInfo = (teamId) => {
    const team = teams.find((t) => t.id === teamId);
    return team || null;
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

      {/* Last Updated & Refresh Button */}
      {lastFetched && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            padding: "8px 12px",
            backgroundColor: "#f9f9f9",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          <span>Last updated: {lastFetched.toLocaleTimeString()}</span>
          <button
            onClick={handleRefresh}
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      )}

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
          <div style={{ fontWeight: "600" }}>
            {activeChallenge.name}
            {isTeamChallenge && (
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "11px",
                  padding: "2px 6px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  borderRadius: "3px",
                }}
              >
                TEAM CHALLENGE
              </span>
            )}
          </div>
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
          {/* TEAM STANDINGS - Only show for team challenges */}
          {isTeamChallenge && teamStandings.length > 0 && (
            <div>
              <h3 style={{ marginBottom: "8px" }}>Team Standings</h3>
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
                        Team
                      </th>
                      <th
                        style={{
                          textAlign: "center",
                          padding: "8px",
                        }}
                      >
                        Members
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
                    {sortedTeamStandings.map((team, idx) => {
                      const totalVal = isPlank
                        ? team.totalSeconds
                        : team.totalReps;
                      return (
                        <tr
                          key={team.teamId}
                          style={{
                            backgroundColor: "white",
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
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <div
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: team.teamColor,
                              }}
                            />
                            {team.teamName}
                          </td>
                          <td
                            style={{
                              padding: "8px",
                              textAlign: "center",
                            }}
                          >
                            {team.memberCount}
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
          )}

          {/* TEAM FILTER - Only show for team challenges */}
          {isTeamChallenge && teams.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "8px",
                }}
              >
                Filter by Team
              </label>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              >
                <option value="all">All Participants</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Top 10 total */}
          <div>
            <h3 style={{ marginBottom: "8px" }}>
              Top 10 by{" "}
              {isPlank ? "Total Plank Time (seconds)" : "Total Squat Reps"}
              {isTeamChallenge && selectedTeamFilter !== "all" &&
                ` - ${teams.find((t) => t.id === selectedTeamFilter)?.name || ""}`}
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
                    const teamInfo = getTeamInfo(row.teamId);
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
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {isTeamChallenge && teamInfo && (
                            <div
                              style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: teamInfo.color,
                              }}
                            />
                          )}
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
            <h3 style={{ marginBottom: "8px" }}>
              Top 5 by Best Single Day
              {isTeamChallenge && selectedTeamFilter !== "all" &&
                ` - ${teams.find((t) => t.id === selectedTeamFilter)?.name || ""}`}
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
                      Best Day
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topBest.map((row, idx) => {
                    const bestVal = isPlank ? row.bestSeconds : row.bestReps;
                    const teamInfo = getTeamInfo(row.teamId);
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
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {isTeamChallenge && teamInfo && (
                            <div
                              style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: teamInfo.color,
                              }}
                            />
                          )}
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
