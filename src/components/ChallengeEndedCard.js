// src/components/ChallengeEndedCard.js
import React, { useState, useEffect } from "react";
import { calculateChallengeRankings } from "../rankingCalculator";

export default function ChallengeEndedCard({ userChallenge }) {
  const [isCalculatingRank, setIsCalculatingRank] = useState(false);
  const [rankError, setRankError] = useState(null);
  const [localRank, setLocalRank] = useState(userChallenge.finalRank);
  const [localTotalParticipants, setLocalTotalParticipants] = useState(userChallenge.totalParticipants);

  const challengeDetails = userChallenge.challengeDetails;
  const isPlank = challengeDetails.type === "plank";
  const totalDaysAttempted = userChallenge.totalDaysAttempted || 0;
  const successfulDaysCount = userChallenge.successfulDaysCount || 0;
  const numberOfDays = challengeDetails.numberOfDays;

  // Format seconds as "Xm Ys" or "Xs"
  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  // Calculate rankings if not yet calculated
  useEffect(() => {
    const calculateRankIfNeeded = async () => {
      // Check if ranking already calculated
      if (localRank != null && localTotalParticipants != null) {
        return;
      }

      // Check if we have the stats data needed
      if (!userChallenge.bestPerformance || totalDaysAttempted === 0) {
        // No attempts recorded, no need to calculate rank
        return;
      }

      setIsCalculatingRank(true);
      setRankError(null);

      try {
        await calculateChallengeRankings(
          userChallenge.challengeId,
          challengeDetails.type
        );

        // After calculation, we need to reload the userChallenge data
        // For now, we'll just set a flag that it's been calculated
        // The parent component should handle reloading
        // But we'll force a re-render by setting local state
        setLocalRank(userChallenge.finalRank || "?");
        setLocalTotalParticipants(userChallenge.totalParticipants || "?");
      } catch (error) {
        console.error("Error calculating rankings:", error);
        setRankError("Could not calculate rankings");
      } finally {
        setIsCalculatingRank(false);
      }
    };

    calculateRankIfNeeded();
  }, [userChallenge, challengeDetails, localRank, localTotalParticipants, totalDaysAttempted]);

  // If no attempts recorded
  if (totalDaysAttempted === 0) {
    return (
      <div
        style={{
          backgroundColor: "#fffbeb",
          padding: "20px",
          borderRadius: "8px",
          border: "2px solid #fbbf24",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "#92400e" }}>
          Challenge Ended
        </h3>
        <p style={{ margin: "5px 0", fontWeight: "bold" }}>
          {challengeDetails.name}
        </p>
        <p style={{ margin: "10px 0", color: "#78350f" }}>
          No attempts recorded
        </p>
      </div>
    );
  }

  // Get stats from userChallenge (should be populated)
  const bestPerformance = userChallenge.bestPerformance || 0;
  const averagePerformance = userChallenge.averagePerformance || 0;

  return (
    <div
      style={{
        backgroundColor: "#fffbeb",
        padding: "20px",
        borderRadius: "8px",
        border: "2px solid #fbbf24",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", color: "#92400e" }}>
        Challenge Ended
      </h3>
      <p style={{ margin: "5px 0", fontWeight: "bold", fontSize: "16px" }}>
        {challengeDetails.name}
      </p>

      <div style={{ marginTop: "15px" }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: "600", color: "#78350f" }}>
          Your Performance:
        </p>
        <ul style={{ margin: "0", paddingLeft: "20px", color: "#78350f" }}>
          <li style={{ marginBottom: "5px" }}>
            <strong>Best:</strong>{" "}
            {isPlank ? formatSeconds(bestPerformance) : `${bestPerformance} reps`}
          </li>
          <li style={{ marginBottom: "5px" }}>
            <strong>Average:</strong>{" "}
            {isPlank ? formatSeconds(averagePerformance) : `${averagePerformance} reps`}
            {" "}across {successfulDaysCount} successful day{successfulDaysCount !== 1 ? "s" : ""}
            {" "}({totalDaysAttempted} total attempt{totalDaysAttempted !== 1 ? "s" : ""})
          </li>
          {isCalculatingRank ? (
            <li style={{ marginBottom: "5px", fontStyle: "italic" }}>
              Calculating rankings...
            </li>
          ) : rankError ? (
            <li style={{ marginBottom: "5px", color: "#d32f2f" }}>
              {rankError}
            </li>
          ) : localRank != null && localTotalParticipants != null ? (
            <li style={{ marginBottom: "5px" }}>
              <strong>Ranked:</strong> #{localRank} of {localTotalParticipants} participants
            </li>
          ) : null}
          <li>
            <strong>Completed:</strong> {totalDaysAttempted} of {numberOfDays} days
          </li>
        </ul>
      </div>
    </div>
  );
}
