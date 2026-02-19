// src/statsHelpers.js
import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Normalize user object to ensure uid and displayName exist.
 * Optionally accepts an overrideDisplayName coming from Firestore profile.
 */
function normalizeUser(user, overrideDisplayName) {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: overrideDisplayName || user.displayName || "",
    photoURL: user.photoURL || null,
  };
}

/**
 * Ensure a userStats document exists and return its data.
 */
async function ensureUserStats(normUser) {
  if (!normUser) return null;

  const ref = doc(db, "userStats", normUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initialData = {
      userId: normUser.uid,
      displayName: normUser.displayName,
      photoURL: normUser.photoURL,
      totalPlankSeconds: 0,
      totalSquats: 0,
      bestPlankSeconds: 0,
      bestSquats: 0,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialData);
    return initialData;
  }

  return snap.data();
}

/**
 * Ensure a challengeUserStats document exists and return its ref + data.
 */
async function ensureChallengeUserStats(normUser, challengeId, movementType) {
  if (!normUser || !challengeId) return { ref: null, data: null };

  const id = `${challengeId}_${normUser.uid}`;
  const ref = doc(db, "challengeUserStats", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initialData = {
      challengeId,
      userId: normUser.uid,
      displayName: normUser.displayName,
      movementType, // "plank" or "squat"
      totalSeconds: 0,
      totalReps: 0,
      bestSeconds: 0,
      bestReps: 0,
      firstAchievedAt: null,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialData);
    console.log("Created new challengeUserStats doc:", {
      id,
      movementType,
      challengeId,
      userId: normUser.uid,
    });
    return { ref, data: initialData };
  }

  return { ref, data: snap.data() };
}

/**
 * Call this when a SQUAT day is successfully completed.
 */
export async function updateSquatStatsOnSuccess({
  user,
  challengeId,
  actualReps,
  overrideDisplayName,
}) {
  if (!challengeId || typeof actualReps !== "number") {
    console.warn("updateSquatStatsOnSuccess skipped:", {
      hasUser: !!user,
      challengeId,
      actualReps,
    });
    return;
  }

  const normUser = normalizeUser(user, overrideDisplayName);
  console.log("updateSquatStatsOnSuccess called:", {
    challengeId,
    actualReps,
    userId: normUser?.uid,
    displayName: normUser?.displayName,
  });

  // ----- userStats -----
  const userStatsRef = doc(db, "userStats", normUser.uid);
  const userStats = await ensureUserStats(normUser);
  if (!userStats) return;

  const newTotalSquats = (userStats.totalSquats || 0) + actualReps;
  const newBestSquats = Math.max(userStats.bestSquats || 0, actualReps);

  await updateDoc(userStatsRef, {
    totalSquats: newTotalSquats,
    bestSquats: newBestSquats,
    displayName: normUser.displayName || userStats.displayName || "",
    photoURL: normUser.photoURL || userStats.photoURL || null,
    updatedAt: serverTimestamp(),
  });

  // ----- challengeUserStats -----
  const { ref: challengeStatsRef, data: challengeStats } =
    await ensureChallengeUserStats(normUser, challengeId, "squat");

  if (!challengeStatsRef || !challengeStats) {
    console.warn("No challengeStatsRef/data for squat stats:", {
      challengeId,
      userId: normUser.uid,
    });
    return;
  }

  const newTotalReps = (challengeStats.totalReps || 0) + actualReps;
  let newBestReps = challengeStats.bestReps || 0;
  let newFirstAchievedAt = challengeStats.firstAchievedAt;

  if (actualReps > newBestReps) {
    newBestReps = actualReps;
    newFirstAchievedAt = serverTimestamp();
  }

  await updateDoc(challengeStatsRef, {
    totalReps: newTotalReps,
    bestReps: newBestReps,
    firstAchievedAt: newFirstAchievedAt,
    displayName: normUser.displayName || challengeStats.displayName || "",
    updatedAt: serverTimestamp(),
  });

  console.log("Updated squat challengeUserStats:", {
    challengeId,
    userId: normUser.uid,
    newTotalReps,
    newBestReps,
  });
}

/**
 * Call this when a PLANK day is successfully completed.
 */
export async function updatePlankStatsOnSuccess({
  user,
  challengeId,
  actualSeconds,
  overrideDisplayName,
}) {
  const normUser = normalizeUser(user, overrideDisplayName);
  if (!normUser || !challengeId || typeof actualSeconds !== "number") {
    console.warn("updatePlankStatsOnSuccess skipped:", {
      hasUser: !!user,
      challengeId,
      actualSeconds,
    });
    return;
  }

  console.log("updatePlankStatsOnSuccess called:", {
    challengeId,
    actualSeconds,
    userId: normUser.uid,
    displayName: normUser.displayName,
  });

  // ----- userStats -----
  const userStatsRef = doc(db, "userStats", normUser.uid);
  const userStats = await ensureUserStats(normUser);
  if (!userStats) return;

  const newTotalPlankSeconds =
    (userStats.totalPlankSeconds || 0) + actualSeconds;
  const newBestPlankSeconds = Math.max(
    userStats.bestPlankSeconds || 0,
    actualSeconds
  );

  await updateDoc(userStatsRef, {
    totalPlankSeconds: newTotalPlankSeconds,
    bestPlankSeconds: newBestPlankSeconds,
    displayName: normUser.displayName || userStats.displayName || "",
    photoURL: normUser.photoURL || userStats.photoURL || null,
    updatedAt: serverTimestamp(),
  });

  // ----- challengeUserStats -----
  const { ref: challengeStatsRef, data: challengeStats } =
    await ensureChallengeUserStats(normUser, challengeId, "plank");

  if (!challengeStatsRef || !challengeStats) {
    console.warn("No challengeStatsRef/data for plank stats:", {
      challengeId,
      userId: normUser.uid,
    });
    return;
  }

  const newTotalSeconds = (challengeStats.totalSeconds || 0) + actualSeconds;
  let newBestSeconds = challengeStats.bestSeconds || 0;
  let newFirstAchievedAt = challengeStats.firstAchievedAt;

  if (actualSeconds > newBestSeconds) {
    newBestSeconds = actualSeconds;
    newFirstAchievedAt = serverTimestamp();
  }

  await updateDoc(challengeStatsRef, {
    totalSeconds: newTotalSeconds,
    bestSeconds: newBestSeconds,
    firstAchievedAt: newFirstAchievedAt,
    displayName: normUser.displayName || challengeStats.displayName || "",
    updatedAt: serverTimestamp(),
  });

  console.log("Updated plank challengeUserStats:", {
    challengeId,
    userId: normUser.uid,
    newTotalSeconds,
    newBestSeconds,
  });
}
