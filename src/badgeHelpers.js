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
 * Calculate time badges (plank only)
 */
function calculateTimeBadges(totalSeconds, currentBadgeLevel, existingCompletedBadges) {
  const milestones = [];
  for (let i = 1800; i <= 36000; i += 1800) {
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
// CHALLENGE-END FINALIZATION
// ---------------------------------------------------------------------------

export async function finalizeAllStreaksOnChallengeEnd(challengeId) {
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
        const challengeBadges = getChallengeBadgeData(statsData, challengeId);
        const legacy = getLegacyBadgeData(statsData);

        const updates = {};

        if (challengeBadges.currentStreakBadgeLevel > 0) {
          const level = challengeBadges.currentStreakBadgeLevel;
          const updated = { ...challengeBadges.completedStreakBadges };
          updated[level] = (updated[level] || 0) + 1;
          updates[`badges.challenges.${challengeId}.completedStreakBadges`] = updated;
          updates[`badges.challenges.${challengeId}.currentStreakBadgeLevel`] = 0;
        }

        if (challengeBadges.currentTimeBadgeLevel > 0) {
          const level = challengeBadges.currentTimeBadgeLevel;
          const updatedTime = { ...challengeBadges.completedTimeBadges };
          updatedTime[level] = (updatedTime[level] || 0) + 1;
          updates[`badges.challenges.${challengeId}.completedTimeBadges`] = updatedTime;
          updates[`badges.challenges.${challengeId}.currentTimeBadgeLevel`] = 0;
        }

        let legacyRunBadges = legacy.earnedConsecutiveRunBadges.map((item) =>
          item.challengeId === null ? { ...item, challengeId } : item
        );
        let legacyTimeBadges = legacy.earnedTimeBadges.map((item) =>
          item.challengeId === null ? { ...item, challengeId } : item
        );

        updates["badges.legacy.earnedConsecutiveRunBadges"] = legacyRunBadges;
        updates["badges.legacy.earnedTimeBadges"] = legacyTimeBadges;
        updates["updatedAt"] = serverTimestamp();

        if (Object.keys(updates).length > 1) {
          await updateDoc(userStatsRef, updates);
        }

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
    // ── Double-submit guard ──────────────────────────────────────────────────
    // If a successful attempt for this day already exists, skip badge updates
    // entirely to prevent streak inflation and duplicate multiplier counts.
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
    // ────────────────────────────────────────────────────────────────────────

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
        legacy: getLegacyBadgeData({}),
      };
    }

    const userStatsData = userStatsSnap.data();
    const challenges = userStatsData.badges?.challenges || {};

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
      legacy: getLegacyBadgeData(userStatsData),
    };
  } catch (error) {
    console.error("Error getting all user badges:", error);
    return {
      allStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
      allMultipliers: { double: 0, triple: 0, quadruple: 0 },
      allTimeBadges: {},
      byChallengeId: {},
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
