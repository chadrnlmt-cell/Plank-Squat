// src/practiceHelpers.js
// Persistence helpers for the built-in Practice Session.
// All practice data is isolated in two collections:
//   practiceAttempts        — one doc per session
//   practiceUserStats/{uid} — per-user aggregate (totals, badges, streak)
//
// Practice has no leaderboards. Every session counts toward totals and
// multiplier/total-time badges, but the calendar-day streak only advances
// once per Phoenix calendar day.

import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getPhoenixDate } from "./utils";
import { PRACTICE_CHALLENGE_ID, PRACTICE_TARGET_SECONDS } from "./practiceConstants";

// ───────────────────────────────────────────────────────────────────────────
// Phoenix calendar-day key (YYYY-MM-DD)
// ───────────────────────────────────────────────────────────────────────────
export function phoenixDayKey(date = null) {
  const d = date || getPhoenixDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousDayKey(key) {
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return phoenixDayKey(dt);
}

// ───────────────────────────────────────────────────────────────────────────
// Default practiceUserStats shape
// ───────────────────────────────────────────────────────────────────────────
function defaultStats(userId, displayName) {
  return {
    userId,
    displayName: displayName || null,
    joined: false,
    totalSessions: 0,
    totalSeconds: 0,
    bestSeconds: 0,
    avgSeconds: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastSessionDate: null, // Phoenix YYYY-MM-DD string
    lastSessionAt: null,   // Firestore Timestamp
    joinedAt: null,
    leftAt: null,
    // Badges (mirror challenge badge shape so PracticeCard can show them)
    completedStreakBadges: { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
    currentStreakBadgeLevel: 0,
    doubleBadgeCount: 0,
    tripleBadgeCount: 0,
    quadrupleBadgeCount: 0,
  };
}

const STREAK_MILESTONES = [3, 7, 14, 21, 28];

function calcStreakBadgeLevel(streak, currentLevel) {
  let level = currentLevel || 0;
  let newlyEarned = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m && m > level) {
      level = m;
      newlyEarned = m;
    }
  }
  return { level, newlyEarned };
}

// ───────────────────────────────────────────────────────────────────────────
// Read helpers
// ───────────────────────────────────────────────────────────────────────────
export async function getPracticeStats(userId) {
  if (!userId) return null;
  try {
    const ref = doc(db, "practiceUserStats", userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error("getPracticeStats error:", err);
    return null;
  }
}

export async function isJoinedPractice(userId) {
  const stats = await getPracticeStats(userId);
  return !!(stats && stats.joined);
}

// ───────────────────────────────────────────────────────────────────────────
// Join / Leave
// ───────────────────────────────────────────────────────────────────────────
export async function joinPractice(userId, displayName) {
  if (!userId) return;
  const ref = doc(db, "practiceUserStats", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...defaultStats(userId, displayName),
      joined: true,
      joinedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      joined: true,
      joinedAt: serverTimestamp(),
      leftAt: null,
      displayName: displayName || snap.data().displayName || null,
    });
  }
}

