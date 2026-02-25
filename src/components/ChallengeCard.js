// src/components/ChallengeCard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";

export default function ChallengeCard({ challenge, onJoin }) {
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

  return (
    <>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "15px",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>
          {challenge.name}
          {isTeamChallenge && (
            <span
              style={{
                marginLeft: "8px",
                fontSize: "12px",
                padding: "2px 8px",
                backgroundColor: "#4CAF50",
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
          }}
        >
          Join Challenge
        </button>
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
