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

/**
 * Check if a challenge has ended.
 * Challenge ends at midnight on the final day (not the day after).
 * 
 * Example: 30-day challenge starting March 1st ends at midnight going into March 31st.
 * 
 * @param {Timestamp|Date} startDate - Challenge start date
 * @param {number} numberOfDays - Total days in challenge
 * @returns {boolean} - True if challenge has ended
 */
export function isChallengeEnded(startDate, numberOfDays) {
  if (!startDate || !numberOfDays || numberOfDays <= 0) return false;

  let start;
  if (startDate.toDate) {
    start = startDate.toDate();
  } else {
    start = new Date(startDate);
  }

  // Calculate end date: start + numberOfDays (this is the day AFTER the final day)
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + numberOfDays);
  endDate.setHours(0, 0, 0, 0);

  // Get current Phoenix time
  const now = getPhoenixDate();
  now.setHours(0, 0, 0, 0);

  // Challenge has ended if we're at or past the end date
  return now.getTime() >= endDate.getTime();
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