export async function leavePractice(userId) {
  if (!userId) return;
  const ref = doc(db, "practiceUserStats", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, {
    joined: false,
    leftAt: serverTimestamp(),
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Log a session
//   actualSeconds — what they held
//   success       — whether they hit/exceeded the 60s target
// Streak only advances once per Phoenix calendar day.
// Returns { newBadges, stats } so the caller can celebrate badges.
// ───────────────────────────────────────────────────────────────────────────
export async function logPracticeSession({
  userId,
  displayName,
  actualSeconds,
  success,
}) {
  if (!userId) return { newBadges: [], stats: null };

  const ref = doc(db, "practiceUserStats", userId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : defaultStats(userId, displayName);

  const todayKey = phoenixDayKey();
  const nowTs = Timestamp.fromDate(getPhoenixDate());

  // Always write the attempt (every session counts toward totals/badges)
  await addDoc(collection(db, "practiceAttempts"), {
    userId,
    displayName: displayName || existing.displayName || null,
    challengeId: PRACTICE_CHALLENGE_ID,
    targetValue: PRACTICE_TARGET_SECONDS,
    actualValue: actualSeconds || 0,
    success: !!success,
    dayKey: todayKey,
    timestamp: nowTs,
  });

  // ── Aggregate updates ────────────────────────────────────────────────────
  const newTotalSessions = (existing.totalSessions || 0) + 1;
  const newTotalSeconds = (existing.totalSeconds || 0) + (actualSeconds || 0);
  const newBestSeconds = Math.max(existing.bestSeconds || 0, actualSeconds || 0);
  const newAvgSeconds =
    newTotalSessions > 0 ? Math.round(newTotalSeconds / newTotalSessions) : 0;

  // ── Streak logic (calendar-day, Phoenix) ─────────────────────────────────
  let newCurrentStreak = existing.currentStreak || 0;
  let newBestStreak = existing.bestStreak || 0;
  let newLastSessionDate = existing.lastSessionDate || null;

  if (existing.lastSessionDate !== todayKey) {
    if (existing.lastSessionDate && existing.lastSessionDate === previousDayKey(todayKey)) {
      newCurrentStreak = (existing.currentStreak || 0) + 1;
    } else {
      newCurrentStreak = 1;
    }
    newLastSessionDate = todayKey;
    if (newCurrentStreak > newBestStreak) newBestStreak = newCurrentStreak;
  }

  // ── Streak badge level ───────────────────────────────────────────────────
  const { level: newStreakBadgeLevel, newlyEarned: newlyEarnedStreakBadge } =
    calcStreakBadgeLevel(newCurrentStreak, existing.currentStreakBadgeLevel || 0);

  // ── Multiplier badges (every successful session, based on actual/target) ─
  let newDouble = existing.doubleBadgeCount || 0;
  let newTriple = existing.tripleBadgeCount || 0;
  let newQuad = existing.quadrupleBadgeCount || 0;
  let newlyEarnedMultiplier = null;

  if (success && PRACTICE_TARGET_SECONDS > 0) {
    const m = (actualSeconds || 0) / PRACTICE_TARGET_SECONDS;
    if (m >= 4) {
      newQuad += 1;
      newlyEarnedMultiplier = "quadruple";
    } else if (m >= 3) {
      newTriple += 1;
      newlyEarnedMultiplier = "triple";
    } else if (m >= 2) {
      newDouble += 1;
      newlyEarnedMultiplier = "double";
    }
  }

  const updated = {
    userId,
    displayName: displayName || existing.displayName || null,
    joined: true,
    totalSessions: newTotalSessions,
    totalSeconds: newTotalSeconds,
    bestSeconds: newBestSeconds,
    avgSeconds: newAvgSeconds,
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    lastSessionDate: newLastSessionDate,
    lastSessionAt: nowTs,
    currentStreakBadgeLevel: newStreakBadgeLevel,
    completedStreakBadges:
      existing.completedStreakBadges || { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 },
    doubleBadgeCount: newDouble,
    tripleBadgeCount: newTriple,
    quadrupleBadgeCount: newQuad,
    joinedAt: existing.joinedAt || serverTimestamp(),
    leftAt: null,
    updatedAt: serverTimestamp(),
  };

  if (snap.exists()) {
    await updateDoc(ref, updated);
  } else {
    await setDoc(ref, updated);
  }

  const newBadges = [];
  if (newlyEarnedStreakBadge) {
    newBadges.push({ type: "streak", value: newlyEarnedStreakBadge });
  }
  if (newlyEarnedMultiplier) {
    newBadges.push({
      type: "multiplier",
      level: newlyEarnedMultiplier,
      count:
        newlyEarnedMultiplier === "double"
          ? newDouble
          : newlyEarnedMultiplier === "triple"
          ? newTriple
          : newQuad,
    });
  }

  return { newBadges, stats: updated };
}
