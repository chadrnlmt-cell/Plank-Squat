// src/components/ChallengeCard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";

// Format seconds: <60s shows "30s", >=60s shows "1:15"
const formatGoalTime = (seconds) => {
  const s = Number(seconds) || 0;
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function ChallengeCard({ challenge, onJoin, alreadyJoined }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [showTeamSelect, setShowTeamSelect] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Check if this is a team challenge
  const isTeamChallenge = challenge.isTeamChallenge || false;

  // Load teams when user clicks Join (only for team challenges)
  const loadTeams = async () => {
    try {
      setLoadingTeams(true);
      const q = query(collection(db, "teams"));
      const snapshot = await getDocs(q);
      const teamData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTeams(teamData);
    } catch (error) {
      console.error("Error loading teams:", error);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleJoinClick = async () => {
    // If it's a team challenge, show team selection modal
    if (isTeamChallenge) {
      await loadTeams();
      setShowTeamSelect(true);
    } else {
      // If it's NOT a team challenge, join directly without team selection
      onJoin(challenge, null);
    }
  };

  const handleConfirmJoin = () => {
    // If team challenge, require team selection
    if (isTeamChallenge && !selectedTeam) {
      alert("Please select a team to join this team challenge.");
      return;
    }

    // Call onJoin with selected team (or null for individual challenges)
    onJoin(challenge, selectedTeam || null);
    setShowTeamSelect(false);
    setSelectedTeam("");
  };

  const handleCancelJoin = () => {
    setShowTeamSelect(false);
    setSelectedTeam("");
  };

  // Calculate start date display
  let startDateDisplay = "Unknown";
  try {
    if (challenge.startDate?.toDate) {
      startDateDisplay = challenge.startDate.toDate().toLocaleDateString();
    } else if (challenge.startDate) {
      startDateDisplay = new Date(challenge.startDate).toLocaleDateString();
    }
  } catch (e) {
    console.error("Date error:", e);
  }

  // Format date range for challenge duration
  const formatDateRange = () => {
    try {
      let startDate;
      if (challenge.startDate?.toDate) {
        startDate = challenge.startDate.toDate();
      } else if (challenge.startDate) {
        startDate = new Date(challenge.startDate);
      } else {
        return "Duration not set";
      }

      const numberOfDays = challenge.numberOfDays || 0;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + numberOfDays - 1);

      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      const startStr = startDate.toLocaleDateString('en-US', options);
      const endStr = endDate.toLocaleDateString('en-US', options);

      return `${startStr} - ${endStr}`;
    } catch (e) {
      console.error("Error formatting date range:", e);
      return "Duration not available";
    }
  };

  // Calculate final value
  const calculateFinalValue = () => {
    const startingValue = challenge.startingValue || 0;
    const incrementPerDay = challenge.incrementPerDay || 0;
    const numberOfDays = challenge.numberOfDays || 0;
    return startingValue + (numberOfDays - 1) * incrementPerDay;
  };

  // Get unit abbreviation — for plank we use formatGoalTime, for squats plain reps
  const getUnit = () => {
    return challenge.type === "plank" ? "" : "reps";
  };

  // Format a value for display based on challenge type
  const formatValue = (val) => {
    if (challenge.type === "plank") return formatGoalTime(val);
    return `${val} reps`;
  };

  // Format increment per day
  const formatIncrement = (val) => {
    if (challenge.type === "plank") return `+${val}s per day`;
    return `+${val} reps per day`;
  };

  return (
    <>
      <div
        style={{
          backgroundColor: alreadyJoined ? "#e8f5e9" : "white",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: alreadyJoined
            ? "0 2px 8px rgba(76, 175, 80, 0.3)"
            : "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "15px",
          border: alreadyJoined ? "2px solid #4CAF50" : "none",
          position: "relative",
        }}
      >
        {/* Fun "Already Joined" badge */}
        {alreadyJoined && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            <span style={{ fontSize: "16px" }}>✓</span>
            You're In!
          </div>
        )}

        <h3 style={{ margin: "0 0 10px 0", color: "#333", fontWeight: "bold", paddingRight: alreadyJoined ? "110px" : "0" }}>
          {challenge.name}
          {isTeamChallenge && (
            <span
              style={{
                marginLeft: "8px",
                fontSize: "12px",
                padding: "2px 8px",
                backgroundColor: alreadyJoined ? "#2E7D32" : "#4CAF50",
                color: "white",
                borderRadius: "4px",
              }}
            >
              TEAM CHALLENGE
            </span>
          )}
        </h3>
        <p style={{ margin: "5px 0", color: "#666", fontSize: "14px" }}>
          {challenge.description}
        </p>
        <p style={{ margin: "5px 0", color: "#999", fontSize: "13px" }}>
          {challenge.numberOfDays} days • Starts {startDateDisplay}
        </p>

        {/* Challenge Details Section */}
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "5px",
            backgroundColor: alreadyJoined ? "#f1f8f4" : "#f9f9f9",
            fontSize: "13px",
          }}
        >
          {/* Row 1: Duration and Days */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "#555" }}>
              <strong>Duration:</strong> {formatDateRange()}
            </span>
            <span style={{ color: "#555" }}>
              <strong>Days:</strong> {challenge.numberOfDays}
            </span>
          </div>

          {/* Row 2: Starting and Final */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "#555" }}>
              <strong>Starting:</strong> {formatValue(challenge.startingValue)}
            </span>
            <span style={{ color: "#555" }}>
              <strong>Final:</strong> {formatValue(calculateFinalValue())}
            </span>
          </div>

          {/* Row 3: Increase (centered) */}
          <div style={{ textAlign: "center", color: "#555" }}>
            <strong>Increase:</strong> {formatIncrement(challenge.incrementPerDay)}
          </div>
        </div>

        {alreadyJoined ? (
          <div
            style={{
              marginTop: "15px",
              padding: "12px 20px",
              fontSize: "16px",
              backgroundColor: "#4CAF50",
              color: "white",
              borderRadius: "5px",
              textAlign: "center",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🎉</span>
            Already Joined! Check the Active tab
            <span style={{ fontSize: "20px" }}>🎉</span>
          </div>
        ) : (
          <button
            onClick={handleJoinClick}
            style={{
              marginTop: "15px",
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#45a049")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#4CAF50")}
          >
            Join Challenge
          </button>
        )}
      </div>

      {/* TEAM SELECTION MODAL - Only shown for team challenges */}
      {showTeamSelect && isTeamChallenge && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h2>Join {challenge.name}</h2>
            <p style={{ color: "#666", marginBottom: "20px" }}>
              This is a team challenge. Please select your team to join.
            </p>

            {loadingTeams ? (
              <p>Loading teams...</p>
            ) : teams.length > 0 ? (
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Select a Team *
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                  }}
                >
                  <option value="">-- Choose a team --</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "#d32f2f", fontWeight: "bold" }}>
                  No teams available!
                </p>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  An admin needs to create teams first. Contact your administrator.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleConfirmJoin}
                disabled={teams.length === 0}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: teams.length === 0 ? "#ccc" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: teams.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Join Challenge
              </button>
              <button
                onClick={handleCancelJoin}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "#999",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
