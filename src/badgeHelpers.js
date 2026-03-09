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
      currentStreakBadgeLevel: 0, // Highest badge earned in current streak (0, 3, 7, 14, 21, 28)
      completedStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 }, // Count of each badge earned from completed streaks
      doubleBadgeCount: 0,
      tripleBadgeCount: 0,
      quadrupleBadgeCount: 0,
      totalPlankSeconds: 0,
      currentTimeBadgeLevel: 0, // Highest time badge earned (in seconds)
      completedTimeBadges: {}, // Count of each time badge earned { 1800: 1, 3600: 1, ... }
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
 * Calculate streak badge updates
 * Returns: { newBadgeLevel, completedBadges, newlyEarnedBadge }
 */
function calculateStreakBadges(currentStreak, currentBadgeLevel, existingCompletedBadges) {
  const milestones = [3, 7, 14, 21, 28];
  let newBadgeLevel = currentBadgeLevel;
  const completedBadges = { ...existingCompletedBadges };
  let newlyEarnedBadge = null;

  // Find the highest milestone reached in current streak
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
 * Called when a rest day occurs
 */
function finalizeStreakBadge(currentBadgeLevel, completedBadges) {
  if (currentBadgeLevel > 0) {
    // Add one count to the completed badge level
    const updated = { ...completedBadges };
    updated[currentBadgeLevel] = (updated[currentBadgeLevel] || 0) + 1;
    return updated;
  }
  return completedBadges;
}

/**
 * Calculate multiplier badge counts
 * FIXED: Only award the HIGHEST achievement badge (not multiple)
 * Check if today's achievement was 2x, 3x, or 4x the target
 */
function calculateMultiplierBadges(actualValue, targetValue, currentCounts) {
  const multiplier = actualValue / targetValue;
  const newCounts = { ...currentCounts };

  // Only award the highest achievement
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
 * Calculate time badges (plank only) - 30 minute increments
 * Similar to streak badges: progressive reveal, highest badge only
 * Every 30 minutes: 1800s (30m), 3600s (1h), 5400s (1h30m), 7200s (2h), 9000s (2h30m), 10800s (3h)...
 * Up to 36000s (10h)
 */
function calculateTimeBadges(totalSeconds, currentBadgeLevel, existingCompletedBadges) {
  // Generate milestones every 30 minutes up to 10 hours
  const milestones = [];
  for (let i = 1800; i <= 36000; i += 1800) {
    milestones.push(i);
  }

  let newBadgeLevel = currentBadgeLevel;
  const completedBadges = { ...existingCompletedBadges };
  let newlyEarnedBadge = null;

  // Find the highest milestone reached
  for (const milestone of milestones) {
    if (totalSeconds >= milestone && milestone > currentBadgeLevel) {
      // Award the new badge and retire the old one
      if (currentBadgeLevel > 0) {
        // Move previous badge to completed
        completedBadges[currentBadgeLevel] = (completedBadges[currentBadgeLevel] || 0) + 1;
      }
      newBadgeLevel = milestone;
      newlyEarnedBadge = milestone;
    }
  }

  return { newBadgeLevel, completedBadges, newlyEarnedBadge };
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

    let updatedCompletedBadges = currentBadgeData.completedStreakBadges;
    let currentBadgeLevel = currentBadgeData.currentStreakBadgeLevel;

    // If streak broke, finalize the previous streak's badge
    if (!continues && currentBadgeData.currentStreak > 0) {
      updatedCompletedBadges = finalizeStreakBadge(
        currentBadgeData.currentStreakBadgeLevel,
        currentBadgeData.completedStreakBadges
      );
      currentBadgeLevel = 0; // Reset for new streak
    }

    // Calculate streak badges for current/new streak
    const {
      newBadgeLevel,
      completedBadges,
      newlyEarnedBadge,
    } = calculateStreakBadges(newStreak, currentBadgeLevel, updatedCompletedBadges);

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

    // Determine newly earned badges for celebration
    const newBadges = [];

    // New streak badge
    if (newlyEarnedBadge) {
      newBadges.push({ type: "streak", value: newlyEarnedBadge });
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
    if (movementType === "plank" && newlyEarnedTimeBadge) {
      newBadges.push({ type: "time", value: newlyEarnedTimeBadge });
    }

    // Update Firestore
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
      updatedAt: serverTimestamp(),
    });

    console.log("Badges updated:", {
      challengeId,
      newStreak,
      currentBadgeLevel: newBadgeLevel,
      newTimeBadgeLevel,
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
        allStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
        allMultipliers: { double: 0, triple: 0, quadruple: 0 },
        allTimeBadges: {},
        byChallengeId: {},
      };
    }

    const userStatsData = userStatsSnap.data();
    const challenges = userStatsData.badges?.challenges || {};

    // Aggregate across all challenges
    const allStreakBadges = { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 };
    let totalDouble = 0;
    let totalTriple = 0;
    let totalQuadruple = 0;
    const allTimeBadges = {};

    for (const challengeId in challenges) {
      const badgeData = challenges[challengeId];

      // Sum completed streak badges
      if (badgeData.completedStreakBadges) {
        for (const level in badgeData.completedStreakBadges) {
          allStreakBadges[level] = (allStreakBadges[level] || 0) + badgeData.completedStreakBadges[level];
        }
      }

      // Sum multipliers
      totalDouble += badgeData.doubleBadgeCount || 0;
      totalTriple += badgeData.tripleBadgeCount || 0;
      totalQuadruple += badgeData.quadrupleBadgeCount || 0;

      // Collect time badges
      if (badgeData.completedTimeBadges) {
        for (const level in badgeData.completedTimeBadges) {
          allTimeBadges[level] = (allTimeBadges[level] || 0) + badgeData.completedTimeBadges[level];
        }
      }
    }

    return {
      allStreakBadges,
      allMultipliers: {
        double: totalDouble,
        triple: totalTriple,
        quadruple: totalQuadruple,
      },
      allTimeBadges,
      byChallengeId: challenges,
    };
  } catch (error) {
    console.error("Error getting all user badges:", error);
    return {
      allStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
      allMultipliers: { double: 0, triple: 0, quadruple: 0 },
      allTimeBadges: {},
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
