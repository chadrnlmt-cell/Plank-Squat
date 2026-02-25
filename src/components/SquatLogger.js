// src/components/SquatLogger.js
import React, { useState } from "react";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { getPhoenixDate } from "../utils";
import { updateSquatStatsOnSuccess } from "../statsHelpers";

export default function SquatLogger({
  targetReps,
  day,
  userChallengeId,
  challengeId,
  userId,
  user,
  displayName, // profile name from App
  teamId, // NEW: pass teamId from parent
  numberOfDays,
  onComplete,
  onCancel,
}) {
  const [squatCount, setSquatCount] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  const handleLogSquats = async (e) => {
    e.preventDefault();
    if (!squatCount || isLogging) return;

    const actualValue = parseInt(squatCount, 10);
    if (isNaN(actualValue) || actualValue < 0) return;

    setIsLogging(true);

    try {
      const success = actualValue >= targetReps;

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
      const isComplete = nextDay > numberOfDays;

      await updateDoc(doc(db, "userChallenges", userChallengeId), {
        currentDay: nextDay,
        lastCompletedDay: day,
        lastCompletedDate: Timestamp.fromDate(getPhoenixDate()),
        status: isComplete ? "completed" : "active",
      });

      // Only update stats on successful days, with overrideDisplayName and teamId
      if (success) {
        await updateSquatStatsOnSuccess({
          user: user || { uid: userId },
          challengeId,
          actualReps: actualValue,
          overrideDisplayName: displayName || undefined,
          teamId: teamId || null, // NEW: pass teamId for caching
        });
      }

      setSquatCount("");
      onComplete();
    } catch (error) {
      console.error("Error logging squats:", error);
      alert("Failed to log squats: " + (error?.message || "unknown error"));
    } finally {
      setIsLogging(false);
    }
  };

  return (
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
  );
}
