// src/utils.js
// Utility helpers for Phoenix time and simple formatting

export function getPhoenixDate() {
  // Always use Phoenix time (MST, UTC-7, no DST)
  const phoenixString = new Date().toLocaleString("en-US", {
    timeZone: "America/Phoenix",
  });
  return new Date(phoenixString);
}

/**
 * Compute the current "challenge day" based on startDate (Firestore Timestamp or Date),
 * Phoenix current time, and total numberOfDays.
 *
 * Returns an integer:
 * - 0 if today is BEFORE the challenge start date
 * - 1..numberOfDays while challenge is running
 * - numberOfDays + k if today is AFTER the challenge period
 */
export function getChallengeDayFromStart(startDate, numberOfDays) {
  if (!startDate || !numberOfDays || numberOfDays <= 0) return 0;

  let start;
  if (startDate.toDate) {
    // Firestore Timestamp
    start = startDate.toDate();
  } else {
    start = new Date(startDate);
  }

  // Phoenix "today"
  const now = getPhoenixDate();

  // Normalize both to midnight Phoenix
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const msDiff = now.getTime() - start.getTime();
  const dayDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));

  // If before start, day 0 (not started yet)
  if (dayDiff < 0) return 0;

  // Day number is 1-based
  return dayDiff + 1;
}

export function formatDateShort(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Simple progress percentage: currentDay / numberOfDays
export function calculateProgress(currentDay, numberOfDays) {
  if (!numberOfDays || numberOfDays <= 0) return 0;
  const value = (currentDay / numberOfDays) * 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}
