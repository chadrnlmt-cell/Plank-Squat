// src/components/ChallengeEndedCard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { calculateChallengeRankings } from "../rankingCalculator";

export default function ChallengeEndedCard({
  userChallenge,
  isAwaitingGlobalEnd = false,
  onViewLeaderboard = null,
}) {
  const [isCalculatingRank, setIsCalculatingRank] = useState(false);
  const [rankError, setRankError] = useState(null);
  const [localRank, setLocalRank] = useState(userChallenge.finalRank ?? null);
  const [localTotalParticipants, setLocalTotalParticipants] = useState(
    userChallenge.totalParticipants ?? null
  );

  const challengeDetails = userChallenge.challengeDetails;
  const isPlank = challengeDetails.type === "plank";
  const totalDaysAttempted = userChallenge.totalDaysAttempted || 0;
  const successfulDaysCount = userChallenge.successfulDaysCount || 0;
  const numberOfDays = challengeDetails.numberOfDays;
  const lastCompletedDay = userChallenge.lastCompletedDay || 0; // eslint-disable-line no-unused-vars

  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  useEffect(() => {
    const calculateRankIfNeeded = async () => {
      if (isAwaitingGlobalEnd) return;
      if (localRank != null && localTotalParticipants != null) return;
      if (userChallenge.bestPerformance == null || totalDaysAttempted === 0) return;

      setIsCalculatingRank(true);
      setRankError(null);

      try {
        await calculateChallengeRankings(
          userChallenge.challengeId,
          challengeDetails.type
        );

        const freshDoc = await getDoc(
          doc(db, "userChallenges", userChallenge.userChallengeId)
        );
        const freshData = freshDoc.exists() ? freshDoc.data() : null;

        setLocalRank(freshData?.finalRank ?? null);
        setLocalTotalParticipants(freshData?.totalParticipants ?? null);
      } catch (error) {
        console.error("Error calculating rankings:", error);
        setRankError("Could not calculate rankings");
      } finally {
        setIsCalculatingRank(false);
      }
    };

    calculateRankIfNeeded();
  }, [userChallenge, challengeDetails, localRank, localTotalParticipants, totalDaysAttempted, isAwaitingGlobalEnd]);

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
          {isAwaitingGlobalEnd ? "🏁 Challenge Complete" : "Challenge Ended"}
        </h3>
        <p style={{ margin: "5px 0", fontWeight: "bold" }}>
          {challengeDetails.name}
        </p>
        <p style={{ margin: "10px 0", color: "#78350f" }}>No attempts recorded</p>
      </div>
    );
  }

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
        {isAwaitingGlobalEnd ? "🏁 Challenge Complete" : "Challenge Ended"}
      </h3>

      {isAwaitingGlobalEnd && (
        <p
          style={{
            margin: "0 0 10px 0",
            color: "#92400e",
            fontSize: "14px",
            fontStyle: "italic",
          }}
        >
          Final results at midnight MST
        </p>
      )}

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
            {isPlank
              ? formatSeconds(bestPerformance)
              : `${bestPerformance} reps`}
          </li>
          <li style={{ marginBottom: "5px" }}>
            <strong>Challenge avg:</strong>{" "}
            {isPlank
              ? formatSeconds(averagePerformance)
              : averagePerformance > 0
              ? `${averagePerformance} reps`
              : "—"}
          </li>
          <li style={{ marginBottom: "5px" }}>
            <strong>Days Completed:</strong> {successfulDaysCount} of{" "}
            {numberOfDays}
          </li>
          {isAwaitingGlobalEnd ? (
            <li style={{ marginBottom: "5px", fontStyle: "italic" }}>
              <strong>Rank:</strong> TBD - Updates at midnight MST
            </li>
          ) : isCalculatingRank ? (
            <li style={{ marginBottom: "5px", fontStyle: "italic" }}>
              Calculating rankings...
            </li>
          ) : rankError ? (
            <li style={{ marginBottom: "5px", color: "#d32f2f" }}>
              {rankError}
            </li>
          ) : localRank != null && localTotalParticipants != null ? (
            <li style={{ marginBottom: "5px" }}>
              <strong>Ranked:</strong> #{localRank} of {localTotalParticipants}{" "}
              participants
            </li>
          ) : null}
        </ul>
      </div>

      {/* View Final Leaderboard button — shown on both awaiting and ended cards
          when the parent has wired up the onViewLeaderboard handler */}
      {onViewLeaderboard && (
        <button
          onClick={() => onViewLeaderboard(userChallenge.challengeId)}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: "600",
            backgroundColor: "#f59e0b",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          📊 View Final Leaderboard
        </button>
      )}
    </div>
  );
}
