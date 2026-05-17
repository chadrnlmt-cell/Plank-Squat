// src/badgeHelpers.js
import { db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Get or initialize badge data for a specific challenge
 */
function getChallengeBadgeData(userStatsData, challengeId) {
  if (!userStatsData.badges) {
    return {
      currentStreak: 0,
      currentStreakBadgeLevel: 0,
      completedStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
      doubleBadgeCount: 0,
      tripleBadgeCount: 0,
      quadrupleBadgeCount: 0,
      totalPlankSeconds: 0,
      currentTimeBadgeLevel: 0,
      completedTimeBadges: {},
    };
  }

  if (!userStatsData.badges.challenges) {
    return {
      currentStreak: 0,
      currentStreakBadgeLevel: 0,
      completedStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
      doubleBadgeCount: 0,
      tripleBadgeCount: 0,
      quadrupleBadgeCount: 0,
      totalPlankSeconds: 0,
      currentTimeBadgeLevel: 0,
      completedTimeBadges: {},
    };
  }

  const existing = userStatsData.badges.challenges[challengeId] || {};
  return {
    currentStreak: existing.currentStreak || 0,
    currentStreakBadgeLevel: existing.currentStreakBadgeLevel || 0,
    completedStreakBadges: existing.completedStreakBadges || { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
    doubleBadgeCount: existing.doubleBadgeCount || 0,
    tripleBadgeCount: existing.tripleBadgeCount || 0,
    quadrupleBadgeCount: existing.quadrupleBadgeCount || 0,
    totalPlankSeconds: existing.totalPlankSeconds || 0,
    currentTimeBadgeLevel: existing.currentTimeBadgeLevel || 0,
    completedTimeBadges: existing.completedTimeBadges || {},
  };
}

/**
 * Get or initialize the legacy badge data from userStats.
 */
function getLegacyBadgeData(userStatsData) {
  const legacy = userStatsData?.badges?.legacy || {};

  const rawRun = legacy.earnedConsecutiveRunBadges || [];
  const earnedConsecutiveRunBadges = rawRun.map((item) =>
    typeof item === "object" ? item : { value: item, challengeId: null }
  );

  const rawTime = legacy.earnedTimeBadges || [];
  const earnedTimeBadges = rawTime.map((item) =>
    typeof item === "object" ? item : { value: item, challengeId: null }
  );

  return {
    consecutiveRun: legacy.consecutiveRun || 0,
    consecutiveRunBadgeLevel: legacy.consecutiveRunBadgeLevel || 0,
    earnedConsecutiveRunBadges,
    earnedTimeBadges,
  };
}

function legacyRunValues(earnedConsecutiveRunBadges) {
  return earnedConsecutiveRunBadges.map((item) =>
    typeof item === "object" ? item.value : item
  );
}

function legacyTimeValues(earnedTimeBadges) {
  return earnedTimeBadges.map((item) =>
    typeof item === "object" ? item.value : item
  );
}

/**
 * Check if today's completion continues a streak
 */
async function calculateStreakContinuation(
  userId,
  challengeId,
  currentDay,
  currentStreakCount
) {
  if (currentDay === 1) {
    return { continues: true, newStreak: 1 };
  }

  const attemptsRef = collection(db, "attempts");
  const prevDayQuery = query(
    attemptsRef,
    where("userId", "==", userId),
    where("challengeId", "==", challengeId),
    where("day", "==", currentDay - 1),
    where("success", "==", true)
  );

  const prevDaySnap = await getDocs(prevDayQuery);

  if (!prevDaySnap.empty) {
    return { continues: true, newStreak: currentStreakCount + 1 };
  } else {
    return { continues: false, newStreak: 1 };
  }
}

/**
 * Calculate streak badge updates
 */
function calculateStreakBadges(currentStreak, currentBadgeLevel, existingCompletedBadges) {
  const milestones = [3, 7, 14, 21, 28];
  let newBadgeLevel = currentBadgeLevel;
  const completedBadges = { ...existingCompletedBadges };
  let newlyEarnedBadge = null;

  for (const milestone of milestones) {
    if (currentStreak >= milestone && milestone > currentBadgeLevel) {
      newBadgeLevel = milestone;
      newlyEarnedBadge = milestone;
    }
  }

  return { newBadgeLevel, completedBadges, newlyEarnedBadge };
}

/**
 * When a streak breaks, save the highest badge from that streak
 */
function finalizeStreakBadge(currentBadgeLevel, completedBadges) {
  if (currentBadgeLevel > 0) {
    const updated = { ...completedBadges };
    updated[currentBadgeLevel] = (updated[currentBadgeLevel] || 0) + 1;
    return updated;
  }
  return completedBadges;
}

/**
 * Calculate multiplier badge counts
 */
function calculateMultiplierBadges(actualValue, targetValue, currentCounts) {
  const multiplier = actualValue / targetValue;
  const newCounts = { ...currentCounts };

  if (multiplier >= 4) {
    newCounts.quadrupleBadgeCount = (newCounts.quadrupleBadgeCount || 0) + 1;
  } else if (multiplier >= 3) {
    newCounts.tripleBadgeCount = (newCounts.tripleBadgeCount || 0) + 1;
  } else if (multiplier >= 2) {
    newCounts.doubleBadgeCount = (newCounts.doubleBadgeCount || 0) + 1;
  }

  return newCounts;
}

/**
 * Calculate time badges for active challenge (plank only)
 * Milestones: every 15 minutes (900s) up to 5 hours (18000s)
 */
function calculateTimeBadges(totalSeconds, currentBadgeLevel, existingCompletedBadges) {
  const milestones = [];
  for (let i = 900; i <= 18000; i += 900) {
    milestones.push(i);
  }

  let newBadgeLevel = currentBadgeLevel;
  const completedBadges = { ...existingCompletedBadges };
  let newlyEarnedBadge = null;

  for (const milestone of milestones) {
    if (totalSeconds >= milestone && milestone > currentBadgeLevel) {
      if (currentBadgeLevel > 0) {
        completedBadges[currentBadgeLevel] = (completedBadges[currentBadgeLevel] || 0) + 1;
      }
      newBadgeLevel = milestone;
      newlyEarnedBadge = milestone;
    }
  }

  return { newBadgeLevel, completedBadges, newlyEarnedBadge };
}

// ---------------------------------------------------------------------------
// LEGACY / LIFETIME ACHIEVEMENTS HELPERS
// ---------------------------------------------------------------------------

const LEGACY_RUN_MILESTONES = (() => {
  const m = [];
  for (let i = 30; i <= 365; i += 30) m.push(i);
  if (!m.includes(365)) m.push(365);
  return m;
})();

// Lifetime milestones unchanged: 30-min steps up to 10 hours
const LEGACY_TIME_MILESTONES = (() => {
  const m = [];
  for (let i = 1800; i <= 36000; i += 1800) m.push(i);
  return m;
})();

async function allActiveChallengesCompletedToday(userId, currentChallengeId) {
  try {
    const ucQuery = query(
      collection(db, "userChallenges"),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    const ucSnap = await getDocs(ucQuery);

    if (ucSnap.empty) return true;

    const activeChallengeIds = ucSnap.docs.map((d) => d.data().challengeId);

    if (activeChallengeIds.length === 1) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    for (const cId of activeChallengeIds) {
      const attQ = query(
        collection(db, "attempts"),
        where("userId", "==", userId),
        where("challengeId", "==", cId),
        where("success", "==", true)
      );
      const attSnap = await getDocs(attQ);

      const todaySuccess = attSnap.docs.some((d) => {
        const ts = d.data().timestamp;
        if (!ts) return false;
        const ms = ts.toMillis ? ts.toMillis() : ts * 1000;
        return ms >= todayTs;
      });

      if (!todaySuccess) return false;
    }

    return true;
  } catch (err) {
    console.error("allActiveChallengesCompletedToday error:", err);
    return false;
  }
}

async function updateLegacyBadges(userId, movementType, userStatsData) {
  const legacy = getLegacyBadgeData(userStatsData);
  const newlyEarnedLegacyBadges = [];

  const allDone = await allActiveChallengesCompletedToday(userId, null);

  let newRun = legacy.consecutiveRun;
  let newRunBadgeLevel = legacy.consecutiveRunBadgeLevel;
  let earnedRunBadges = [...legacy.earnedConsecutiveRunBadges];

  if (allDone) {
    const lastSuccess = userStatsData.lastSuccessDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    let alreadyCountedToday = false;
    if (lastSuccess) {
      const lastMs = lastSuccess.toMillis ? lastSuccess.toMillis() : lastSuccess * 1000;
      const lastDay = new Date(lastMs);
      lastDay.setHours(0, 0, 0, 0);
      alreadyCountedToday = lastDay.getTime() === todayMs;
    }

    if (!alreadyCountedToday) {
      newRun = legacy.consecutiveRun + 1;

      const runVals = legacyRunValues(earnedRunBadges);
      if (newRun === 365 && !runVals.includes(365)) {
        earnedRunBadges = [...earnedRunBadges, { value: 365, challengeId: null }];
        newRunBadgeLevel = 365;
        newlyEarnedLegacyBadges.push({ type: "legacyRun", value: 365 });
      }

      for (const milestone of LEGACY_RUN_MILESTONES) {
        if (newRun >= milestone && milestone > newRunBadgeLevel && milestone !== 365) {
          newRunBadgeLevel = milestone;
        }
      }
    }
  }

  let earnedTimeBadges = [...legacy.earnedTimeBadges];

  if (movementType === "plank") {
    const totalSeconds = userStatsData.totalPlankSeconds || 0;
    const timeVals = legacyTimeValues(earnedTimeBadges);

    for (const milestone of LEGACY_TIME_MILESTONES) {
      if (totalSeconds >= milestone && !timeVals.includes(milestone)) {
        earnedTimeBadges = [...earnedTimeBadges, { value: milestone, challengeId: null }];
        newlyEarnedLegacyBadges.push({ type: "legacyTime", value: milestone });
      }
    }
  }

  const updatedLegacy = {
    consecutiveRun: newRun,
    consecutiveRunBadgeLevel: newRunBadgeLevel,
    earnedConsecutiveRunBadges: earnedRunBadges,
    earnedTimeBadges,
  };

  return { updatedLegacy, newlyEarnedLegacyBadges };
}

export async function breakConsecutiveRun(userId, challengeId = null) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const snap = await getDoc(userStatsRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const legacy = getLegacyBadgeData(data);

    const runVals = legacyRunValues(legacy.earnedConsecutiveRunBadges);
    let earnedRunBadges = [...legacy.earnedConsecutiveRunBadges];
    if (
      legacy.consecutiveRunBadgeLevel > 0 &&
      !runVals.includes(legacy.consecutiveRunBadgeLevel)
    ) {
      earnedRunBadges = [
        ...earnedRunBadges,
        { value: legacy.consecutiveRunBadgeLevel, challengeId: challengeId || null },
      ];
    }

    await updateDoc(userStatsRef, {
      "badges.legacy.consecutiveRun": 0,
      "badges.legacy.consecutiveRunBadgeLevel": 0,
      "badges.legacy.earnedConsecutiveRunBadges": earnedRunBadges,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("breakConsecutiveRun error:", err);
  }
}

// ---------------------------------------------------------------------------
// TEAM BADGE HELPERS
// ---------------------------------------------------------------------------

/**
 * Award team badges at challenge end.
 *
 * Three team badges:
 *  1. "topTeam"      — members of the highest-average-time/reps team
 *  2. "teamMVP"      — the single top individual performer on a team challenge
 *  3. "perfectTeamWeek" — any member whose entire team completed every day of
 *                         at least one 7-day window without a miss
 *
 * Badge is stored on userStats as:
 *   badges.team.<challengeId>.topTeam: true
 *   badges.team.<challengeId>.teamMVP: true
 *   badges.team.<challengeId>.perfectTeamWeek: true
 */
export async function awardTeamBadgesOnChallengeEnd(challengeId, challengeType) {
  try {
    // 1. Load all challengeUserStats for this challenge
    const statsQuery = query(
      collection(db, "challengeUserStats"),
      where("challengeId", "==", challengeId)
    );
    const statsSnap = await getDocs(statsQuery);
    if (statsSnap.empty) return;

    const entries = statsSnap.docs.map((d) => ({
      userId: d.data().userId,
      teamId: d.data().teamId || null,
      totalSeconds: d.data().totalSeconds || 0,
      totalReps: d.data().totalReps || 0,
      bestSeconds: d.data().bestSeconds || 0,
      bestReps: d.data().bestReps || 0,
    })).filter((e) => e.userId);

    const isPlank = challengeType === "plank";
    const getValue = (e) => (isPlank ? e.totalSeconds : e.totalReps);

    // ── 1. Top Team badge: members of the team with the highest average ──
    const teamEntries = entries.filter((e) => e.teamId);
    const teamTotals = {};
    teamEntries.forEach((e) => {
      if (!teamTotals[e.teamId]) teamTotals[e.teamId] = { sum: 0, count: 0, members: [] };
      teamTotals[e.teamId].sum += getValue(e);
      teamTotals[e.teamId].count += 1;
      teamTotals[e.teamId].members.push(e.userId);
    });

    let topTeamId = null;
    let topTeamAvg = -1;
    Object.entries(teamTotals).forEach(([tid, data]) => {
      const avg = data.count > 0 ? data.sum / data.count : 0;
      if (avg > topTeamAvg) {
        topTeamAvg = avg;
        topTeamId = tid;
      }
    });
    const topTeamMembers = topTeamId ? (teamTotals[topTeamId]?.members || []) : [];

    // ── 2. Team MVP badge: single highest individual performer on a team ──
    const teamOnlyEntries = entries.filter((e) => e.teamId);
    let mvpUserId = null;
    let mvpBest = -1;
    teamOnlyEntries.forEach((e) => {
      const v = getValue(e);
      if (v > mvpBest) {
        mvpBest = v;
        mvpUserId = e.userId;
      }
    });

    // ── 3. Perfect Team Week badge: any 7-day window where ALL team members
    //        logged a success on every day in that window ──
    // Load all success attempts for this challenge
    const attQuery = query(
      collection(db, "attempts"),
      where("challengeId", "==", challengeId),
      where("success", "==", true)
    );
    const attSnap = await getDocs(attQuery);

    // Build a map: teamId → { userId → Set<day> }
    const teamDayMap = {}; // teamId → userId → Set<day>
    const userTeamMap = {}; // userId → teamId (from entries)
    teamOnlyEntries.forEach((e) => { userTeamMap[e.userId] = e.teamId; });

    attSnap.forEach((d) => {
      const uid = d.data().userId;
      const day = d.data().day;
      const tid = userTeamMap[uid];
      if (!tid || !uid || !day) return;
      if (!teamDayMap[tid]) teamDayMap[tid] = {};
      if (!teamDayMap[tid][uid]) teamDayMap[tid][uid] = new Set();
      teamDayMap[tid][uid].add(day);
    });

    // For each team, find its members and check any 7-day consecutive window
    const perfectTeamWeekUserIds = new Set();
    Object.entries(teamDayMap).forEach(([tid, userDays]) => {
      const members = Object.keys(userDays);
      if (members.length < 2) return; // Need at least 2 members for a team badge

      // Find all days any member has completed
      const allDays = new Set();
      members.forEach((uid) => userDays[uid].forEach((d) => allDays.add(d)));
      const sortedDays = [...allDays].sort((a, b) => a - b);

      // Check each 7-day window starting from sortedDays values
      for (let i = 0; i < sortedDays.length; i++) {
        const startDay = sortedDays[i];
        const windowDays = [startDay, startDay+1, startDay+2, startDay+3, startDay+4, startDay+5, startDay+6];
        // Every member must have completed every day in this window
        const allComplete = members.every((uid) =>
          windowDays.every((day) => userDays[uid].has(day))
        );
        if (allComplete) {
          members.forEach((uid) => perfectTeamWeekUserIds.add(uid));
          break; // One qualifying window is enough for this team
        }
      }
    });

    // ── Write badges to each userStats doc ──
    for (const entry of entries) {
      if (!entry.teamId) continue; // skip non-team participants

      const badgeUpdates = {};
      if (topTeamMembers.includes(entry.userId)) {
        badgeUpdates[`badges.team.${challengeId}.topTeam`] = true;
      }
      if (entry.userId === mvpUserId) {
        badgeUpdates[`badges.team.${challengeId}.teamMVP`] = true;
      }
      if (perfectTeamWeekUserIds.has(entry.userId)) {
        badgeUpdates[`badges.team.${challengeId}.perfectTeamWeek`] = true;
      }

      if (Object.keys(badgeUpdates).length === 0) continue;

      try {
        const userStatsRef = doc(db, "userStats", entry.userId);
        const snap = await getDoc(userStatsRef);
        if (!snap.exists()) continue;
        await updateDoc(userStatsRef, {
          ...badgeUpdates,
          updatedAt: serverTimestamp(),
        });
      } catch (userErr) {
        console.error(`awardTeamBadgesOnChallengeEnd error for user ${entry.userId}:`, userErr);
      }
    }

    console.log(`awardTeamBadgesOnChallengeEnd complete for challenge ${challengeId}`);
  } catch (err) {
    console.error("awardTeamBadgesOnChallengeEnd error:", err);
  }
}

// ---------------------------------------------------------------------------
// CHALLENGE-END FINALIZATION
// ---------------------------------------------------------------------------

export async function finalizeAllStreaksOnChallengeEnd(challengeId, challengeType) {
  try {
    const ucQuery = query(
      collection(db, "userChallenges"),
      where("challengeId", "==", challengeId)
    );
    const ucSnap = await getDocs(ucQuery);

    // Detect if this is a team challenge by checking if any participant has a teamId
    let isTeamChallenge = false;

    for (const ucDoc of ucSnap.docs) {
      const ucData = ucDoc.data();
      if (ucData.teamId) { isTeamChallenge = true; }
      const userId = ucData.userId;
      if (!userId) continue;

      try {
        const userStatsRef = doc(db, "userStats", userId);
        const statsSnap = await getDoc(userStatsRef);
        if (!statsSnap.exists()) continue;

        const statsData = statsSnap.data();
        const challengeBadges = getChallengeBadgeData(statsData, challengeId);
        const legacy = getLegacyBadgeData(statsData);

        // ── Legacy attribution: always run regardless of badge levels ──
        let legacyRunBadges = legacy.earnedConsecutiveRunBadges.map((item) =>
          item.challengeId === null ? { ...item, challengeId } : item
        );
        let legacyTimeBadges = legacy.earnedTimeBadges.map((item) =>
          item.challengeId === null ? { ...item, challengeId } : item
        );

        const updates = {};

        // ── Streak badge finalization ──
        if (challengeBadges.currentStreakBadgeLevel > 0) {
          const level = challengeBadges.currentStreakBadgeLevel;
          const updated = { ...challengeBadges.completedStreakBadges };
          updated[level] = (updated[level] || 0) + 1;
          updates[`badges.challenges.${challengeId}.completedStreakBadges`] = updated;
          updates[`badges.challenges.${challengeId}.currentStreakBadgeLevel`] = 0;
        }

        // ── Time badge finalization ──
        if (challengeBadges.currentTimeBadgeLevel > 0) {
          const level = challengeBadges.currentTimeBadgeLevel;
          const updatedTime = { ...challengeBadges.completedTimeBadges };
          updatedTime[level] = (updatedTime[level] || 0) + 1;
          updates[`badges.challenges.${challengeId}.completedTimeBadges`] = updatedTime;
          updates[`badges.challenges.${challengeId}.currentTimeBadgeLevel`] = 0;
        }

        updates["badges.legacy.earnedConsecutiveRunBadges"] = legacyRunBadges;
        updates["badges.legacy.earnedTimeBadges"] = legacyTimeBadges;
        updates["updatedAt"] = serverTimestamp();

        await updateDoc(userStatsRef, updates);

        const legacyRunAtEnd = legacy.consecutiveRun || 0;
        const legacyTimeBadgeCountAtEnd = legacy.earnedTimeBadges.length || 0;

        await updateDoc(doc(db, "userChallenges", ucDoc.id), {
          legacyRunAtEnd,
          legacyTimeBadgeCountAtEnd,
        });

      } catch (userErr) {
        console.error(`finalizeAllStreaksOnChallengeEnd error for user ${userId}:`, userErr);
      }
    }

    // ── Award team badges if this is a team challenge ──
    if (isTeamChallenge && challengeType) {
      await awardTeamBadgesOnChallengeEnd(challengeId, challengeType);
    }

    console.log(`finalizeAllStreaksOnChallengeEnd complete for challenge ${challengeId}`);
  } catch (err) {
    console.error("finalizeAllStreaksOnChallengeEnd error:", err);
  }
}

export async function clearChallengeBadgesOnReset(challengeId) {
  try {
    const ucQuery = query(
      collection(db, "userChallenges"),
      where("challengeId", "==", challengeId)
    );
    const ucSnap = await getDocs(ucQuery);

    for (const ucDoc of ucSnap.docs) {
      const ucData = ucDoc.data();
      const userId = ucData.userId;
      if (!userId) continue;

      try {
        const userStatsRef = doc(db, "userStats", userId);
        const statsSnap = await getDoc(userStatsRef);
        if (!statsSnap.exists()) continue;

        const statsData = statsSnap.data();
        const legacy = getLegacyBadgeData(statsData);

        const filteredRunBadges = legacy.earnedConsecutiveRunBadges.filter(
          (item) => item.challengeId !== challengeId
        );
        const filteredTimeBadges = legacy.earnedTimeBadges.filter(
          (item) => item.challengeId !== challengeId
        );

        const remainingRunVals = legacyRunValues(filteredRunBadges);
        const newRunBadgeLevel =
          remainingRunVals.length > 0 ? Math.max(...remainingRunVals) : 0;

        await updateDoc(userStatsRef, {
          [`badges.challenges.${challengeId}`]: {
            currentStreak: 0,
            currentStreakBadgeLevel: 0,
            completedStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
            doubleBadgeCount: 0,
            tripleBadgeCount: 0,
            quadrupleBadgeCount: 0,
            totalPlankSeconds: 0,
            currentTimeBadgeLevel: 0,
            completedTimeBadges: {},
          },
          // Also clear any team badges for this challenge
          [`badges.team.${challengeId}`]: null,
          "badges.legacy.earnedConsecutiveRunBadges": filteredRunBadges,
          "badges.legacy.earnedTimeBadges": filteredTimeBadges,
          "badges.legacy.consecutiveRunBadgeLevel": newRunBadgeLevel,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "userChallenges", ucDoc.id), {
          legacyRunAtEnd: null,
          legacyTimeBadgeCountAtEnd: null,
          legacyRunAtJoin: null,
          legacyTimeBadgeCountAtJoin: null,
        });

      } catch (userErr) {
        console.error(`clearChallengeBadgesOnReset error for user ${userId}:`, userErr);
      }
    }

    console.log(`clearChallengeBadgesOnReset complete for challenge ${challengeId}`);
  } catch (err) {
    console.error("clearChallengeBadgesOnReset error:", err);
  }
}

// ---------------------------------------------------------------------------
// MAIN EXPORT
// ---------------------------------------------------------------------------

export async function updateBadgesOnCompletion({
  userId,
  challengeId,
  currentDay,
  actualValue,
  targetValue,
  movementType,
}) {
  try {
    const attemptsRef = collection(db, "attempts");
    const existingSuccessQuery = query(
      attemptsRef,
      where("userId", "==", userId),
      where("challengeId", "==", challengeId),
      where("day", "==", currentDay),
      where("success", "==", true)
    );
    const existingSuccessSnap = await getDocs(existingSuccessQuery);
    if (existingSuccessSnap.size > 1) {
      console.warn(
        `updateBadgesOnCompletion: duplicate success attempt detected for day ${currentDay} — skipping badge update.`
      );
      return { newBadges: [] };
    }

    const userStatsRef = doc(db, "userStats", userId);
    const userStatsSnap = await getDoc(userStatsRef);

    if (!userStatsSnap.exists()) {
      console.warn("userStats doc does not exist for badge update");
      return { newBadges: [] };
    }

    const userStatsData = userStatsSnap.data();
    const currentBadgeData = getChallengeBadgeData(userStatsData, challengeId);

    const { continues, newStreak } = await calculateStreakContinuation(
      userId,
      challengeId,
      currentDay,
      currentBadgeData.currentStreak || 0
    );

    let updatedCompletedBadges = currentBadgeData.completedStreakBadges;
    let currentBadgeLevel = currentBadgeData.currentStreakBadgeLevel;

    if (!continues && currentBadgeData.currentStreak > 0) {
      updatedCompletedBadges = finalizeStreakBadge(
        currentBadgeData.currentStreakBadgeLevel,
        currentBadgeData.completedStreakBadges
      );
      currentBadgeLevel = 0;
    }

    const { newBadgeLevel, completedBadges, newlyEarnedBadge } = calculateStreakBadges(
      newStreak,
      currentBadgeLevel,
      updatedCompletedBadges
    );

    const oldMultipliers = {
      doubleBadgeCount: currentBadgeData.doubleBadgeCount || 0,
      tripleBadgeCount: currentBadgeData.tripleBadgeCount || 0,
      quadrupleBadgeCount: currentBadgeData.quadrupleBadgeCount || 0,
    };
    const newMultipliers = calculateMultiplierBadges(actualValue, targetValue, oldMultipliers);

    let newTotalPlankSeconds = currentBadgeData.totalPlankSeconds || 0;
    let newTimeBadgeLevel = currentBadgeData.currentTimeBadgeLevel || 0;
    let newCompletedTimeBadges = currentBadgeData.completedTimeBadges || {};
    let newlyEarnedTimeBadge = null;

    if (movementType === "plank") {
      newTotalPlankSeconds += actualValue;
      const timeBadgeResult = calculateTimeBadges(
        newTotalPlankSeconds,
        currentBadgeData.currentTimeBadgeLevel || 0,
        currentBadgeData.completedTimeBadges || {}
      );
      newTimeBadgeLevel = timeBadgeResult.newBadgeLevel;
      newCompletedTimeBadges = timeBadgeResult.completedBadges;
      newlyEarnedTimeBadge = timeBadgeResult.newlyEarnedBadge;
    }

    const { updatedLegacy, newlyEarnedLegacyBadges } = await updateLegacyBadges(
      userId,
      movementType,
      userStatsData
    );

    const newBadges = [];

    if (newlyEarnedBadge) {
      newBadges.push({ type: "streak", value: newlyEarnedBadge });
    }
    if (newMultipliers.doubleBadgeCount > oldMultipliers.doubleBadgeCount) {
      newBadges.push({ type: "multiplier", level: "double", count: newMultipliers.doubleBadgeCount });
    }
    if (newMultipliers.tripleBadgeCount > oldMultipliers.tripleBadgeCount) {
      newBadges.push({ type: "multiplier", level: "triple", count: newMultipliers.tripleBadgeCount });
    }
    if (newMultipliers.quadrupleBadgeCount > oldMultipliers.quadrupleBadgeCount) {
      newBadges.push({ type: "multiplier", level: "quadruple", count: newMultipliers.quadrupleBadgeCount });
    }
    if (movementType === "plank" && newlyEarnedTimeBadge) {
      newBadges.push({ type: "time", value: newlyEarnedTimeBadge });
    }

    newBadges.push(...newlyEarnedLegacyBadges);

    const updatedBadgeData = {
      currentStreak: newStreak,
      currentStreakBadgeLevel: newBadgeLevel,
      completedStreakBadges: completedBadges,
      doubleBadgeCount: newMultipliers.doubleBadgeCount,
      tripleBadgeCount: newMultipliers.tripleBadgeCount,
      quadrupleBadgeCount: newMultipliers.quadrupleBadgeCount,
      totalPlankSeconds: newTotalPlankSeconds,
      currentTimeBadgeLevel: newTimeBadgeLevel,
      completedTimeBadges: newCompletedTimeBadges,
    };

    await updateDoc(userStatsRef, {
      [`badges.challenges.${challengeId}`]: updatedBadgeData,
      "badges.legacy": updatedLegacy,
      lastSuccessDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { newBadges, badgeData: updatedBadgeData, legacyData: updatedLegacy };
  } catch (error) {
    console.error("Error updating badges:", error);
    return { newBadges: [] };
  }
}

export async function getAllUserBadges(userId) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const userStatsSnap = await getDoc(userStatsRef);

    if (!userStatsSnap.exists()) {
      return {
        allStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
        allMultipliers: { double: 0, triple: 0, quadruple: 0 },
        allTimeBadges: {},
        byChallengeId: {},
        teamBadges: {},
        legacy: getLegacyBadgeData({}),
      };
    }

    const userStatsData = userStatsSnap.data();
    const challenges = userStatsData.badges?.challenges || {};
    const teamBadges = userStatsData.badges?.team || {};

    const allStreakBadges = { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 };
    let totalDouble = 0;
    let totalTriple = 0;
    let totalQuadruple = 0;
    const allTimeBadges = {};

    for (const cId in challenges) {
      const badgeData = challenges[cId];

      if (badgeData.completedStreakBadges) {
        for (const level in badgeData.completedStreakBadges) {
          allStreakBadges[level] = (allStreakBadges[level] || 0) + badgeData.completedStreakBadges[level];
        }
      }

      totalDouble += badgeData.doubleBadgeCount || 0;
      totalTriple += badgeData.tripleBadgeCount || 0;
      totalQuadruple += badgeData.quadrupleBadgeCount || 0;

      if (badgeData.completedTimeBadges) {
        for (const level in badgeData.completedTimeBadges) {
          allTimeBadges[level] = (allTimeBadges[level] || 0) + badgeData.completedTimeBadges[level];
        }
      }
    }

    return {
      allStreakBadges,
      allMultipliers: { double: totalDouble, triple: totalTriple, quadruple: totalQuadruple },
      allTimeBadges,
      byChallengeId: challenges,
      teamBadges,
      legacy: getLegacyBadgeData(userStatsData),
    };
  } catch (error) {
    console.error("Error getting all user badges:", error);
    return {
      allStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
      allMultipliers: { double: 0, triple: 0, quadruple: 0 },
      allTimeBadges: {},
      byChallengeId: {},
      teamBadges: {},
      legacy: getLegacyBadgeData({}),
    };
  }
}

export async function getChallengeBadges(userId, challengeId) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const userStatsSnap = await getDoc(userStatsRef);

    if (!userStatsSnap.exists()) {
      return null;
    }

    const userStatsData = userStatsSnap.data();
    return getChallengeBadgeData(userStatsData, challengeId);
  } catch (error) {
    console.error("Error getting challenge badges:", error);
    return null;
  }
}

export async function getLegacyBadges(userId) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const snap = await getDoc(userStatsRef);
    if (!snap.exists()) return getLegacyBadgeData({});
    return getLegacyBadgeData(snap.data());
  } catch (err) {
    console.error("getLegacyBadges error:", err);
    return getLegacyBadgeData({});
  }
}

/**
 * Get team badges for a specific user (all challenges)
 * Returns { [challengeId]: { topTeam, teamMVP, perfectTeamWeek } }
 */
export async function getTeamBadges(userId) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const snap = await getDoc(userStatsRef);
    if (!snap.exists()) return {};
    return snap.data().badges?.team || {};
  } catch (err) {
    console.error("getTeamBadges error:", err);
    return {};
  }
}
