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

  useEffect(() => { loadCompletedChallenges(); }, []);
  useEffect(() => { if (selectedChallengeId) loadChallengeData(selectedChallengeId); }, [selectedChallengeId]);

  const loadCompletedChallenges = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "challenges"), where("isActive", "==", false));
      const snapshot = await getDocs(q);
      const challenges = [];

      for (const docSnap of snapshot.docs) {
        challenges.push({ id: docSnap.id, ...docSnap.data() });
      }

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

      const challengeDoc = await getDoc(doc(db, "challenges", challengeId));
      if (!challengeDoc.exists()) return;
      const challenge = { id: challengeDoc.id, ...challengeDoc.data() };
      setChallengeDetails(challenge);

      const userChallengesQuery = query(collection(db, "userChallenges"), where("challengeId", "==", challengeId));
      const userChallengesSnapshot = await getDocs(userChallengesQuery);

      const attemptsQuery = query(collection(db, "attempts"), where("challengeId", "==", challengeId));
      const attemptsSnapshot = await getDocs(attemptsQuery);

      const userIds = new Set();
      userChallengesSnapshot.forEach(d => userIds.add(d.data().userId));

      const userStatsMap = {};
      for (const userId of userIds) {
        const userStatsDoc = await getDoc(doc(db, "userStats", userId));
        if (userStatsDoc.exists()) userStatsMap[userId] = userStatsDoc.data();
      }

      let teamsMap = {};
      if (challenge.isTeamChallenge) {
        const teamsSnapshot = await getDocs(query(collection(db, "teams")));
        teamsSnapshot.forEach(d => { teamsMap[d.id] = { id: d.id, ...d.data() }; });
      }

      const getHighestStreakBadge = (completedBadges) => {
        for (const level of [28, 21, 14, 7, 3]) {
          if ((completedBadges[level] || 0) > 0) return level;
        }
        return 0;
      };

      const getHighestTimeBadge = (completedBadges) => {
        const levels = Object.keys(completedBadges).map(Number).sort((a, b) => b - a);
        return levels.length > 0 ? levels[0] : 0;
      };

      const extractVal = (item) => (typeof item === "object" && item !== null ? item.value : item);

      const participants = [];
      userChallengesSnapshot.forEach(docSnap => {
        const ucData = docSnap.data();
        const userId = ucData.userId;

        const userAttempts = [];
        attemptsSnapshot.forEach(attemptDoc => {
          if (attemptDoc.data().userId === userId) userAttempts.push(attemptDoc.data());
        });

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

        const userStats = userStatsMap[userId];
        const badges = userStats?.badges?.challenges?.[challengeId] || {};

        const rawRunBadges = userStats?.badges?.legacy?.earnedConsecutiveRunBadges || [];
        const legacyRunAtJoin = ucData.legacyRunAtJoin || 0;
        const challengeRunBadges = rawRunBadges
          .filter(item => extractVal(item) !== undefined)
          .filter(item => {
            const src = typeof item === "object" ? item.challengeId : null;
            return src === challengeId;
          })
          .map(item => extractVal(item));
        const newLegacyStreakBadge = challengeRunBadges.length > 0 ? Math.max(...challengeRunBadges) : null;

        const rawTimeBadges = userStats?.badges?.legacy?.earnedTimeBadges || [];
        const challengeTimeBadges = rawTimeBadges
          .filter(item => extractVal(item) !== undefined)
          .filter(item => {
            const src = typeof item === "object" ? item.challengeId : null;
            return src === challengeId;
          })
          .map(item => extractVal(item));
        const newLegacyTimeBadge = challengeTimeBadges.length > 0 ? Math.max(...challengeTimeBadges) : null;

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
          newLegacyStreakBadge,
          newLegacyTimeBadge,
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

      participants.sort((a, b) => {
        if (b.daysCompleted !== a.daysCompleted) return b.daysCompleted - a.daysCompleted;
        if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
        const aTime = a.joinedAt?.toMillis ? a.joinedAt.toMillis() : 0;
        const bTime = b.joinedAt?.toMillis ? b.joinedAt.toMillis() : 0;
        return aTime - bTime;
      });

      setParticipantData(participants);

      // Active challenge milestones: 15-min steps up to 5 hours
      const timeMilestones = [];
      for (let i = 900; i <= 18000; i += 900) timeMilestones.push(i);

      const colVisible = {
        streak3:          participants.some(p => (p.badges.completedStreakBadges[3]  || 0) > 0),
        streak7:          participants.some(p => (p.badges.completedStreakBadges[7]  || 0) > 0),
        streak14:         participants.some(p => (p.badges.completedStreakBadges[14] || 0) > 0),
        streak21:         participants.some(p => (p.badges.completedStreakBadges[21] || 0) > 0),
        streak28:         participants.some(p => (p.badges.completedStreakBadges[28] || 0) > 0),
        double:           participants.some(p => p.badges.doubleBadgeCount > 0),
        triple:           participants.some(p => p.badges.tripleBadgeCount > 0),
        quadruple:        participants.some(p => p.badges.quadrupleBadgeCount > 0),
        newLegacyStreak:  participants.some(p => p.newLegacyStreakBadge !== null),
        newLegacyTime:    participants.some(p => p.newLegacyTimeBadge !== null),
        highestTimeBadge: participants.some(p => p.badges.highestTimeBadge > 0),
      };

      const timeMsVisible = {};
      timeMilestones.forEach(ms => {
        timeMsVisible[ms] = participants.some(p => (p.badges.completedTimeBadges[ms] || 0) > 0);
      });

      const aggregate = {
        totalParticipants: participants.length,
        totalValue: participants.reduce((sum, p) => sum + p.totalValue, 0),
        avgValue: participants.length > 0
          ? participants.reduce((sum, p) => sum + p.totalValue, 0) / participants.length
          : 0,
        totalMissedDays: participants.reduce((sum, p) => sum + p.missedDays, 0),
        colVisible,
        timeMsVisible,
        badges: {
          streak3:    participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[3]  || 0), 0),
          streak7:    participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[7]  || 0), 0),
          streak14:   participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[14] || 0), 0),
          streak21:   participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[21] || 0), 0),
          streak28:   participants.reduce((sum, p) => sum + (p.badges.completedStreakBadges[28] || 0), 0),
          double:     participants.reduce((sum, p) => sum + p.badges.doubleBadgeCount, 0),
          triple:     participants.reduce((sum, p) => sum + p.badges.tripleBadgeCount, 0),
          quadruple:  participants.reduce((sum, p) => sum + p.badges.quadrupleBadgeCount, 0),
        },
      };

      timeMilestones.forEach(ms => {
        aggregate.badges[`time${ms}`] = participants.reduce((sum, p) => sum + (p.badges.completedTimeBadges[ms] || 0), 0);
      });

      setAggregateData(aggregate);

      if (challenge.isTeamChallenge) {
        const teamMap = {};
        participants.forEach(p => {
          if (p.teamId) {
            if (!teamMap[p.teamId]) {
              teamMap[p.teamId] = { teamId: p.teamId, teamName: p.teamName, members: [], totalValue: 0, memberCount: 0 };
            }
            teamMap[p.teamId].members.push(p);
            teamMap[p.teamId].totalValue += p.totalValue;
            teamMap[p.teamId].memberCount += 1;
          }
        });

        const teams = Object.values(teamMap).map(t => ({ ...t, avgValue: t.memberCount > 0 ? t.totalValue / t.memberCount : 0 }));
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
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const formatTimeShort = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      if (minutes > 0) return `${hours}h ${minutes}m`;
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const formatValue = (value, type) => {
    if (type === "plank") return formatTime(value);
    return Math.round(value).toString();
  };

  if (loading && completedChallenges.length === 0) {
    return <div style={{ padding: "20px", textAlign: "center" }}><p>Loading completed challenges...</p></div>;
  }

  if (completedChallenges.length === 0) {
    return <div style={{ padding: "20px", textAlign: "center" }}><p style={{ color: "#999" }}>No completed challenges yet.</p></div>;
  }

  // Active challenge milestones for render: 15-min steps up to 5 hours
  const timeMilestones = [];
  for (let i = 900; i <= 18000; i += 900) timeMilestones.push(i);

  const cv = aggregateData?.colVisible || {};
  const tmv = aggregateData?.timeMsVisible || {};

  const thStyle = { padding: "8px", textAlign: "left", border: "1px solid #ddd", whiteSpace: "nowrap" };
  const thRight = { ...thStyle, textAlign: "right" };
  const tdStyle = { padding: "8px", border: "1px solid #ddd" };
  const tdRight = { ...tdStyle, textAlign: "right" };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Completed Challenges</h2>

      <div style={{ marginBottom: "30px" }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: "10px" }}>Select Challenge:</label>
        <select
          value={selectedChallengeId}
          onChange={(e) => setSelectedChallengeId(e.target.value)}
          style={{ width: "100%", maxWidth: "500px", padding: "10px", fontSize: "16px", borderRadius: "5px", border: "1px solid #ddd" }}
        >
          <option value="">-- Select a challenge --</option>
          {completedChallenges.map(challenge => (
            <option key={challenge.id} value={challenge.id}>
              {challenge.name} ({challenge.type}) - Ended {new Date(challenge.startDate.toDate().getTime() + challenge.numberOfDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {selectedChallengeId && challengeDetails && (
        <div>
          {loading ? (
            <p>Loading challenge data...</p>
          ) : (
            <>
              {/* Challenge Info */}
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                <h3>{challengeDetails.name}</h3>
                <p><strong>Type:</strong> {challengeDetails.type === "plank" ? "Plank (time)" : "Squat (reps)"}</p>
                <p><strong>Duration:</strong> {challengeDetails.numberOfDays} days</p>
                <p><strong>Started:</strong> {challengeDetails.startDate.toDate().toLocaleDateString()}</p>
                <p><strong>Team Challenge:</strong> {challengeDetails.isTeamChallenge ? "Yes" : "No"}</p>
              </div>

              {/* Team Summary */}
              {challengeDetails.isTeamChallenge && teamData.length > 0 && (
                <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                  <h3>Team Summary</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f0f0f0" }}>
                          <th style={thStyle}>Rank</th>
                          <th style={thStyle}>Team</th>
                          <th style={thStyle}>Members</th>
                          <th style={thRight}>Total {challengeDetails.type === "plank" ? "Time" : "Reps"}</th>
                          <th style={thRight}>Avg per Member</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.map((team, index) => (
                          <tr key={team.teamId}>
                            <td style={tdStyle}>{index + 1}</td>
                            <td style={tdStyle}>{team.teamName}</td>
                            <td style={tdStyle}>{team.memberCount}</td>
                            <td style={tdRight}>{formatValue(team.totalValue, challengeDetails.type)}</td>
                            <td style={tdRight}>{formatValue(team.avgValue, challengeDetails.type)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Participant Results */}
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                <h3>Participant Results</h3>
                <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px" }}>Select and copy the table below to paste into Excel or Google Sheets</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f0f0f0" }}>
                        <th style={thStyle}>Rank</th>
                        <th style={thStyle}>Name</th>
                        {challengeDetails.isTeamChallenge && <th style={thStyle}>Team</th>}
                        <th style={thRight}>Total {challengeDetails.type === "plank" ? "Time" : "Reps"}</th>
                        <th style={thRight}>Avg per Day</th>
                        <th style={thRight}>Best</th>
                        <th style={thRight}>Days Done</th>
                        <th style={thRight}>Days Missed</th>
                        <th style={thRight}>Success %</th>
                        <th style={thStyle}>Highest Streak</th>
                        {cv.streak3    && <th style={thStyle}>3-Day</th>}
                        {cv.streak7    && <th style={thStyle}>7-Day</th>}
                        {cv.streak14   && <th style={thStyle}>14-Day</th>}
                        {cv.streak21   && <th style={thStyle}>21-Day</th>}
                        {cv.streak28   && <th style={thStyle}>28-Day</th>}
                        {cv.double     && <th style={thStyle}>2x</th>}
                        {cv.triple     && <th style={thStyle}>3x</th>}
                        {cv.quadruple  && <th style={thStyle}>4x</th>}
                        {cv.newLegacyStreak && <th style={{ ...thStyle, backgroundColor: "#fef3c7" }}>New Legacy Streak Badge</th>}
                        {cv.newLegacyTime   && <th style={{ ...thStyle, backgroundColor: "#d1fae5" }}>New Legacy Time Badge</th>}
                        {cv.highestTimeBadge && <th style={thStyle}>Time Milestone</th>}
                        {challengeDetails.type === "plank" && timeMilestones.filter(ms => tmv[ms]).map(ms => (
                          <th key={ms} style={thStyle}>{formatTimeShort(ms)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {participantData.map((participant, index) => (
                        <tr key={participant.userId}>
                          <td style={tdStyle}>{index + 1}</td>
                          <td style={tdStyle}>{participant.displayName}</td>
                          {challengeDetails.isTeamChallenge && <td style={tdStyle}>{participant.teamName}</td>}
                          <td style={tdRight}>{formatValue(participant.totalValue, challengeDetails.type)}</td>
                          <td style={tdRight}>{formatValue(participant.avgValue, challengeDetails.type)}</td>
                          <td style={tdRight}>{formatValue(participant.bestValue, challengeDetails.type)}</td>
                          <td style={tdRight}>{participant.daysCompleted}</td>
                          <td style={tdRight}>{participant.missedDays}</td>
                          <td style={tdRight}>{participant.successRate.toFixed(1)}%</td>
                          <td style={tdStyle}>{participant.badges.highestStreakBadge > 0 ? `${participant.badges.highestStreakBadge}d` : "-"}</td>
                          {cv.streak3    && <td style={tdStyle}>{participant.badges.completedStreakBadges[3]  || 0}</td>}
                          {cv.streak7    && <td style={tdStyle}>{participant.badges.completedStreakBadges[7]  || 0}</td>}
                          {cv.streak14   && <td style={tdStyle}>{participant.badges.completedStreakBadges[14] || 0}</td>}
                          {cv.streak21   && <td style={tdStyle}>{participant.badges.completedStreakBadges[21] || 0}</td>}
                          {cv.streak28   && <td style={tdStyle}>{participant.badges.completedStreakBadges[28] || 0}</td>}
                          {cv.double     && <td style={tdStyle}>{participant.badges.doubleBadgeCount}</td>}
                          {cv.triple     && <td style={tdStyle}>{participant.badges.tripleBadgeCount}</td>}
                          {cv.quadruple  && <td style={tdStyle}>{participant.badges.quadrupleBadgeCount}</td>}
                          {cv.newLegacyStreak && <td style={{ ...tdStyle, backgroundColor: "#fef9c3" }}>{participant.newLegacyStreakBadge !== null ? `${participant.newLegacyStreakBadge}-day Run` : "-"}</td>}
                          {cv.newLegacyTime   && <td style={{ ...tdStyle, backgroundColor: "#ecfdf5" }}>{participant.newLegacyTimeBadge !== null ? formatTimeShort(participant.newLegacyTimeBadge) : "-"}</td>}
                          {cv.highestTimeBadge && <td style={tdStyle}>{participant.badges.highestTimeBadge > 0 ? formatTimeShort(participant.badges.highestTimeBadge) : "-"}</td>}
                          {challengeDetails.type === "plank" && timeMilestones.filter(ms => tmv[ms]).map(ms => (
                            <td key={ms} style={tdStyle}>{participant.badges.completedTimeBadges[ms] || 0}</td>
                          ))}
                        </tr>
                      ))}

                      {/* Aggregate / Totals Row */}
                      {aggregateData && (
                        <tr style={{ backgroundColor: "#e8f5e9", fontWeight: "bold" }}>
                          <td style={tdStyle} colSpan="2">TOTALS ({aggregateData.totalParticipants} participants)</td>
                          {challengeDetails.isTeamChallenge && <td style={tdStyle}>-</td>}
                          <td style={tdRight}>{formatValue(aggregateData.totalValue, challengeDetails.type)}</td>
                          <td style={tdRight}>{formatValue(aggregateData.avgValue, challengeDetails.type)}</td>
                          <td style={tdStyle}>-</td>
                          <td style={tdStyle}>-</td>
                          <td style={tdRight}>{aggregateData.totalMissedDays}</td>
                          <td style={tdStyle}>-</td>
                          <td style={tdStyle}>-</td>
                          {cv.streak3    && <td style={tdStyle}>{aggregateData.badges.streak3}</td>}
                          {cv.streak7    && <td style={tdStyle}>{aggregateData.badges.streak7}</td>}
                          {cv.streak14   && <td style={tdStyle}>{aggregateData.badges.streak14}</td>}
                          {cv.streak21   && <td style={tdStyle}>{aggregateData.badges.streak21}</td>}
                          {cv.streak28   && <td style={tdStyle}>{aggregateData.badges.streak28}</td>}
                          {cv.double     && <td style={tdStyle}>{aggregateData.badges.double}</td>}
                          {cv.triple     && <td style={tdStyle}>{aggregateData.badges.triple}</td>}
                          {cv.quadruple  && <td style={tdStyle}>{aggregateData.badges.quadruple}</td>}
                          {cv.newLegacyStreak && <td style={{ ...tdStyle, backgroundColor: "#fef9c3" }}>-</td>}
                          {cv.newLegacyTime   && <td style={{ ...tdStyle, backgroundColor: "#ecfdf5" }}>-</td>}
                          {cv.highestTimeBadge && <td style={tdStyle}>-</td>}
                          {challengeDetails.type === "plank" && timeMilestones.filter(ms => tmv[ms]).map(ms => (
                            <td key={ms} style={tdStyle}>{aggregateData.badges[`time${ms}`] || 0}</td>
                          ))}
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
