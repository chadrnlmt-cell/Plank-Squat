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
      longestStreak: 0,
      streakBadges: [],
      doubleBadgeCount: 0,
      tripleBadgeCount: 0,
      quadrupleBadgeCount: 0,
      totalPlankSeconds: 0,
      timeBadges: [],
    };
  }

  if (!userStatsData.badges.challenges) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      streakBadges: [],
      doubleBadgeCount: 0,
      tripleBadgeCount: 0,
      quadrupleBadgeCount: 0,
      totalPlankSeconds: 0,
      timeBadges: [],
    };
  }

  return (
    userStatsData.badges.challenges[challengeId] || {
      currentStreak: 0,
      longestStreak: 0,
      streakBadges: [],
      doubleBadgeCount: 0,
      tripleBadgeCount: 0,
      quadrupleBadgeCount: 0,
      totalPlankSeconds: 0,
      timeBadges: [],
    }
  );
}

/**
 * Check if today's completion continues a streak
 * A streak continues if:
 * 1. This is day 1, OR
 * 2. The previous day (currentDay - 1) was completed successfully
 */
async function calculateStreakContinuation(
  userId,
  challengeId,
  currentDay,
  currentStreakCount
) {
  // Day 1 always starts a streak
  if (currentDay === 1) {
    return { continues: true, newStreak: 1 };
  }

  // Check if previous day was completed successfully
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
    // Previous day was completed successfully - continue streak
    return { continues: true, newStreak: currentStreakCount + 1 };
  } else {
    // Previous day was NOT completed - streak breaks, reset to 1
    return { continues: false, newStreak: 1 };
  }
}

/**
 * Calculate which streak badges should be awarded
 * Badges: 7, 14, 21, 28 days
 * Cumulative - once earned, kept forever
 */
function calculateStreakBadges(currentStreak, existingBadges) {
  const possibleBadges = [7, 14, 21, 28];
  const earned = [...existingBadges];

  for (const threshold of possibleBadges) {
    if (currentStreak >= threshold && !earned.includes(threshold)) {
      earned.push(threshold);
    }
  }

  return earned.sort((a, b) => a - b);
}

/**
 * Calculate multiplier badge counts
 * Check if today's achievement was 2x, 3x, or 4x the target
 */
function calculateMultiplierBadges(actualValue, targetValue, currentCounts) {
  const multiplier = actualValue / targetValue;
  const newCounts = { ...currentCounts };

  if (multiplier >= 4) {
    newCounts.quadrupleBadgeCount = (newCounts.quadrupleBadgeCount || 0) + 1;
  }
  if (multiplier >= 3) {
    newCounts.tripleBadgeCount = (newCounts.tripleBadgeCount || 0) + 1;
  }
  if (multiplier >= 2) {
    newCounts.doubleBadgeCount = (newCounts.doubleBadgeCount || 0) + 1;
  }

  return newCounts;
}

/**
 * Calculate time badges (plank only)
 * Every 30 minutes: 1800s, 3600s, 5400s, etc.
 */
