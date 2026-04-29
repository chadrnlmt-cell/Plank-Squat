// src/practiceConstants.js
// Built-in Practice Session — there is no admin-created "practice" document
// in Firestore. The Practice Session is always available, hard-coded here.

export const PRACTICE_CHALLENGE_ID = "practice";

export const PRACTICE_TARGET_SECONDS = 60;

// Built-in details object used wherever code expects a challenge-shaped object.
export const PRACTICE_DETAILS = {
  id: PRACTICE_CHALLENGE_ID,
  name: "Practice Session",
  description:
    "Always-available 60-second plank practice. Every session counts toward your totals and badges. Build a daily streak by practicing once per Phoenix calendar day.",
  type: "plank",
  isActive: true,
  isTeamChallenge: false,
  isPractice: true,
  startingValue: PRACTICE_TARGET_SECONDS,
  incrementPerDay: 0,
  numberOfDays: null,
  startDate: null,
};

export function isPracticeChallengeId(challengeId) {
  return challengeId === PRACTICE_CHALLENGE_ID;
}
