// src/components/AdminPanel.js

import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import TeamManagement from "./TeamManagement";

export default function AdminPanel({ user }) {
  const [activeAdminTab, setActiveAdminTab] = useState("challenges");
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [missedLoading, setMissedLoading] = useState(false);
  const [missedByDay, setMissedByDay] = useState({});

  // Admin email must match your real email exactly
  const ADMIN_EMAIL = "chadrnlmt@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;
  console.log("ADMIN CHECK", user?.email, ADMIN_EMAIL, isAdmin);

  // Initial form state - NOW includes isTeamChallenge
  const defaultFormState = {
    name: "",
    description: "",
    type: "plank",
    startDate: "",
    numberOfDays: 30,
    startingValue: 60,
    incrementPerDay: 5,
    isActive: true,
    isTeamChallenge: false, // NEW!
  };

  const [formData, setFormData] = useState(defaultFormState);

  // Helper: convert YYYY-MM-DD string to a Date at local midnight
  function dateFromYMD(ymd) {
    if (!ymd) return null;
    const [year, month, day] = ymd.split("-").map((v) => parseInt(v, 10));
    // month is 0-based in JS Date
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  // Load challenges from Firestore
  useEffect(() => {
    if (isAdmin) {
      loadChallenges();
    } else {
      setLoading(false);
      setChallenges([]);
    }
  }, [isAdmin]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "challenges"));
      const snapshot = await getDocs(q);
      const data = [];

      for (const docSnap of snapshot.docs) {
        const challengeData = docSnap.data();

        // Get user count for this challenge
        const userCountQuery = query(
          collection(db, "userChallenges"),
          where("challengeId", "==", docSnap.id)
        );
        const userCountSnapshot = await getDocs(userCountQuery);
        const userCount = userCountSnapshot.size;

        data.push({
          id: docSnap.id,
          ...challengeData,
          userCount,
        });
      }

      // Sort: active first, then by createdAt descending
      data.sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
        }
        return (
          new Date(b.createdAt?.toDate?.() || 0) -
          new Date(a.createdAt?.toDate?.() || 0)
        );
      });

      setChallenges(data);
    } catch (error) {
      console.error("Error loading challenges:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    if (!formData.name || !formData.description || !formData.startDate) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const startDateObj = dateFromYMD(formData.startDate);

      await addDoc(collection(db, "challenges"), {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        numberOfDays: parseInt(formData.numberOfDays, 10),
        startingValue: parseInt(formData.startingValue, 10),
        incrementPerDay: parseInt(formData.incrementPerDay, 10),
        isActive: formData.isActive,
        isTeamChallenge: formData.isTeamChallenge, // NEW!
        createdAt: Timestamp.now(),
        createdBy: user.email,
        startDate: Timestamp.fromDate(startDateObj),
      });

      setFormData(defaultFormState);
      setShowCreateForm(false);
      loadChallenges();
    } catch (error) {
      console.error("Error creating challenge:", error);
      alert("Error creating challenge");
    }
  };

  const handleSaveEdit = async () => {
    if (
      !editingChallenge?.name ||
      !editingChallenge?.description ||
      !editingChallenge?.startDate
    ) {
      alert("Please fill in all required fields");
      return;
    }

    setConfirmAction({
      type: "confirmEdit",
      message:
        "Editing this challenge may affect users already enrolled. Continue?",
    });
  };

  const confirmEdit = async () => {
    try {
      const startDateObj = dateFromYMD(editingChallenge.startDate);

      await updateDoc(doc(db, "challenges", editingChallenge.id), {
        name: editingChallenge.name,
        description: editingChallenge.description,
        type: editingChallenge.type,
        numberOfDays: parseInt(editingChallenge.numberOfDays, 10),
        startingValue: parseInt(editingChallenge.startingValue, 10),
        incrementPerDay: parseInt(editingChallenge.incrementPerDay, 10),
        startDate: Timestamp.fromDate(startDateObj),
        isTeamChallenge: editingChallenge.isTeamChallenge || false, // NEW!
      });

      setEditingChallenge(null);
      setConfirmAction(null);
      loadChallenges();
    } catch (error) {
      console.error("Error saving challenge:", error);
      alert("Error saving challenge");
    }
  };

  const handleDeactivate = (challenge) => {
    setConfirmAction({
      type: "deactivate",
      challengeId: challenge.id,
      message: `Deactivate ${challenge.name}? Users will no longer see it in Available tab. Are you sure?`,
    });
  };

  const confirmDeactivate = async (challengeId) => {
    try {
      const current = challenges.find((c) => c.id === challengeId);
      const newStatus = !current?.isActive;
      await updateDoc(doc(db, "challenges", challengeId), {
        isActive: newStatus,
      });

      setConfirmAction(null);
      loadChallenges();
    } catch (error) {
      console.error("Error updating challenge status:", error);
      alert("Error updating challenge");
    }
  };

  const handleDelete = (challenge) => {
    setConfirmAction({
      type: "delete",
      challengeId: challenge.id,
      message: `PERMANENTLY DELETE ${challenge.name}? This will remove ALL user progress and cannot be undone. Are you sure?`,
    });
  };

  const confirmDelete = async (challengeId) => {
    try {
      // Delete challenge
      await deleteDoc(doc(db, "challenges", challengeId));

      // Delete all userChallenges for this challenge
      const userChallengesQuery = query(
        collection(db, "userChallenges"),
        where("challengeId", "==", challengeId)
      );
      const userChallengesSnapshot = await getDocs(userChallengesQuery);
      const batch = writeBatch(db);
      userChallengesSnapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();

      // Delete all attempts for this challenge
      const attemptsQuery = query(
        collection(db, "attempts"),
        where("challengeId", "==", challengeId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const batch2 = writeBatch(db);
      attemptsSnapshot.forEach((docSnap) => batch2.delete(docSnap.ref));
      await batch2.commit();

      // Delete all challengeUserStats for this challenge (leaderboard data)
      const statsQuery = query(
        collection(db, "challengeUserStats"),
        where("challengeId", "==", challengeId)
      );
      const statsSnapshot = await getDocs(statsQuery);
      const batch3 = writeBatch(db);
      statsSnapshot.forEach((docSnap) => batch3.delete(docSnap.ref));
      await batch3.commit();

      setConfirmAction(null);
      loadChallenges();
    } catch (error) {
      console.error("Error deleting challenge:", error);
      alert("Error deleting challenge");
    }
  };

  const handleReset = (challenge) => {
    setConfirmAction({
      type: "reset",
      challengeId: challenge.id,
      userCount: challenge.userCount,
      message: `Reset ALL users back to Day 1? This will reset progress for ${challenge.userCount} enrolled users.`,
    });
    setResetConfirmText("");
  };

  const confirmReset = async (challengeId) => {
    if (resetConfirmText !== "RESET") {
      alert('Please type "RESET" to confirm');
      return;
    }

    try {
      // 1) Get all userChallenges for this challenge and reset progress fields
      const userChallengesQuery = query(
        collection(db, "userChallenges"),
        where("challengeId", "==", challengeId)
      );
      const userChallengesSnapshot = await getDocs(userChallengesQuery);

      const batch = writeBatch(db);
      userChallengesSnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          currentDay: 1,
          lastCompletedDay: 0,
          lastCompletedDate: null,
          status: "active",
          missedDaysCount: 0,
          joinedAt: null, // clear join time so user data looks fresh
        });
      });
      await batch.commit();

      // 2) Delete all attempts for this challenge (wipe history & missed days)
      const attemptsQuery = query(
        collection(db, "attempts"),
        where("challengeId", "==", challengeId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const batch2 = writeBatch(db);
      attemptsSnapshot.forEach((docSnap) => batch2.delete(docSnap.ref));
      await batch2.commit();

      // 3) Delete all leaderboard stats for this challenge
      //    (challengeUserStats docs -> clears totals/bests for this challenge)
      const statsQuery = query(
        collection(db, "challengeUserStats"),
        where("challengeId", "==", challengeId)
      );
      const statsSnapshot = await getDocs(statsQuery);
      const batch3 = writeBatch(db);
      statsSnapshot.forEach((docSnap) => batch3.delete(docSnap.ref));
      await batch3.commit();

      setConfirmAction(null);
      setResetConfirmText("");
      loadChallenges();
    } catch (error) {
      console.error("Error resetting challenge:", error);
      alert("Error resetting challenge");
    }
  };

  const handleEditClick = (challenge) => {
    let formattedDate;
    try {
      if (challenge.startDate?.toDate) {
        formattedDate = challenge.startDate
          .toDate()
          .toISOString()
          .split("T")[0];
      } else if (challenge.startDate) {
        formattedDate = new Date(challenge.startDate)
          .toISOString()
          .split("T")[0];
      } else {
        formattedDate = new Date().toISOString().split("T")[0];
      }
    } catch (e) {
      console.error("Date conversion error:", e);
      formattedDate = new Date().toISOString().split("T")[0];
    }

    setEditingChallenge({
      id: challenge.id,
      ...challenge,
      startDate: formattedDate,
      isTeamChallenge: challenge.isTeamChallenge || false, // NEW!
    });
  };

  // Load missed days for a given challenge grouped by day
  const loadMissedDaysForChallenge = async (challengeId) => {
    try {
      setMissedLoading(true);
      setMissedByDay({});

      const q = query(
        collection(db, "attempts"),
        where("challengeId", "==", challengeId),
        where("missed", "==", true)
      );
      const snapshot = await getDocs(q);

      const byDay = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const d = data.day;
        const userId = data.userId || "Unknown";
        const displayName = data.displayName || data.userId || "Unknown";

        if (!byDay[d]) byDay[d] = [];
        byDay[d].push({ userId, displayName });
      });

      setMissedByDay(byDay);
    } catch (err) {
      console.error("Error loading missed days:", err);
      setMissedByDay({});
    } finally {
      setMissedLoading(false);
    }
  };

  // ACCESS DENIED for non-admins
  if (!isAdmin) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "20px",
          backgroundColor: "#f5f5f5",
        }}
      >
        <h1 style={{ color: "#d32f2f", marginBottom: "10px" }}>
          Access Denied
        </h1>
        <p style={{ color: "#666", fontSize: "16px" }}>
          This area is restricted to administrators only.
        </p>
      </div>
    );
  }

  // ADMIN PANEL with TABS
  return (
    <div
      style={{
        padding: "20px",
        paddingBottom: "100px",
        backgroundColor: "#f5f5f5",
      }}
    >
      <h1>Admin Panel</h1>

      {/* TAB NAVIGATION */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          borderBottom: "2px solid #ddd",
        }}
      >
        <button
          onClick={() => setActiveAdminTab("challenges")}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            backgroundColor:
              activeAdminTab === "challenges" ? "#4CAF50" : "transparent",
            color: activeAdminTab === "challenges" ? "white" : "#666",
            border: "none",
            borderBottom:
              activeAdminTab === "challenges"
                ? "3px solid #4CAF50"
                : "3px solid transparent",
            cursor: "pointer",
            fontWeight: activeAdminTab === "challenges" ? "bold" : "normal",
          }}
        >
          Challenges
        </button>
        <button
          onClick={() => setActiveAdminTab("teams")}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            backgroundColor:
              activeAdminTab === "teams" ? "#4CAF50" : "transparent",
            color: activeAdminTab === "teams" ? "white" : "#666",
            border: "none",
            borderBottom:
              activeAdminTab === "teams"
                ? "3px solid #4CAF50"
                : "3px solid transparent",
            cursor: "pointer",
            fontWeight: activeAdminTab === "teams" ? "bold" : "normal",
          }}
        >
          Teams
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeAdminTab === "teams" ? (
        <TeamManagement user={user} />
      ) : (
        <>
          {/* CHALLENGES TAB CONTENT (all existing challenge code) */}

          {/* CREATE NEW CHALLENGE BUTTON */}
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: "12px 20px",
              fontSize: "16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            {showCreateForm ? "Cancel" : "+ Create New Challenge"}
          </button>

          {/* CREATE FORM */}
          {showCreateForm && (
            <div
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <h2>Create New Challenge</h2>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "15px" }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Challenge Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Plank Challenge #3"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="e.g., Hold a plank position for increasing durations"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                      minHeight: "80px",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                    }}
                  >
                    <option value="plank">Plank (seconds)</option>
                    <option value="squat">Squat (reps)</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Number of Days
                  </label>
                  <input
                    type="number"
                    value={formData.numberOfDays}
                    onChange={(e) =>
                      setFormData({ ...formData, numberOfDays: e.target.value })
                    }
                    min="1"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Starting Value ({formData.type === "plank" ? "seconds" : "reps"}
                    )
                  </label>
                  <input
                    type="number"
                    value={formData.startingValue}
                    onChange={(e) =>
                      setFormData({ ...formData, startingValue: e.target.value })
                    }
                    min="1"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Increment Per Day
                  </label>
                  <input
                    type="number"
                    value={formData.incrementPerDay}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        incrementPerDay: e.target.value,
                      })
                    }
                    min="0"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "5px",
                      border: "1px solid #ddd",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                    />
                    <span style={{ fontWeight: "bold" }}>
                      Active (visible to users)
                    </span>
                  </label>
                </div>

                {/* NEW: Is Team Challenge toggle */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isTeamChallenge}
                      onChange={(e) =>
                        setFormData({ ...formData, isTeamChallenge: e.target.checked })
                      }
                    />
                    <span style={{ fontWeight: "bold" }}>
                      Team Challenge (requires team selection)
                    </span>
                  </label>
                  <p style={{ marginLeft: "34px", fontSize: "12px", color: "#666", marginTop: "4px" }}>
                    When enabled, users must select a team when joining this challenge.
                  </p>
                </div>

                <div>
                  <button
                    onClick={handleCreateChallenge}
                    style={{
                      padding: "12px",
                      fontSize: "16px",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Create Challenge
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EDIT FORM (full-screen modal) - ADD isTeamChallenge toggle here too */}
          {editingChallenge && (
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
                zIndex: 1000,
                padding: "20px",
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  padding: "30px",
                  borderRadius: "8px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  maxWidth: "600px",
                  width: "100%",
                }}
              >
                <h2>Edit Challenge</h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "15px",
                    marginTop: "10px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Challenge Name *
                    </label>
                    <input
                      type="text"
                      value={editingChallenge.name}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          name: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Description *
                    </label>
                    <textarea
                      value={editingChallenge.description}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          description: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                        minHeight: "80px",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Type
                    </label>
                    <select
                      value={editingChallenge.type}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          type: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                      }}
                    >
                      <option value="plank">Plank (seconds)</option>
                      <option value="squat">Squat (reps)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={editingChallenge.startDate}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          startDate: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Number of Days
                    </label>
                    <input
                      type="number"
                      value={editingChallenge.numberOfDays}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          numberOfDays: parseInt(e.target.value, 10),
                        })
                      }
                      min="1"
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Starting Value (
                      {editingChallenge.type === "plank" ? "seconds" : "reps"})
                    </label>
                    <input
                      type="number"
                      value={editingChallenge.startingValue}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          startingValue: parseInt(e.target.value, 10),
                        })
                      }
                      min="1"
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      Increment Per Day
                    </label>
                    <input
                      type="number"
                      value={editingChallenge.incrementPerDay}
                      onChange={(e) =>
                        setEditingChallenge({
                          ...editingChallenge,
                          incrementPerDay: parseInt(e.target.value, 10),
                        })
                      }
                      min="0"
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>

                  {/* NEW: Is Team Challenge toggle in edit form */}
                  <div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editingChallenge.isTeamChallenge || false}
                        onChange={(e) =>
                          setEditingChallenge({
                            ...editingChallenge,
                            isTeamChallenge: e.target.checked,
                          })
                        }
                      />
                      <span style={{ fontWeight: "bold" }}>
                        Team Challenge (requires team selection)
                      </span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    <button
                      onClick={handleSaveEdit}
                      style={{
                        flex: 1,
                        padding: "12px",
                        fontSize: "16px",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingChallenge(null)}
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
            </div>
          )}

          {/* CONFIRMATION MODAL */}
          {confirmAction && (
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
                <h2>
                  {confirmAction.type === "reset"
                    ? "Reset Challenge"
                    : "Confirm Action"}
                </h2>
                <p
                  style={{
                    fontSize: "16px",
                    marginBottom: "20px",
                    color: "#333",
                  }}
                >
                  {confirmAction.message}
                </p>

                {confirmAction.type === "reset" && (
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      Type RESET to confirm
                    </label>
                    <input
                      type="text"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="Type RESET"
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "5px",
                        border: "1px solid #ddd",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      if (confirmAction.type === "confirmEdit") {
                        confirmEdit();
                      } else if (confirmAction.type === "deactivate") {
                        confirmDeactivate(confirmAction.challengeId);
                      } else if (confirmAction.type === "delete") {
                        confirmDelete(confirmAction.challengeId);
                      } else if (confirmAction.type === "reset") {
                        confirmReset(confirmAction.challengeId);
                      }
                    }}
                    disabled={
                      confirmAction.type === "reset" && resetConfirmText !== "RESET"
                    }
                    style={{
                      flex: 1,
                      padding: "12px",
                      fontSize: "16px",
                      backgroundColor:
                        confirmAction.type === "delete" ||
                        confirmAction.type === "reset"
                          ? "#d32f2f"
                          : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "5px",
                      cursor:
                        confirmAction.type === "reset" &&
                        resetConfirmText !== "RESET"
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        confirmAction.type === "reset" &&
                        resetConfirmText !== "RESET"
                          ? 0.5
                          : 1,
                    }}
                  >
                    {confirmAction.type === "confirmEdit"
                      ? "Save Changes"
                      : confirmAction.type === "deactivate"
                      ? "Deactivate"
                      : confirmAction.type === "delete"
                      ? "Delete"
                      : "Confirm"}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmAction(null);
                      setResetConfirmText("");
                    }}
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

          {/* Rest of the challenges list rendering stays the same... */}
          {/* (keeping the active/inactive challenges display code unchanged) */}
          
          {/* CHALLENGES LIST */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p>Loading challenges...</p>
            </div>
          ) : challenges.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                backgroundColor: "white",
                borderRadius: "8px",
              }}
            >
              <p style={{ color: "#999" }}>
                No challenges yet. Create one to get started!
              </p>
            </div>
          ) : (
            <>
              {/* Display active and inactive challenges with Team Challenge badge */}
              <div>
                <h2 style={{ marginTop: "30px", marginBottom: "15px" }}>
                  Active Challenges
                </h2>
                {challenges.filter((c) => c.isActive).length === 0 ? (
                  <p style={{ color: "#999" }}>No active challenges</p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "15px",
                    }}
                  >
                    {challenges
                      .filter((c) => c.isActive)
                      .map((challenge) => (
                        <div
                          key={challenge.id}
                          style={{
                            backgroundColor: "white",
                            padding: "20px",
                            borderRadius: "8px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <div>
                              <h3 style={{ margin: "0 0 5px 0" }}>
                                {challenge.name}
                                {challenge.isTeamChallenge && (
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
                                    TEAM
                                  </span>
                                )}
                              </h3>
                              <span style={{ color: "#999", fontSize: "14px" }}>
                                {challenge.userCount} users
                              </span>
                            </div>
                          </div>
                          <p
                            style={{
                              margin: "5px 0",
                              color: "#666",
                              fontSize: "14px",
                            }}
                          >
                            {challenge.numberOfDays} days • Starts{" "}
                            {challenge.startDate?.toDate
                              ? challenge.startDate.toDate().toLocaleDateString()
                              : ""}
                          </p>
                          <p
                            style={{
                              margin: "5px 0",
                              color: "#666",
                              fontSize: "14px",
                            }}
                          >
                            {challenge.description}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "15px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => handleEditClick(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#2196F3",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeactivate(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#FF9800",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Deactivate
                            </button>
                            <button
                              onClick={() => handleReset(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#FF5722",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Reset Challenge
                            </button>
                            <button
                              onClick={() => handleDelete(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#d32f2f",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() =>
                                loadMissedDaysForChallenge(challenge.id)
                              }
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#6A1B9A",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              View Missed Days
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Inactive challenges section - similar pattern */}
              <div>
                <h2
                  style={{
                    marginTop: "40px",
                    marginBottom: "15px",
                    color: "#999",
                  }}
                >
                  Inactive Challenges
                </h2>
                {challenges.filter((c) => !c.isActive).length === 0 ? (
                  <p style={{ color: "#999" }}>No inactive challenges</p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "15px",
                    }}
                  >
                    {challenges
                      .filter((c) => !c.isActive)
                      .map((challenge) => (
                        <div
                          key={challenge.id}
                          style={{
                            backgroundColor: "#f0f0f0",
                            padding: "20px",
                            borderRadius: "8px",
                            opacity: 0.7,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <div>
                              <h3
                                style={{
                                  margin: "0 0 5px 0",
                                  color: "#666",
                                }}
                              >
                                {challenge.name}
                                {challenge.isTeamChallenge && (
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      fontSize: "12px",
                                      padding: "2px 8px",
                                      backgroundColor: "#999",
                                      color: "white",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    TEAM
                                  </span>
                                )}
                              </h3>
                              <span style={{ color: "#999", fontSize: "14px" }}>
                                {challenge.userCount} users
                              </span>
                            </div>
                          </div>
                          <p
                            style={{
                              margin: "5px 0",
                              color: "#999",
                              fontSize: "14px",
                            }}
                          >
                            INACTIVE
                          </p>
                          <p
                            style={{
                              margin: "5px 0",
                              color: "#999",
                              fontSize: "14px",
                            }}
                          >
                            {challenge.numberOfDays} days • Starts{" "}
                            {challenge.startDate?.toDate
                              ? challenge.startDate.toDate().toLocaleDateString()
                              : ""}
                          </p>
                          <p
                            style={{
                              margin: "5px 0",
                              color: "#999",
                              fontSize: "14px",
                            }}
                          >
                            {challenge.description}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "15px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => handleEditClick(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#2196F3",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeactivate(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#4CAF50",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => handleDelete(challenge)}
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#d32f2f",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() =>
                                loadMissedDaysForChallenge(challenge.id)
                              }
                              style={{
                                padding: "8px 12px",
                                fontSize: "14px",
                                backgroundColor: "#6A1B9A",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              View Missed Days
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* MISSED DAYS TABLE */}
          <div
            style={{
              marginTop: "40px",
              padding: "20px",
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h2>Missed Days (Selected Challenge)</h2>
            {missedLoading ? (
              <p>Loading missed days...</p>
            ) : Object.keys(missedByDay).length === 0 ? (
              <p style={{ color: "#999" }}>
                Click "View Missed Days" on a challenge above to see details.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "10px",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      Day
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      Users Who Missed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(missedByDay)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([day, users]) => (
                      <tr key={day}>
                        <td
                          style={{
                            padding: "8px",
                            borderBottom: "1px solid #eee",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Day {day}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {users
                            .map((u) => (u.displayName ? u.displayName : u.userId))
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
