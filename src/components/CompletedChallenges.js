// src/components/CompletedChallenges.js

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

export default function CompletedChallenges({ user }) {
  const [completedChallenges, setCompletedChallenges] = useState([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [participantData, setParticipantData] = useState([]);
  const [teamData, setTeamData] = useState([]);
  const [aggregateData, setAggregateData] = useState(null);
  const [challengeDetails, setChallengeDetails] = useState(null);

  // Load all completed/deactivated challenges
  useEffect(() => {
    loadCompletedChallenges();
  }, []);

  // Load participant data when a challenge is selected
  useEffect(() => {
    if (selectedChallengeId) {
      loadChallengeData(selectedChallengeId);
    }
  }, [selectedChallengeId]);

  const loadCompletedChallenges = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "challenges"),
        where("isActive", "==", false)
      );
      const snapshot = await getDocs(q);
      const challenges = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        // Show all inactive challenges (includes force-ended ones)
        challenges.push({
          id: docSnap.id,
          ...data,
        });
      }

      // Sort by end date, most recent first
      challenges.sort((a, b) => {
        const aEnd = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
        const bEnd = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
        aEnd.setDate(aEnd.getDate() + a.numberOfDays);
        bEnd.setDate(bEnd.getDate() + b.numberOfDays);
        return bEnd - aEnd;
      });

      setCompletedChallenges(challenges);
    } catch (error) {
      console.error("Error loading completed challenges:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadChallengeData = async (challengeId) => {
    try {
      setLoading(true);

      // Get challenge details
      const challengeDoc = await getDoc(doc(db, "challenges", challengeId));
      if (!challengeDoc.exists()) return;
      const challenge = { id: challengeDoc.id, ...challengeDoc.data() };
      setChallengeDetails(challenge);

      // Get all userChallenges for this challenge
      const userChallengesQuery = query(
        collection(db, "userChallenges"),
        where("challengeId", "==", challengeId)
      );
      const userChallengesSnapshot = await getDocs(userChallengesQuery);

      // Get all attempts for this challenge
      const attemptsQuery = query(
        collection(db, "attempts"),
        where("challengeId", "==", challengeId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);

      // Get all userStats for badge data
      const userIds = new Set();
      userChallengesSnapshot.forEach(doc => {
        userIds.add(doc.data().userId);
      });

      const userStatsMap = {};
      for (const userId of userIds) {
        const userStatsDoc = await getDoc(doc(db, "userStats", userId));
        if (userStatsDoc.exists()) {
          userStatsMap[userId] = userStatsDoc.data();
        }
      }

      // Get teams if team challenge
      let teamsMap = {};
      if (challenge.isTeamChallenge) {
        const teamsQuery = query(collection(db, "teams"));
        const teamsSnapshot = await getDocs(teamsQuery);
        teamsSnapshot.forEach(doc => {
          teamsMap[doc.id] = { id: doc.id, ...doc.data() };
        });
      }

      // Get highest badge for a user
      const getHighestStreakBadge = (completedBadges) => {
        const levels = [28, 21, 14, 7, 3];
        for (const level of levels) {
          if (completedBadges[level] > 0) return level;
        }
        return 0;
      };

      const getHighestTimeBadge = (completedBadges) => {
        const levels = Object.keys(completedBadges).map(Number).sort((a, b) => b - a);
        return levels.length > 0 ? levels[0] : 0;
      };

      // Process participant data
      const participants = [];
      userChallengesSnapshot.forEach(docSnap => {
        const ucData = docSnap.data();
        const userId = ucData.userId;

        // Get attempts for this user
        const userAttempts = [];
        attemptsSnapshot.forEach(attemptDoc => {
          const attemptData = attemptDoc.data();
          if (attemptData.userId === userId) {
            userAttempts.push(attemptData);
          }
        });

        // Calculate stats
        const successfulAttempts = userAttempts.filter(a => a.success === true);
        const missedDays = userAttempts.filter(a => a.missed === true).length;
        const daysAttempted = userAttempts.filter(a => !a.missed).length;
        const daysCompleted = successfulAttempts.length;

        const totalValue = successfulAttempts.reduce((sum, a) => sum + (a.actualValue || 0), 0);
        const avgValue = daysCompleted > 0 ? totalValue / daysCompleted : 0;
        const bestValue = successfulAttempts.length > 0 
          ? Math.max(...successfulAttempts.map(a => a.actualValue || 0))
          : 0;
        
        const successRate = daysAttempted > 0 ? (daysCompleted / daysAttempted) * 100 : 0;

        // Get badge data
        const userStats = userStatsMap[userId];
        const badges = userStats?.badges?.challenges?.[challengeId] || {};

        participants.push({
          userId,
          displayName: ucData.displayName || "Anonymous",
          teamId: ucData.teamId || null,
          teamName: teamsMap[ucData.teamId]?.name || "",
          totalValue,
          avgValue,
          bestValue,
          daysCompleted,
          daysAttempted,
          missedDays,
          successRate,
          joinedAt: ucData.joinedAt,
          lastCompletedDay: ucData.lastCompletedDay || 0,
          badges: {
            currentStreak: badges.currentStreak || 0,
            currentStreakBadgeLevel: badges.currentStreakBadgeLevel || 0,
            completedStreakBadges: badges.completedStreakBadges || { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
            highestStreakBadge: getHighestStreakBadge(badges.completedStreakBadges || {}),
            doubleBadgeCount: badges.doubleBadgeCount || 0,
            tripleBadgeCount: badges.tripleBadgeCount || 0,
            quadrupleBadgeCount: badges.quadrupleBadgeCount || 0,
            totalPlankSeconds: badges.totalPlankSeconds || 0,
            currentTimeBadgeLevel: badges.currentTimeBadgeLevel || 0,
            completedTimeBadges: badges.completedTimeBadges || {},
            highestTimeBadge: getHighestTimeBadge(badges.completedTimeBadges || {}),
          },
        });
      });

      // Sort by finish order: most days completed, then total value, then earliest join
      participants.sort((a, b) => {
        if (b.daysCompleted !== a.daysCompleted) return b.daysCompleted - a.daysCompleted;
        if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
        const aTime = a.joinedAt?.toMillis ? a.joinedAt.toMillis() : 0;
        const bTime = b.joinedAt?.toMillis ? b.joinedAt.toMillis() : 0;
        return aTime - bTime;
      });

      setParticipantData(participants);

      // Generate all 30-minute time milestones up to 10 hours for aggregate
      const timeMilestones = [];
      for (let i = 1800; i <= 36000; i += 1800) {
        timeMilestones.push(i);
      }

      // Calculate aggregate data
      const aggregate = {
        totalParticipants: participants.length,
        totalValue: participants.reduce((sum, p) => sum + p.totalValue, 0),
        avgValue: participants.length > 0 
          ? participants.reduce((sum, p) => sum + p.totalValue, 0) / participants.length
          : 0,
        totalMissedDays: participants.reduce((sum, p) => sum + p.missedDays, 0),
        badges: {
          streak3: participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[3] || 0), 0),
          streak7: participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[7] || 0), 0),
          streak14: participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[14] || 0), 0),
          streak21: participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[21] || 0), 0),
          streak28: participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[28] || 0), 0),
          double: participants.reduce((sum, p) => sum + p.badges.doubleBadgeCount, 0),
          triple: participants.reduce((sum, p) => sum + p.badges.tripleBadgeCount, 0),
          quadruple: participants.reduce((sum, p) => sum + p.badges.quadrupleBadgeCount, 0),
        },
      };

      // Add time badge counts for each milestone
      timeMilestones.forEach(milestone => {
        aggregate.badges[`time${milestone}`] = participants.reduce((sum, p) => {
          return sum + (p.badges.completedTimeBadges[milestone] || 0);
        }, 0);
      });

      setAggregateData(aggregate);

      // Calculate team data if team challenge
      if (challenge.isTeamChallenge) {
        const teamMap = {};
        participants.forEach(p => {
          if (p.teamId) {
            if (!teamMap[p.teamId]) {
              teamMap[p.teamId] = {
                teamId: p.teamId,
                teamName: p.teamName,
                members: [],
                totalValue: 0,
                memberCount: 0,
              };
            }
            teamMap[p.teamId].members.push(p);
            teamMap[p.teamId].totalValue += p.totalValue;
            teamMap[p.teamId].memberCount += 1;
          }
        });

        const teams = Object.values(teamMap).map(t => ({
          ...t,
          avgValue: t.memberCount > 0 ? t.totalValue / t.memberCount : 0,
        }));

        // Sort by total value
        teams.sort((a, b) => b.totalValue - a.totalValue);
        setTeamData(teams);
      }
    } catch (error) {
      console.error("Error loading challenge data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatTimeShort = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const formatValue = (value, type) => {
    if (type === "plank") {
      return formatTime(value);
    }
    return Math.round(value).toString();
  };

  if (loading && completedChallenges.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading completed challenges...</p>
      </div>
    );
  }

  if (completedChallenges.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#999" }}>No completed challenges yet.</p>
      </div>
    );
  }

  // Generate time milestone headers (30 min increments up to 10 hours)
  const timeMilestones = [];
  for (let i = 1800; i <= 36000; i += 1800) {
    timeMilestones.push(i);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Completed Challenges</h2>

      {/* Challenge Selector */}
      <div style={{ marginBottom: "30px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "10px" }}>
          Select Challenge:
        </label>
        <select
          value={selectedChallengeId}
          onChange={(e) => setSelectedChallengeId(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "500px",
            padding: "10px",
            fontSize: "16px",
            borderRadius: "5px",
            border: "1px solid #ddd",
          }}
        >
          <option value="">-- Select a challenge --</option>
          {completedChallenges.map(challenge => (
            <option key={challenge.id} value={challenge.id}>
              {challenge.name} ({challenge.type}) - Ended {new Date(challenge.startDate.toDate().getTime() + challenge.numberOfDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {/* Data Display */}
      {selectedChallengeId && challengeDetails && (
        <div>
          {loading ? (
            <p>Loading challenge data...</p>
          ) : (
            <>
              {/* Challenge Info */}
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}>
                <h3>{challengeDetails.name}</h3>
                <p><strong>Type:</strong> {challengeDetails.type === "plank" ? "Plank (time)" : "Squat (reps)"}</p>
                <p><strong>Duration:</strong> {challengeDetails.numberOfDays} days</p>
                <p><strong>Started:</strong> {challengeDetails.startDate.toDate().toLocaleDateString()}</p>
                <p><strong>Team Challenge:</strong> {challengeDetails.isTeamChallenge ? "Yes" : "No"}</p>
              </div>

              {/* Team Summary (if team challenge) */}
              {challengeDetails.isTeamChallenge && teamData.length > 0 && (
                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}>
                  <h3>Team Summary</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f0f0f0" }}>
                          <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Rank</th>
                          <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Team</th>
                          <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Members</th>
                          <th style={{ padding: "10px", textAlign: "right", border: "1px solid #ddd" }}>Total {challengeDetails.type === "plank" ? "Time" : "Reps"}</th>
                          <th style={{ padding: "10px", textAlign: "right", border: "1px solid #ddd" }}>Avg per Member</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.map((team, index) => (
                          <tr key={team.teamId}>
                            <td style={{ padding: "10px", border: "1px solid #ddd" }}>{index + 1}</td>
                            <td style={{ padding: "10px", border: "1px solid #ddd" }}>{team.teamName}</td>
                            <td style={{ padding: "10px", border: "1px solid #ddd" }}>{team.memberCount}</td>
                            <td style={{ padding: "10px", textAlign: "right", border: "1px solid #ddd" }}>
                              {formatValue(team.totalValue, challengeDetails.type)}
                            </td>
                            <td style={{ padding: "10px", textAlign: "right", border: "1px solid #ddd" }}>
                              {formatValue(team.avgValue, challengeDetails.type)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Participant Data */}
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}>
                <h3>Participant Results</h3>
                <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px" }}>Select and copy the table below to paste into Excel or Google Sheets</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f0f0f0" }}>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Rank</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Name</th>
                        {challengeDetails.isTeamChallenge && (
                          <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Team</th>
                        )}
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Total {challengeDetails.type === "plank" ? "Time" : "Reps"}</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Avg per Day</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Best</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Days Done</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Days Missed</th>
                        <th style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Success %</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Highest Streak</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>3-Day</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>7-Day</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>14-Day</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>21-Day</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>28-Day</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>2x</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>3x</th>
                        <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>4x</th>
                        {challengeDetails.type === "plank" && (
                          <>
                            <th style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>Highest Time</th>
                            {timeMilestones.map(ms => (
                              <th key={ms} style={{ padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" }}>
                                {formatTimeShort(ms)}
                              </th>
                            ))}
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {participantData.map((participant, index) => (
                        <tr key={participant.userId}>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{index + 1}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.displayName}</td>
                          {challengeDetails.isTeamChallenge && (
                            <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.teamName}</td>
                          )}
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>
                            {formatValue(participant.totalValue, challengeDetails.type)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>
                            {formatValue(participant.avgValue, challengeDetails.type)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>
                            {formatValue(participant.bestValue, challengeDetails.type)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>{participant.daysCompleted}</td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>{participant.missedDays}</td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>{participant.successRate.toFixed(1)}%</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                            {participant.badges.highestStreakBadge > 0 ? `${participant.badges.highestStreakBadge}d` : "-"}
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.completedStreakBadges[3] || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.completedStreakBadges[7] || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.completedStreakBadges[14] || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.completedStreakBadges[21] || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.completedStreakBadges[28] || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.doubleBadgeCount}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.tripleBadgeCount}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{participant.badges.quadrupleBadgeCount}</td>
                          {challengeDetails.type === "plank" && (
                            <>
                              <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                                {participant.badges.highestTimeBadge > 0 ? formatTimeShort(participant.badges.highestTimeBadge) : "-"}
                              </td>
                              {timeMilestones.map(ms => (
                                <td key={ms} style={{ padding: "8px", border: "1px solid #ddd" }}>
                                  {participant.badges.completedTimeBadges[ms] || 0}
                                </td>
                              ))}
                            </>
                          )}
                        </tr>
                      ))}
                      {/* Aggregate Row */}
                      {aggregateData && (
                        <tr style={{ backgroundColor: "#e8f5e9", fontWeight: "bold" }}>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }} colSpan="2">TOTALS ({aggregateData.totalParticipants} participants)</td>
                          {challengeDetails.isTeamChallenge && <td style={{ padding: "8px", border: "1px solid #ddd" }}>-</td>}
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>
                            {formatValue(aggregateData.totalValue, challengeDetails.type)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>
                            {formatValue(aggregateData.avgValue, challengeDetails.type)}
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>-</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>-</td>
                          <td style={{ padding: "8px", textAlign: "right", border: "1px solid #ddd" }}>{aggregateData.totalMissedDays}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>-</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>-</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.streak3 || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.streak7 || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.streak14 || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.streak21 || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.streak28 || 0}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.double}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.triple}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd" }}>{aggregateData.badges.quadruple}</td>
                          {challengeDetails.type === "plank" && (
                            <>
                              <td style={{ padding: "8px", border: "1px solid #ddd" }}>-</td>
                              {timeMilestones.map(ms => (
                                <td key={ms} style={{ padding: "8px", border: "1px solid #ddd" }}>
                                  {aggregateData.badges[`time${ms}`] || 0}
                                </td>
                              ))}
                            </>
                          )}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