function calculateTimeBadges(totalSeconds, existingBadges) {
  const earned = [...existingBadges];
  const milestones = [];

  // Generate milestones up to total seconds
  for (let i = 1800; i <= totalSeconds; i += 1800) {
    milestones.push(i);
  }

  for (const milestone of milestones) {
    if (!earned.includes(milestone)) {
      earned.push(milestone);
    }
  }

  return earned.sort((a, b) => a - b);
}

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
    // Get current userStats
    const userStatsRef = doc(db, "userStats", userId);
    const userStatsSnap = await getDoc(userStatsRef);

    if (!userStatsSnap.exists()) {
      console.warn("userStats doc does not exist for badge update");
      return { newBadges: [] };
    }

    const userStatsData = userStatsSnap.data();
    const currentBadgeData = getChallengeBadgeData(userStatsData, challengeId);

    // Calculate streak
    const { continues, newStreak } = await calculateStreakContinuation(
      userId,
      challengeId,
      currentDay,
      currentBadgeData.currentStreak || 0
    );

    const longestStreak = Math.max(
      currentBadgeData.longestStreak || 0,
      newStreak
    );

    // Calculate streak badges
    const oldStreakBadges = currentBadgeData.streakBadges || [];
    const newStreakBadges = calculateStreakBadges(newStreak, oldStreakBadges);

    // Calculate multiplier badges
    const oldMultipliers = {
      doubleBadgeCount: currentBadgeData.doubleBadgeCount || 0,
      tripleBadgeCount: currentBadgeData.tripleBadgeCount || 0,
      quadrupleBadgeCount: currentBadgeData.quadrupleBadgeCount || 0,
    };
    const newMultipliers = calculateMultiplierBadges(
      actualValue,
      targetValue,
      oldMultipliers
    );

    // Calculate time badges (plank only)
    let newTotalPlankSeconds = currentBadgeData.totalPlankSeconds || 0;
    let newTimeBadges = currentBadgeData.timeBadges || [];

    if (movementType === "plank") {
      newTotalPlankSeconds += actualValue;
      const oldTimeBadges = currentBadgeData.timeBadges || [];
      newTimeBadges = calculateTimeBadges(newTotalPlankSeconds, oldTimeBadges);
    }

    // Determine newly earned badges for celebration
    const newBadges = [];

    // New streak badges
    for (const badge of newStreakBadges) {
      if (!oldStreakBadges.includes(badge)) {
        newBadges.push({ type: "streak", value: badge });
      }
    }

    // New multiplier badges
    if (newMultipliers.doubleBadgeCount > oldMultipliers.doubleBadgeCount) {
      newBadges.push({
        type: "multiplier",
        level: "double",
        count: newMultipliers.doubleBadgeCount,
      });
    }
    if (newMultipliers.tripleBadgeCount > oldMultipliers.tripleBadgeCount) {
      newBadges.push({
        type: "multiplier",
        level: "triple",
        count: newMultipliers.tripleBadgeCount,
      });
    }
    if (
      newMultipliers.quadrupleBadgeCount > oldMultipliers.quadrupleBadgeCount
    ) {
      newBadges.push({
        type: "multiplier",
        level: "quadruple",
        count: newMultipliers.quadrupleBadgeCount,
      });
    }

    // New time badges
    if (movementType === "plank") {
      const oldTimeBadges = currentBadgeData.timeBadges || [];
      for (const badge of newTimeBadges) {
        if (!oldTimeBadges.includes(badge)) {
          newBadges.push({ type: "time", value: badge });
        }
      }
    }

    // Update Firestore
    const updatedBadgeData = {
      currentStreak: newStreak,
      longestStreak,
      streakBadges: newStreakBadges,
      doubleBadgeCount: newMultipliers.doubleBadgeCount,
      tripleBadgeCount: newMultipliers.tripleBadgeCount,
      quadrupleBadgeCount: newMultipliers.quadrupleBadgeCount,
      totalPlankSeconds: newTotalPlankSeconds,
      timeBadges: newTimeBadges,
    };

    await updateDoc(userStatsRef, {
      [`badges.challenges.${challengeId}`]: updatedBadgeData,
      updatedAt: serverTimestamp(),
    });

    console.log("Badges updated:", {
      challengeId,
      newStreak,
      newBadges: newBadges.length,
    });

    return { newBadges, badgeData: updatedBadgeData };
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
        allStreakBadges: [],
        allMultipliers: { double: 0, triple: 0, quadruple: 0 },
        allTimeBadges: [],
        byChallengeId: {},
      };
    }

    const userStatsData = userStatsSnap.data();
    const challenges = userStatsData.badges?.challenges || {};

    // Aggregate across all challenges
    const allStreakBadgesSet = new Set();
    let totalDouble = 0;
    let totalTriple = 0;
    let totalQuadruple = 0;
    const allTimeBadgesSet = new Set();

    for (const challengeId in challenges) {
      const badgeData = challenges[challengeId];

      // Collect streak badges
      if (badgeData.streakBadges) {
        badgeData.streakBadges.forEach((b) => allStreakBadgesSet.add(b));
      }

      // Sum multipliers
      totalDouble += badgeData.doubleBadgeCount || 0;
      totalTriple += badgeData.tripleBadgeCount || 0;
      totalQuadruple += badgeData.quadrupleBadgeCount || 0;

      // Collect time badges
      if (badgeData.timeBadges) {
        badgeData.timeBadges.forEach((b) => allTimeBadgesSet.add(b));
      }
    }

    return {
      allStreakBadges: Array.from(allStreakBadgesSet).sort((a, b) => a - b),
      allMultipliers: {
        double: totalDouble,
        triple: totalTriple,
        quadruple: totalQuadruple,
      },
      allTimeBadges: Array.from(allTimeBadgesSet).sort((a, b) => a - b),
      byChallengeId: challenges,
    };
  } catch (error) {
    console.error("Error getting all user badges:", error);
    return {
      allStreakBadges: [],
      allMultipliers: { double: 0, triple: 0, quadruple: 0 },
      allTimeBadges: [],
      byChallengeId: {},
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
