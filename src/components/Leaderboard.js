// src/components/Leaderboard.js
import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

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
  const [teamViewMode, setTeamViewMode] = useState("total"); // "total" | "average"

  // NEW: History viewing
  const [viewMode, setViewMode] = useState("current"); // "current" | "previous1" | "previous2"
  const [historyData, setHistoryData] = useState({ previous1: null, previous2: null });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cache refs
  const cacheRef = useRef({
    challengeId: null,
    entries: [],
    teams: [],
    teamStandings: [],
    timestamp: null,
  });

  // Check if active challenge is a team challenge
  const isTeamChallenge = viewMode === "current" 
    ? (activeChallenge?.isTeamChallenge || false)
    : (viewMode === "previous1" && historyData.previous1?.isTeamChallenge) ||
      (viewMode === "previous2" && historyData.previous2?.isTeamChallenge) ||
      false;

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

  // Load leaderboard history when movement type changes
  useEffect(() => {
    loadLeaderboardHistory();
  }, [movementType]);

  // Load current leaderboard entries when active challenge changes
  useEffect(() => {
    if (viewMode === "current") {
      loadCurrentLeaderboard();
    }
  }, [activeChallenge, teams, viewMode]);

  // NEW: Load leaderboard history
  const loadLeaderboardHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "leaderboardHistory"),
        where("challengeType", "==", movementType),
        orderBy("archivedAt", "desc"),
        limit(2)
      );
      const snapshot = await getDocs(q);
      
      const archives = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setHistoryData({
        previous1: archives[0] || null,
        previous2: archives[1] || null,
      });
    } catch (error) {
      console.error("Error loading leaderboard history:", error);
      setHistoryData({ previous1: null, previous2: null });
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadCurrentLeaderboard = async () => {
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
          teamId: data.teamId || null,
        };
      });

      setEntries(rows);

      // Calculate team standings ONLY if this is a team challenge
      if (activeChallenge.isTeamChallenge) {
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
            avgSeconds: t.memberCount > 0 ? Math.round(t.totalSeconds / t.memberCount) : 0,
            avgReps: t.memberCount > 0 ? Math.round(t.totalReps / t.memberCount) : 0,
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
        teamStandings: activeChallenge.isTeamChallenge ? teamStandings : [],
        timestamp: now,
        teams: teams,
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

  // Manual refresh function
  const handleRefresh = () => {
    if (viewMode === "current") {
      cacheRef.current.timestamp = null; // invalidate cache
      loadCurrentLeaderboard();
    }
  };

  // Get data based on view mode
  const getCurrentViewData = () => {
    if (viewMode === "current") {
      return {
        entries,
        teamStandings,
        isTeamChallenge: activeChallenge?.isTeamChallenge || false,
        challengeName: activeChallenge?.name || "",
        challengeDescription: activeChallenge?.description || "",
        startDate: activeChallenge?.startDate?.toDate ? activeChallenge.startDate.toDate() : null,
        endDate: null,
      };
    } else if (viewMode === "previous1" && historyData.previous1) {
      return {
        entries: historyData.previous1.topTotal || [],
        teamStandings: historyData.previous1.teamStandings || [],
        isTeamChallenge: historyData.previous1.isTeamChallenge || false,
        challengeName: historyData.previous1.challengeName || "",
        challengeDescription: historyData.previous1.challengeDescription || "",
        startDate: historyData.previous1.startDate?.toDate ? historyData.previous1.startDate.toDate() : null,
        endDate: historyData.previous1.endDate?.toDate ? historyData.previous1.endDate.toDate() : null,
      };
    } else if (viewMode === "previous2" && historyData.previous2) {
      return {
        entries: historyData.previous2.topTotal || [],
        teamStandings: historyData.previous2.teamStandings || [],
        isTeamChallenge: historyData.previous2.isTeamChallenge || false,
        challengeName: historyData.previous2.challengeName || "",
        challengeDescription: historyData.previous2.challengeDescription || "",
        startDate: historyData.previous2.startDate?.toDate ? historyData.previous2.startDate.toDate() : null,
        endDate: historyData.previous2.endDate?.toDate ? historyData.previous2.endDate.toDate() : null,
      };
    }
    return {
      entries: [],
      teamStandings: [],
      isTeamChallenge: false,
      challengeName: "",
      challengeDescription: "",
      startDate: null,
      endDate: null,
    };
  };

  const viewData = getCurrentViewData();
  const isPlank = movementType === "plank";

  // Filter entries by selected team (only for team challenges)
  const filteredEntries =
    isTeamChallenge && selectedTeamFilter !== "all"
      ? viewData.entries.filter((e) => e.teamId === selectedTeamFilter)
      : viewData.entries;

  // Sorting helpers with tie-breakers
  const compareTotals = (a, b) => {
    const aVal = isPlank ? a.totalSeconds : a.totalReps;
    const bVal = isPlank ? b.totalSeconds : b.totalReps;

    if (bVal !== aVal) return bVal - aVal;

    const aTime = a.firstAchievedAt?.toMillis
      ? a.firstAchievedAt.toMillis()
      : null;
    const bTime = b.firstAchievedAt?.toMillis
      ? b.firstAchievedAt.toMillis()
      : null;

    if (aTime && bTime && aTime !== bTime) {
      return aTime - bTime;
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

    if (bVal !== aVal) return bVal - aVal;

    const aTime = a.firstAchievedAt?.toMillis
      ? a.firstAchievedAt.toMillis()
      : null;
    const bTime = b.firstAchievedAt?.toMillis
      ? b.firstAchievedAt.toMillis()
      : null;

    if (aTime && bTime && aTime !== bTime) {
      return aTime - bTime;
    }

    const nameA = (a.displayName || "").toLowerCase();
    const nameB = (b.displayName || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  };

  // Get top performers (for historical, already limited to 10, for current slice to 10)
  const topTotal = viewMode === "current" 
    ? [...filteredEntries].sort(compareTotals).slice(0, 10)
    : filteredEntries; // Historical data already contains top 10

  // For best, historical has topBest array
  const topBest = viewMode === "current"
    ? [...filteredEntries].sort(compareBests).slice(0, 5)
    : (viewMode === "previous1" && historyData.previous1?.topBest) ||
      (viewMode === "previous2" && historyData.previous2?.topBest) ||
      [];

  // Sort team standings based on view mode
  const sortedTeamStandings = [...viewData.teamStandings].sort((a, b) => {
    if (teamViewMode === "average") {
      const aVal = isPlank ? a.avgSeconds : a.avgReps;
      const bVal = isPlank ? b.avgSeconds : b.avgReps;
      return bVal - aVal;
    } else {
      const aVal = isPlank ? a.totalSeconds : a.totalReps;
      const bVal = isPlank ? b.totalSeconds : b.totalReps;
      return bVal - aVal;
    }
  });

  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  const formatDateRange = (start, end) => {
    if (!start) return "";
    const startStr = start.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric" 
    });
    if (!end) return startStr;
    const endStr = end.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric" 
    });
    return `${startStr} - ${endStr}`;
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
          onClick={() => {
            setMovementType("plank");
            setViewMode("current");
          }}
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
          onClick={() => {
            setMovementType("squat");
            setViewMode("current");
          }}
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

      {/* NEW: History Toggle */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={() => setViewMode("current")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            backgroundColor: viewMode === "current" ? "#2196F3" : "#fff",
            color: viewMode === "current" ? "#fff" : "#333",
            cursor: "pointer",
            fontWeight: viewMode === "current" ? "bold" : "normal",
          }}
        >
          Current
        </button>
        <button
          onClick={() => setViewMode("previous1")}
          disabled={!historyData.previous1}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            backgroundColor: viewMode === "previous1" ? "#2196F3" : "#fff",
            color: viewMode === "previous1" ? "#fff" : historyData.previous1 ? "#333" : "#999",
            cursor: historyData.previous1 ? "pointer" : "not-allowed",
            fontWeight: viewMode === "previous1" ? "bold" : "normal",
            opacity: historyData.previous1 ? 1 : 0.6,
          }}
        >
          Previous #1
        </button>
        <button
          onClick={() => setViewMode("previous2")}
          disabled={!historyData.previous2}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            backgroundColor: viewMode === "previous2" ? "#2196F3" : "#fff",
            color: viewMode === "previous2" ? "#fff" : historyData.previous2 ? "#333" : "#999",
            cursor: historyData.previous2 ? "pointer" : "not-allowed",
            fontWeight: viewMode === "previous2" ? "bold" : "normal",
            opacity: historyData.previous2 ? 1 : 0.6,
          }}
        >
          Previous #2
        </button>
      </div>

      {/* Last Updated & Refresh Button (only for current view) */}
      {viewMode === "current" && lastFetched && (
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

      {/* Challenge Info */}
      {viewMode === "current" && !activeChallenge && (
        <p style={{ color: "#999" }}>
          No active {movementType} challenge found.
        </p>
      )}

      {viewMode !== "current" && !viewData.challengeName && (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            color: "#666",
          }}
        >
          <p style={{ fontSize: "16px", margin: 0 }}>
            No archived challenge yet - check back soon!
          </p>
        </div>
      )}

      {viewData.challengeName && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: "#f5f5f5",
          }}
        >
          <div style={{ fontWeight: "600" }}>
            {viewData.challengeName}
            {viewMode !== "current" && (
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "12px",
                  color: "#666",
                  fontWeight: "normal",
                }}
              >
                ({formatDateRange(viewData.startDate, viewData.endDate)})
              </span>
            )}
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
            {viewData.challengeDescription}
          </div>
        </div>
      )}

      {loading && <p>Loading leaderboard...</p>}

      {!loading && viewData.challengeName && viewData.entries.length === 0 && (
        <p style={{ color: "#999" }}>No stats yet for this challenge.</p>
      )}

      {!loading && viewData.challengeName && viewData.entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* TEAM STANDINGS - Only show for team challenges */}
          {isTeamChallenge && sortedTeamStandings.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ margin: 0 }}>Team Standings</h3>
                
                {/* View Mode Toggle */}
                <div style={{ display: "flex", gap: "4px", backgroundColor: "#f0f0f0", padding: "2px", borderRadius: "6px" }}>
                  <button
                    onClick={() => setTeamViewMode("total")}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: teamViewMode === "total" ? "#4CAF50" : "transparent",
                      color: teamViewMode === "total" ? "white" : "#666",
                      fontWeight: teamViewMode === "total" ? "bold" : "normal",
                    }}
                  >
                    Total
                  </button>
                  <button
                    onClick={() => setTeamViewMode("average")}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: teamViewMode === "average" ? "#4CAF50" : "transparent",
                      color: teamViewMode === "average" ? "white" : "#666",
                      fontWeight: teamViewMode === "average" ? "bold" : "normal",
                    }}
                  >
                    Average
                  </button>
                </div>
              </div>

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
                        {teamViewMode === "total" ? "Total" : "Avg/Member"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeamStandings.map((team, idx) => {
                      const displayVal = teamViewMode === "total"
                        ? (isPlank ? team.totalSeconds : team.totalReps)
                        : (isPlank ? team.avgSeconds : team.avgReps);
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
                            {isPlank ? formatSeconds(displayVal) : displayVal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TEAM FILTER - Only show for team challenges and current view */}
          {viewMode === "current" && isTeamChallenge && teams.length > 0 && (
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
              {viewMode === "current" && isTeamChallenge && selectedTeamFilter !== "all" &&
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
                        key={row.id || idx}
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
              {viewMode === "current" && isTeamChallenge && selectedTeamFilter !== "all" &&
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
                        key={row.id || idx}
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
