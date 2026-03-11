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
 * Get or initialize the legacy badge data from userStats
 */
function getLegacyBadgeData(userStatsData) {
  const legacy = userStatsData?.badges?.legacy || {};
  return {
    // Best Consecutive Run (streak across all challenges, no calendar gap penalty)
    consecutiveRun: legacy.consecutiveRun || 0,
    consecutiveRunBadgeLevel: legacy.consecutiveRunBadgeLevel || 0, // highest milestone reached mid-run
    earnedConsecutiveRunBadges: legacy.earnedConsecutiveRunBadges || [], // milestones awarded at rest [30,60,...]

    // Lifetime plank time badges — every 30-min milestone earned permanently
    earnedTimeBadges: legacy.earnedTimeBadges || [], // array of milestone seconds [1800, 3600, ...]
  };
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
 * Calculate time badges (plank only) - 30 minute increments, highest badge only per challenge
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

/**
 * Legacy consecutive run milestones: 30, 60, 90 ... 365
 */
const LEGACY_RUN_MILESTONES = (() => {
  const m = [];
  for (let i = 30; i <= 365; i += 30) m.push(i);
  if (!m.includes(365)) m.push(365);
  return m;
})();

/**
 * Legacy time milestones: every 30 min up to 10 hours
 * Unlike challenge time badges, ALL earned milestones stay permanently.
 */
const LEGACY_TIME_MILESTONES = (() => {
  const m = [];
  for (let i = 1800; i <= 36000; i += 1800) m.push(i);
  return m;
})();

/**
 * Determine how many active challenges exist for today.
 * We count distinct challengeIds with a successful attempt by this user today.
 * Then we count total active challenges the user is enrolled in.
 * If completedToday >= totalActiveEnrolled → all challenges done.
 *
 * Simple approach: caller passes in whether all challenges are done for today.
 * We derive it by checking userChallenges for active enrollments and whether
 * each has a success attempt today.
 */
async function allActiveChallengesCompletedToday(userId, currentChallengeId) {
  try {
    // Get all active userChallenge enrollments for this user
    const ucQuery = query(
      collection(db, "userChallenges"),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    const ucSnap = await getDocs(ucQuery);

    if (ucSnap.empty) return true; // only 1 challenge, they just completed it

    const activeChallengeIds = ucSnap.docs.map((d) => d.data().challengeId);

    if (activeChallengeIds.length === 1) return true; // only enrolled in one

    // For each active challenge, check if there's a successful attempt today
    // We use the lastSuccessDate from userStats to avoid heavy query load —
    // but for multi-challenge we need to check each. Keep it simple: query
    // today's attempts for this user across all active challenges.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    // Check each active challenge for a success attempt today
    for (const cId of activeChallengeIds) {
      const attQ = query(
        collection(db, "attempts"),
        where("userId", "==", userId),
        where("challengeId", "==", cId),
        where("success", "==", true)
      );
      const attSnap = await getDocs(attQ);

      // Filter to today's attempts in JS (Firestore free tier avoids composite index)
      const todaySuccess = attSnap.docs.some((d) => {
        const ts = d.data().timestamp;
        if (!ts) return false;
        const ms = ts.toMillis ? ts.toMillis() : ts * 1000;
        return ms >= todayTs;
      });

      if (!todaySuccess) return false; // at least one active challenge not done today
    }

    return true;
  } catch (err) {
    console.error("allActiveChallengesCompletedToday error:", err);
    // Fail safe: don't increment if we can't verify
    return false;
  }
}

/**
 * Update the legacy (Lifetime Achievements) badge data.
 *
 * Consecutive Run rules:
 * - Increments once per calendar day only when ALL active challenges are completed
 * - No calendar gap penalty between challenges (Option A — true freeze)
 * - Resets to 0 only when a day is missed inside an active challenge
 * - Badge earned at REST (day after they stop), except 365 fires immediately
 * - Previous streak's highest milestone is preserved in earnedConsecutiveRunBadges
 *
 * Legacy Time rules:
 * - Every 30-min milestone of totalPlankSeconds is permanently earned
 * - All earned milestones stay on the wall forever
 */
async function updateLegacyBadges(userId, movementType, userStatsData) {
  const legacy = getLegacyBadgeData(userStatsData);
  const newlyEarnedLegacyBadges = [];

  // ── Consecutive Run ──────────────────────────────────────────────────────
  const allDone = await allActiveChallengesCompletedToday(userId, null);

  let newRun = legacy.consecutiveRun;
  let newRunBadgeLevel = legacy.consecutiveRunBadgeLevel;
  let earnedRunBadges = [...legacy.earnedConsecutiveRunBadges];

  if (allDone) {
    // Check if we already incremented today (lastSuccessDate guard)
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

      // Check for immediate 365-day badge
      if (newRun === 365 && !earnedRunBadges.includes(365)) {
        earnedRunBadges = [...earnedRunBadges, 365];
        newRunBadgeLevel = 365;
        newlyEarnedLegacyBadges.push({ type: "legacyRun", value: 365 });
      }

      // Track highest mid-run milestone reached (badge awarded at rest)
      for (const milestone of LEGACY_RUN_MILESTONES) {
        if (newRun >= milestone && milestone > newRunBadgeLevel && milestone !== 365) {
          newRunBadgeLevel = milestone;
          // Don't add to earnedRunBadges yet — awarded at rest
        }
      }
    }
    // If already counted today, leave newRun as-is (idempotent)
  }
  // If !allDone — we do NOT decrement here. Streak break is handled at
  // challenge day-miss time (the missed attempt path). For now just freeze.

  // ── Legacy Time Badges (plank only, all milestones permanent) ─────────────
  let earnedTimeBadges = [...legacy.earnedTimeBadges];

  if (movementType === "plank") {
    // totalPlankSeconds on userStats is already updated before this runs
    const totalSeconds = userStatsData.totalPlankSeconds || 0;

    for (const milestone of LEGACY_TIME_MILESTONES) {
      if (totalSeconds >= milestone && !earnedTimeBadges.includes(milestone)) {
        earnedTimeBadges = [...earnedTimeBadges, milestone];
        newlyEarnedLegacyBadges.push({ type: "legacyTime", value: milestone });
      }
    }
  }

  // ── Build the updated legacy object ──────────────────────────────────────
  const updatedLegacy = {
    consecutiveRun: newRun,
    consecutiveRunBadgeLevel: newRunBadgeLevel,
    earnedConsecutiveRunBadges: earnedRunBadges,
    earnedTimeBadges,
  };

  return { updatedLegacy, newlyEarnedLegacyBadges };
}

/**
 * Call this when a missed/failed day occurs to break the consecutive run.
 * Saves the highest milestone reached during the now-ended run to earnedConsecutiveRunBadges.
 */
export async function breakConsecutiveRun(userId) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const snap = await getDoc(userStatsRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const legacy = getLegacyBadgeData(data);

    // Award the highest milestone badge reached during the run (rest rule)
    let earnedRunBadges = [...legacy.earnedConsecutiveRunBadges];
    if (
      legacy.consecutiveRunBadgeLevel > 0 &&
      !earnedRunBadges.includes(legacy.consecutiveRunBadgeLevel)
    ) {
      earnedRunBadges = [...earnedRunBadges, legacy.consecutiveRunBadgeLevel];
    }

    await updateDoc(userStatsRef, {
      "badges.legacy.consecutiveRun": 0,
      "badges.legacy.consecutiveRunBadgeLevel": 0,
      "badges.legacy.earnedConsecutiveRunBadges": earnedRunBadges,
      updatedAt: serverTimestamp(),
    });

    console.log("Consecutive run broken. Badge awarded:", legacy.consecutiveRunBadgeLevel);
  } catch (err) {
    console.error("breakConsecutiveRun error:", err);
  }
}

