// src/components/ChallengeCard.js
import React from "react";

export default function ChallengeCard({
  challenge,
  onJoin,
  alreadyJoined,
  isJoining,
}) {
  return (
    <div className="card">
      <div className="card__body">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 8px 0" }}>{challenge.name}</h3>
            <span
              className={`status status--${
                challenge.type === "plank" ? "info" : "success"
              }`}
            >
              {challenge.type === "plank" ? "⏱️ Plank" : "💪 Squat"}
            </span>
          </div>
          {alreadyJoined && (
            <span className="status status--success">✓ Already Joined</span>
          )}
        </div>

        <p
          style={{ color: "var(--color-text-secondary)", marginBottom: "16px" }}
        >
          {challenge.description}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
            marginBottom: "16px",
            padding: "12px",
            background: "var(--color-secondary)",
            borderRadius: "var(--radius-base)",
          }}
        >
          <div>
            <div
              style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
            >
              Days
            </div>
            <div style={{ fontSize: "20px", fontWeight: "600" }}>
              {challenge.numberOfDays}
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
            >
              Start
            </div>
            <div style={{ fontSize: "20px", fontWeight: "600" }}>
              {challenge.startingValue}
              {challenge.type === "plank" ? "s" : ""}
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
            >
              Daily +
            </div>
            <div style={{ fontSize: "20px", fontWeight: "600" }}>
              {challenge.incrementPerDay}
              {challenge.type === "plank" ? "s" : ""}
            </div>
          </div>
        </div>

        {!alreadyJoined && (
          <button
            className="btn btn--primary btn--full-width"
            onClick={() => onJoin(challenge)}
            disabled={isJoining}
          >
            {isJoining ? "Joining..." : "Join Challenge"}
          </button>
        )}
      </div>
    </div>
  );
}
