// src/components/SquatLogger.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { getPhoenixDate } from "../utils";
import { updateSquatStatsOnSuccess } from "../statsHelpers";
import { updateBadgesOnCompletion } from "../badgeHelpers";
import BadgeCelebration from "./BadgeCelebration";

export default function SquatLogger({
  targetReps,
  day,
  userChallengeId,
  challengeId,
  userId,
  user,
  displayName,
  teamId,
  numberOfDays,
  onComplete,
  onCancel,
}) {
  const [squatCount, setSquatCount] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  // Badge celebration
  const [newBadges, setNewBadges] = useState([]);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  // Scroll to top on mount so all overlays/popups are fully visible
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleLogSquats = async (e) => {
    e.preventDefault();
    if (!squatCount || isLogging) return;

    const actualValue = parseInt(squatCount, 10);
    if (isNaN(actualValue) || actualValue < 0) return;

    setIsLogging(true);

    try {
      const success = actualValue >= targetReps;

      // Get current userChallenge data to update stats
      const userChallengeRef = doc(db, "userChallenges", userChallengeId);
      const userChallengeSnap = await getDoc(userChallengeRef);
      const currentData = userChallengeSnap.data() || {};

      // Calculate new stats
      const currentTotalDays = currentData.totalDaysAttempted || 0;
      const currentSuccessfulDays = currentData.successfulDaysCount || 0;
      const currentBest = currentData.bestPerformance || 0;
      const currentTotalReps = currentData.totalSuccessfulReps || 0;

      const newTotalDays = currentTotalDays + 1;
      const newSuccessfulDays = success ? currentSuccessfulDays + 1 : currentSuccessfulDays;
      const newBest = Math.max(currentBest, success ? actualValue : 0);
      const newTotalReps = currentTotalReps + (success ? actualValue : 0);
      const newAverage = newSuccessfulDays > 0 ? Math.round(newTotalReps / newSuccessfulDays) : 0;

      // Log attempt
      await addDoc(collection(db, "attempts"), {
        userId: userId,
        userChallengeId: userChallengeId,
        challengeId: challengeId,
        day: day,
        targetValue: targetReps,
        actualValue,
        success,
        missed: false,
        timestamp: Timestamp.fromDate(getPhoenixDate()),
      });

      const nextDay = day + 1;

      await updateDoc(userChallengeRef, {
        currentDay: nextDay,
        lastCompletedDay: day,
        lastCompletedDate: Timestamp.fromDate(getPhoenixDate()),
        totalDaysAttempted: newTotalDays,
        successfulDaysCount: newSuccessfulDays,
        bestPerformance: newBest,
        totalSuccessfulReps: newTotalReps,
        averagePerformance: newAverage,
      });

      // Only update stats on successful days, with overrideDisplayName and teamId
      if (success) {
        await updateSquatStatsOnSuccess({
          user: user || { uid: userId },
          challengeId,
          actualReps: actualValue,
          overrideDisplayName: displayName || undefined,
          teamId: teamId || null,
        });

        // Update badges and check for new badges
        const badgeResult = await updateBadgesOnCompletion({
          userId: userId,
          challengeId: challengeId,
          currentDay: day,
          actualValue: actualValue,
          targetValue: targetReps,
          movementType: "squat",
        });

        if (badgeResult.newBadges && badgeResult.newBadges.length > 0) {
          setNewBadges(badgeResult.newBadges);
          setShowBadgeCelebration(true);

          // Delay completion to show celebration
          setTimeout(() => {
            setSquatCount("");
            onComplete();
          }, 3500); // Slightly longer than badge celebration (3s)
          return; // Don't call onComplete immediately
        }
      }

      setSquatCount("");
      onComplete();
    } catch (error) {
      console.error("Error logging squats:", error);
      alert("Failed to log squats: " + (error?.message || "unknown error"));
      setIsLogging(false);
    }
  };

  // Check if any of the new badges is a lifetime streak (legacyRun)
  const hasLifetimeStreakBadge = newBadges.some((b) => b.type === "legacyRun");

  return (
    <>
      {/* Badge Celebration Modal */}
      {showBadgeCelebration && (
        <BadgeCelebration
          badges={newBadges}
          isLifetimeStreak={hasLifetimeStreakBadge}
          onClose={() => {
            setShowBadgeCelebration(false);
            setIsLogging(false);
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--color-background)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          zIndex: 1000,
        }}
      >
        {/* Cancel button */}
        <button
          onClick={onCancel}
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "transparent",
            border: "none",
            color: "var(--color-text-secondary)",
            fontSize: "14px",
            cursor: "pointer",
            padding: "8px 12px",
          }}
        >
          Cancel
        </button>

        <div className="card" style={{ maxWidth: "500px", width: "100%" }}>
          <div className="card__body">
            <h2 style={{ marginBottom: "16px", textAlign: "center" }}>
              Day {day} - Squat Challenge
            </h2>

            <p
              style={{
                textAlign: "center",
                fontSize: "18px",
                color: "var(--color-text-secondary)",
                marginBottom: "24px",
              }}
            >
              Goal: {targetReps} squats
            </p>

            <form
              onSubmit={handleLogSquats}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Squats Completed</label>
                <input
                  type="number"
                  className="form-control"
                  value={squatCount}
                  onChange={(e) => setSquatCount(e.target.value)}
                  placeholder="Enter number"
                  min="0"
                  disabled={isLogging}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full-width btn--lg"
                disabled={!squatCount || isLogging}
              >
                {isLogging ? "Logging..." : "Log Squats"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