// ---------------------------------------------------------------------------
// MAIN EXPORT
// ---------------------------------------------------------------------------

/**
 * Main function: Update badges after successful day completion
 * Returns: { newBadges: array of newly earned badges for celebration }
 */
export async function updateBadgesOnCompletion({
  userId,
  challengeId,
  currentDay,
  actualValue,
  targetValue,
  movementType, // "plank" or "squat"
}) {
  try {
    const userStatsRef = doc(db, "userStats", userId);
    const userStatsSnap = await getDoc(userStatsRef);

    if (!userStatsSnap.exists()) {
      console.warn("userStats doc does not exist for badge update");
      return { newBadges: [] };
    }

    const userStatsData = userStatsSnap.data();
    const currentBadgeData = getChallengeBadgeData(userStatsData, challengeId);

    // ── Challenge streak ────────────────────────────────────────────────────
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

    const {
      newBadgeLevel,
      completedBadges,
      newlyEarnedBadge,
    } = calculateStreakBadges(newStreak, currentBadgeLevel, updatedCompletedBadges);

    // ── Multiplier badges ───────────────────────────────────────────────────
    const oldMultipliers = {
      doubleBadgeCount: currentBadgeData.doubleBadgeCount || 0,
      tripleBadgeCount: currentBadgeData.tripleBadgeCount || 0,
      quadrupleBadgeCount: currentBadgeData.quadrupleBadgeCount || 0,
    };
    const newMultipliers = calculateMultiplierBadges(actualValue, targetValue, oldMultipliers);

    // ── Challenge time badges (highest only) ────────────────────────────────
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

    // ── Legacy / Lifetime Achievements ─────────────────────────────────────
    // NOTE: totalPlankSeconds on userStatsData is already updated by
    // updatePlankStatsOnSuccess before this function is called.
    const { updatedLegacy, newlyEarnedLegacyBadges } =
      await updateLegacyBadges(userId, movementType, userStatsData);

    // ── Build newBadges list for celebration ────────────────────────────────
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

    // Add legacy badges to celebration
    newBadges.push(...newlyEarnedLegacyBadges);

    // ── Write to Firestore ──────────────────────────────────────────────────
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

    console.log("Badges updated:", {
      challengeId,
      newStreak,
      consecutiveRun: updatedLegacy.consecutiveRun,
      newTimeBadgeLevel,
      legacyTimeBadges: updatedLegacy.earnedTimeBadges.length,
      newBadges: newBadges.length,
    });

    return { newBadges, badgeData: updatedBadgeData, legacyData: updatedLegacy };
  } catch (error) {
    console.error("Error updating badges:", error);
    return { newBadges: [] };
  }
}

/**
 * Get all badges for a user across all challenges (for Profile total display)
 */
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

/**
 * Get badge data for a specific challenge (for Active tab display)
 */
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

/**
 * Get legacy badge data for a user (for Profile Lifetime Achievements display)
 */
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
