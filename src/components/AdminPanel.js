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
import { getPhoenixDate } from "../utils";
import TeamManagement from "./TeamManagement";
import CompletedChallenges from "./CompletedChallenges";
import AdminPracticeReport from "./AdminPracticeReport";
import {
  finalizeAllStreaksOnChallengeEnd,
  clearChallengeBadgesOnReset,
} from "../badgeHelpers";

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

  const ADMIN_EMAIL = "chadrnlmt@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const defaultFormState = {
    name: "",
    description: "",
    type: "plank",
    startDate: "",
    numberOfDays: 30,
    startingValue: 60,
    incrementPerDay: 5,
    isActive: true,
    isTeamChallenge: false,
    rankingMetric: "average", // "average" | "total" — default: average
  };

  const [formData, setFormData] = useState(defaultFormState);

  function dateFromYMD(ymd) {
    if (!ymd) return null;
    const [year, month, day] = ymd.split("-").map((v) => parseInt(v, 10));
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

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
        isTeamChallenge: formData.isTeamChallenge,
        rankingMetric: formData.isTeamChallenge ? formData.rankingMetric : null,
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
        isTeamChallenge: editingChallenge.isTeamChallenge || false,
        rankingMetric: editingChallenge.isTeamChallenge
          ? (editingChallenge.rankingMetric || "average")
          : null,
      });

      setEditingChallenge(null);
      setConfirmAction(null);
      loadChallenges();
    } catch (error) {
      console.error("Error saving challenge:", error);
      alert("Error saving challenge");
    }
  };

  const archiveLeaderboardBeforeDeactivate = async (challenge) => {
    try {
      const statsQuery = query(
        collection(db, "challengeUserStats"),
        where("challengeId", "==", challenge.id)
      );
      const statsSnapshot = await getDocs(statsQuery);

      if (statsSnapshot.empty) {
        console.log("No participants, skipping archive");
        return true;
      }

      const existingArchiveQuery = query(
        collection(db, "leaderboardHistory"),
        where("challengeId", "==", challenge.id)
      );
      const existingArchiveSnapshot = await getDocs(existingArchiveQuery);

      if (!existingArchiveSnapshot.empty) {
        console.log("Already archived, skipping duplicate");
        return true;
      }

      const teamsQuery = query(collection(db, "teams"));
      const teamsSnapshot = await getDocs(teamsQuery);
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const entries = statsSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          userId: data.userId || null,
          displayName: data.displayName || "Anonymous",
          photoURL: data.photoURL || null,
          totalSeconds: data.totalSeconds || 0,
          totalReps: data.totalReps || 0,
          bestSeconds: data.bestSeconds || 0,
          bestReps: data.bestReps || 0,
          firstAchievedAt: data.firstAchievedAt || null,
          teamId: data.teamId || null,
        };
      });

      const isPlank = challenge.type === "plank";
      const rankingMetric = challenge.rankingMetric || "average";

      const compareTotals = (a, b) => {
        const aVal = isPlank ? a.totalSeconds : a.totalReps;
        const bVal = isPlank ? b.totalSeconds : b.totalReps;
        if (bVal !== aVal) return bVal - aVal;
        const aTime = a.firstAchievedAt?.toMillis ? a.firstAchievedAt.toMillis() : null;
        const bTime = b.firstAchievedAt?.toMillis ? b.firstAchievedAt.toMillis() : null;
        if (aTime && bTime && aTime !== bTime) return aTime - bTime;
        return (a.displayName || "").toLowerCase() < (b.displayName || "").toLowerCase() ? -1 : 1;
      };

      const compareBests = (a, b) => {
        const aVal = isPlank ? a.bestSeconds : a.bestReps;
        const bVal = isPlank ? b.bestSeconds : b.bestReps;
        if (bVal !== aVal) return bVal - aVal;
        const aTime = a.firstAchievedAt?.toMillis ? a.firstAchievedAt.toMillis() : null;
        const bTime = b.firstAchievedAt?.toMillis ? b.firstAchievedAt.toMillis() : null;
        if (aTime && bTime && aTime !== bTime) return aTime - bTime;
        return (a.displayName || "").toLowerCase() < (b.displayName || "").toLowerCase() ? -1 : 1;
      };

      const topTotal = [...entries].sort(compareTotals).slice(0, 10);
      const topBest = [...entries].sort(compareBests).slice(0, 5);

      let teamStandings = [];
      if (challenge.isTeamChallenge) {
        const teamTotals = {};
        entries.forEach(row => {
          if (row.teamId) {
            if (!teamTotals[row.teamId]) {
              teamTotals[row.teamId] = { teamId: row.teamId, totalSeconds: 0, totalReps: 0, memberCount: 0 };
            }
            teamTotals[row.teamId].totalSeconds += row.totalSeconds || 0;
            teamTotals[row.teamId].totalReps += row.totalReps || 0;
            teamTotals[row.teamId].memberCount += 1;
          }
        });

        teamStandings = Object.values(teamTotals).map(t => {
          const team = teams.find(tm => tm.id === t.teamId);
          return {
            ...t,
            teamName: team?.name || "Unknown Team",
            teamColor: team?.color || "#999",
            avgSeconds: t.memberCount > 0 ? Math.round(t.totalSeconds / t.memberCount) : 0,
            avgReps: t.memberCount > 0 ? Math.round(t.totalReps / t.memberCount) : 0,
          };
        });

        // Sort teamStandings by the challenge's rankingMetric before archiving
        teamStandings.sort((a, b) => {
          if (rankingMetric === "average") {
            return isPlank ? b.avgSeconds - a.avgSeconds : b.avgReps - a.avgReps;
          } else {
            return isPlank ? b.totalSeconds - a.totalSeconds : b.totalReps - a.totalReps;
          }
        });
      }

      const startDate = challenge.startDate?.toDate ? challenge.startDate.toDate() : new Date(challenge.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + challenge.numberOfDays - 1);

      await addDoc(collection(db, "leaderboardHistory"), {
        challengeId: challenge.id,
        challengeName: challenge.name,
        challengeType: challenge.type,
        challengeDescription: challenge.description,
        isTeamChallenge: challenge.isTeamChallenge || false,
        rankingMetric: rankingMetric,
        startDate: challenge.startDate,
        endDate: Timestamp.fromDate(endDate),
        numberOfDays: challenge.numberOfDays,
        archivedAt: Timestamp.now(),
        archivedBy: user.email,
        topTotal,
        topBest,
        teamStandings,
      });

      return true;
    } catch (error) {
      console.error("Error archiving leaderboard:", error);
      alert("Error archiving leaderboard. Deactivation cancelled.");
      return false;
    }
  };

  // Batch-disable all challengeReminders for a given challengeId
  const disableAllRemindersForChallenge = async (challengeId) => {
    try {
      const remindersQuery = query(
        collection(db, "challengeReminders"),
        where("challengeId", "==", challengeId)
      );
      const remindersSnap = await getDocs(remindersQuery);
      if (remindersSnap.empty) return;
      const reminderBatch = writeBatch(db);
      remindersSnap.forEach((docSnap) => {
        reminderBatch.update(docSnap.ref, { enabled: false });
      });
      await reminderBatch.commit();
      console.log(`Disabled ${remindersSnap.size} reminder(s) for challenge ${challengeId}`);
    } catch (error) {
      // Non-blocking — log but don't halt deactivation
      console.error("Error disabling reminders:", error);
    }
  };

  const handleDeactivate = (challenge) => {
    setConfirmAction({
      type: "deactivate",
      challengeId: challenge.id,
      challenge: challenge,
      message: `Deactivate ${challenge.name}? This will archive the leaderboard and hide the challenge from users. Are you sure?`,
    });
  };

  const confirmDeactivate = async (challengeId, challenge) => {
    try {
      if (challenge.isActive) {
        // Finalize streak/time badges for all users before archiving
        await finalizeAllStreaksOnChallengeEnd(challengeId);
        const archiveSuccess = await archiveLeaderboardBeforeDeactivate(challenge);
        if (!archiveSuccess) return;
        // Silently disable all reminders for this challenge
        await disableAllRemindersForChallenge(challengeId);
      }

      await updateDoc(doc(db, "challenges", challengeId), {
        isActive: !challenge.isActive,
      });

      setConfirmAction(null);
      loadChallenges();
    } catch (error) {
      console.error("Error updating challenge status:", error);
      alert("Error updating challenge");
    }
  };

  const handleForceEnd = (challenge) => {
    setConfirmAction({
      type: "forceEnd",
      challengeId: challenge.id,
      challenge: challenge,
      message: `Force end ${challenge.name}? This will immediately complete the challenge for all ${challenge.userCount} users, mark remaining days as missed, set status to completed, and deactivate the challenge. This cannot be undone!`,
    });
    setResetConfirmText("");
  };

  const confirmForceEnd = async (challengeId, challenge) => {
    if (resetConfirmText !== "END") {
      alert('Please type "END" to confirm');
      return;
    }

    try {
      const userChallengesQuery = query(
        collection(db, "userChallenges"),
        where("challengeId", "==", challengeId)
      );
      const userChallengesSnapshot = await getDocs(userChallengesQuery);

      const nowTs = Timestamp.fromDate(getPhoenixDate());
      const numberOfDays = challenge.numberOfDays;

      for (const docSnap of userChallengesSnapshot.docs) {
        const userChallengeData = docSnap.data();
        const lastCompletedDay = userChallengeData.lastCompletedDay || 0;
        const userId = userChallengeData.userId;
        const displayName = userChallengeData.displayName || null;

        const attemptsRef = collection(db, "attempts");
        for (let d = lastCompletedDay + 1; d <= numberOfDays; d++) {
          const existingMissedQuery = query(
            attemptsRef,
            where("userId", "==", userId),
            where("challengeId", "==", challengeId),
            where("day", "==", d),
            where("missed", "==", true)
          );
          const existingSnap = await getDocs(existingMissedQuery);

          if (existingSnap.empty) {
            await addDoc(attemptsRef, {
              userId,
              displayName,
              userChallengeId: docSnap.id,
              challengeId,
              day: d,
              targetValue: null,
              actualValue: 0,
              success: false,
              missed: true,
              timestamp: nowTs,
            });
          }
        }

        const missedCount = numberOfDays - lastCompletedDay;

        await updateDoc(doc(db, "userChallenges", docSnap.id), {
          status: "completed",
          currentDay: numberOfDays + 1,
          missedDaysCount: (userChallengeData.missedDaysCount || 0) + missedCount,
        });
      }

      // Finalize badges before archiving
      await finalizeAllStreaksOnChallengeEnd(challengeId);
      await archiveLeaderboardBeforeDeactivate(challenge);
      // Silently disable all reminders for this challenge
      await disableAllRemindersForChallenge(challengeId);

      await updateDoc(doc(db, "challenges", challengeId), {
        isActive: false,
      });

      setConfirmAction(null);
      setResetConfirmText("");
      loadChallenges();
      alert(`Challenge "${challenge.name}" has been force-ended successfully.`);
    } catch (error) {
      console.error("Error force-ending challenge:", error);
      alert("Error force-ending challenge");
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
      await deleteDoc(doc(db, "challenges", challengeId));

      const userChallengesQuery = query(
        collection(db, "userChallenges"),
        where("challengeId", "==", challengeId)
      );
      const userChallengesSnapshot = await getDocs(userChallengesQuery);
      const batch = writeBatch(db);
      userChallengesSnapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();

      const attemptsQuery = query(
        collection(db, "attempts"),
        where("challengeId", "==", challengeId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const batch2 = writeBatch(db);
      attemptsSnapshot.forEach((docSnap) => batch2.delete(docSnap.ref));
      await batch2.commit();

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
      // Clear all badge data for this challenge (including legacy badges sourced from it)
      await clearChallengeBadgesOnReset(challengeId);

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
          joinedAt: null,
        });
      });
      await batch.commit();

      const attemptsQuery = query(
        collection(db, "attempts"),
        where("challengeId", "==", challengeId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const batch2 = writeBatch(db);
      attemptsSnapshot.forEach((docSnap) => batch2.delete(docSnap.ref));
      await batch2.commit();

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
        formattedDate = challenge.startDate.toDate().toISOString().split("T")[0];
      } else if (challenge.startDate) {
        formattedDate = new Date(challenge.startDate).toISOString().split("T")[0];
      } else {
        formattedDate = new Date().toISOString().split("T")[0];
      }
    } catch (e) {
      formattedDate = new Date().toISOString().split("T")[0];
    }

    setEditingChallenge({
      id: challenge.id,
      ...challenge,
      startDate: formattedDate,
      isTeamChallenge: challenge.isTeamChallenge || false,
      rankingMetric: challenge.rankingMetric || "average",
    });
  };

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

  if (!isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px", backgroundColor: "#f5f5f5" }}>
        <h1 style={{ color: "#d32f2f", marginBottom: "10px" }}>Access Denied</h1>
        <p style={{ color: "#666", fontSize: "16px" }}>This area is restricted to administrators only.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", paddingBottom: "100px", backgroundColor: "#f5f5f5" }}>
      <h1>Admin Panel</h1>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #ddd", flexWrap: "wrap" }}>
        {["challenges", "teams", "completed", "practice"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveAdminTab(tab)}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: activeAdminTab === tab ? "#4CAF50" : "transparent",
              color: activeAdminTab === tab ? "white" : "#666",
              border: "none",
              borderBottom: activeAdminTab === tab ? "3px solid #4CAF50" : "3px solid transparent",
              cursor: "pointer",
              fontWeight: activeAdminTab === tab ? "bold" : "normal",
            }}
          >
            {tab === "challenges"
              ? "Challenges"
              : tab === "teams"
              ? "Teams"
              : tab === "completed"
              ? "Completed Challenges"
              : "Practice"}
          </button>
        ))}
      </div>

      {activeAdminTab === "teams" ? (
        <TeamManagement user={user} />
      ) : activeAdminTab === "completed" ? (
        <CompletedChallenges user={user} />
      ) : activeAdminTab === "practice" ? (
        <AdminPracticeReport />
      ) : (
        <>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{ padding: "12px 20px", fontSize: "16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", marginBottom: "20px" }}
          >
            {showCreateForm ? "Cancel" : "+ Create New Challenge"}
          </button>

          {showCreateForm && (
            <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
              <h2>Create New Challenge</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {/* Name */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Challenge Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Plank Challenge #3" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                </div>
                {/* Description */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Description *</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="e.g., Hold a plank position for increasing durations" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd", minHeight: "80px" }} />
                </div>
                {/* Type */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Type</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }}>
                    <option value="plank">Plank (seconds)</option>
                    <option value="squat">Squat (reps)</option>
                  </select>
                </div>
                {/* Start Date */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Start Date *</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                </div>
                {/* Number of Days */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Number of Days</label>
                  <input type="number" value={formData.numberOfDays} onChange={(e) => setFormData({ ...formData, numberOfDays: e.target.value })} min="1" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                </div>
                {/* Starting Value */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Starting Value ({formData.type === "plank" ? "seconds" : "reps"})</label>
                  <input type="number" value={formData.startingValue} onChange={(e) => setFormData({ ...formData, startingValue: e.target.value })} min="1" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                </div>
                {/* Increment */}
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Increment Per Day</label>
                  <input type="number" value={formData.incrementPerDay} onChange={(e) => setFormData({ ...formData, incrementPerDay: e.target.value })} min="0" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                </div>
                {/* Active */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                    <span style={{ fontWeight: "bold" }}>Active (visible to users)</span>
                  </label>
                </div>
                {/* Team Challenge */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="checkbox" checked={formData.isTeamChallenge} onChange={(e) => setFormData({ ...formData, isTeamChallenge: e.target.checked })} />
                    <span style={{ fontWeight: "bold" }}>Team Challenge (requires team selection)</span>
                  </label>
                  <p style={{ marginLeft: "34px", fontSize: "12px", color: "#666", marginTop: "4px" }}>When enabled, users must select a team when joining this challenge.</p>
                </div>
                {/* Ranking Metric — only shown for team challenges */}
                {formData.isTeamChallenge && (
                  <div style={{ marginLeft: "0", padding: "12px", backgroundColor: "#f0f7f0", borderRadius: "6px", border: "1px solid #c8e6c9" }}>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Team Ranking Metric</label>
                    <p style={{ fontSize: "12px", color: "#555", marginBottom: "8px", marginTop: 0 }}>How teams will be ranked on the leaderboard.</p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="createRankingMetric"
                          value="average"
                          checked={formData.rankingMetric === "average"}
                          onChange={() => setFormData({ ...formData, rankingMetric: "average" })}
                        />
                        <span>Average per member <span style={{ fontSize: "11px", color: "#4CAF50", fontWeight: "bold" }}>(recommended)</span></span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="createRankingMetric"
                          value="total"
                          checked={formData.rankingMetric === "total"}
                          onChange={() => setFormData({ ...formData, rankingMetric: "total" })}
                        />
                        <span>Total (all members combined)</span>
                      </label>
                    </div>
                  </div>
                )}
                <div>
                  <button onClick={handleCreateChallenge} style={{ padding: "12px", fontSize: "16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Create Challenge</button>
                </div>
              </div>
            </div>
          )}

          {editingChallenge && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
              <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "8px", maxHeight: "90vh", overflowY: "auto", maxWidth: "600px", width: "100%" }}>
                <h2>Edit Challenge</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Challenge Name *</label>
                    <input type="text" value={editingChallenge.name} onChange={(e) => setEditingChallenge({ ...editingChallenge, name: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Description *</label>
                    <textarea value={editingChallenge.description} onChange={(e) => setEditingChallenge({ ...editingChallenge, description: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd", minHeight: "80px" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Type</label>
                    <select value={editingChallenge.type} onChange={(e) => setEditingChallenge({ ...editingChallenge, type: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }}>
                      <option value="plank">Plank (seconds)</option>
                      <option value="squat">Squat (reps)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Start Date *</label>
                    <input type="date" value={editingChallenge.startDate} onChange={(e) => setEditingChallenge({ ...editingChallenge, startDate: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Number of Days</label>
                    <input type="number" value={editingChallenge.numberOfDays} onChange={(e) => setEditingChallenge({ ...editingChallenge, numberOfDays: parseInt(e.target.value, 10) })} min="1" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Starting Value ({editingChallenge.type === "plank" ? "seconds" : "reps"})</label>
                    <input type="number" value={editingChallenge.startingValue} onChange={(e) => setEditingChallenge({ ...editingChallenge, startingValue: parseInt(e.target.value, 10) })} min="1" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: "bold", marginBottom: "5px" }}>Increment Per Day</label>
                    <input type="number" value={editingChallenge.incrementPerDay} onChange={(e) => setEditingChallenge({ ...editingChallenge, incrementPerDay: parseInt(e.target.value, 10) })} min="0" style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }} />
                  </div>
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input type="checkbox" checked={editingChallenge.isTeamChallenge || false} onChange={(e) => setEditingChallenge({ ...editingChallenge, isTeamChallenge: e.target.checked })} />
                      <span style={{ fontWeight: "bold" }}>Team Challenge (requires team selection)</span>
                    </label>
                  </div>
                  {/* Ranking Metric — only shown for team challenges in edit mode */}
                  {editingChallenge.isTeamChallenge && (
                    <div style={{ padding: "12px", backgroundColor: "#f0f7f0", borderRadius: "6px", border: "1px solid #c8e6c9" }}>
                      <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Team Ranking Metric</label>
                      <p style={{ fontSize: "12px", color: "#555", marginBottom: "8px", marginTop: 0 }}>How teams will be ranked on the leaderboard.</p>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="editRankingMetric"
                            value="average"
                            checked={(editingChallenge.rankingMetric || "average") === "average"}
                            onChange={() => setEditingChallenge({ ...editingChallenge, rankingMetric: "average" })}
                          />
                          <span>Average per member <span style={{ fontSize: "11px", color: "#4CAF50", fontWeight: "bold" }}>(recommended)</span></span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="editRankingMetric"
                            value="total"
                            checked={(editingChallenge.rankingMetric || "average") === "total"}
                            onChange={() => setEditingChallenge({ ...editingChallenge, rankingMetric: "total" })}
                          />
                          <span>Total (all members combined)</span>
                        </label>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button onClick={handleSaveEdit} style={{ flex: 1, padding: "12px", fontSize: "16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Save Changes</button>
                    <button onClick={() => setEditingChallenge(null)} style={{ flex: 1, padding: "12px", fontSize: "16px", backgroundColor: "#999", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {confirmAction && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" }}>
              <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "8px", maxWidth: "500px", width: "100%" }}>
                <h2>
                  {confirmAction.type === "reset" ? "Reset Challenge" : confirmAction.type === "forceEnd" ? "Force End Challenge" : "Confirm Action"}
                </h2>
                <p style={{ fontSize: "16px", marginBottom: "20px", color: "#333" }}>{confirmAction.message}</p>

                {(confirmAction.type === "reset" || confirmAction.type === "forceEnd") && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                      Type "{confirmAction.type === "reset" ? "RESET" : "END"}" to confirm:
                    </label>
                    <input
                      type="text"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder={confirmAction.type === "reset" ? "RESET" : "END"}
                      style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd" }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      if (confirmAction.type === "deactivate") confirmDeactivate(confirmAction.challengeId, confirmAction.challenge);
                      else if (confirmAction.type === "delete") confirmDelete(confirmAction.challengeId);
                      else if (confirmAction.type === "reset") confirmReset(confirmAction.challengeId);
                      else if (confirmAction.type === "forceEnd") confirmForceEnd(confirmAction.challengeId, confirmAction.challenge);
                      else if (confirmAction.type === "confirmEdit") confirmEdit();
                    }}
                    style={{ flex: 1, padding: "12px", fontSize: "16px", backgroundColor: confirmAction.type === "delete" || confirmAction.type === "forceEnd" ? "#d32f2f" : "#4CAF50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => { setConfirmAction(null); setResetConfirmText(""); }}
                    style={{ flex: 1, padding: "12px", fontSize: "16px", backgroundColor: "#999", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <p>Loading challenges...</p>
          ) : challenges.length === 0 ? (
            <p style={{ color: "#999" }}>No challenges yet. Create one above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  style={{
                    backgroundColor: "white",
                    padding: "20px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    borderLeft: `4px solid ${challenge.isActive ? "#4CAF50" : "#999"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0 }}>{challenge.name}</h3>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "3px", backgroundColor: challenge.isActive ? "#e8f5e9" : "#f5f5f5", color: challenge.isActive ? "#2e7d32" : "#999", fontWeight: "bold" }}>
                          {challenge.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                        {challenge.isTeamChallenge && (
                          <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "3px", backgroundColor: "#e3f2fd", color: "#1565c0", fontWeight: "bold" }}>
                            TEAM
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "4px 0 8px", color: "#666", fontSize: "14px" }}>{challenge.description}</p>
                      <div style={{ fontSize: "13px", color: "#555", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <span>Type: {challenge.type}</span>
                        <span>Days: {challenge.numberOfDays}</span>
                        <span>Start: {challenge.startingValue}{challenge.type === "plank" ? "s" : " reps"}</span>
                        <span>+{challenge.incrementPerDay}/day</span>
                        <span>👥 {challenge.userCount} enrolled</span>
                        {challenge.isTeamChallenge && challenge.rankingMetric && (
                          <span style={{ color: "#4CAF50" }}>Ranked by: {challenge.rankingMetric === "average" ? "avg/member" : "total"}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button onClick={() => handleEditClick(challenge)} style={{ padding: "8px 16px", fontSize: "14px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDeactivate(challenge)} style={{ padding: "8px 16px", fontSize: "14px", backgroundColor: challenge.isActive ? "#FF9800" : "#4CAF50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
                        {challenge.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => handleReset(challenge)} style={{ padding: "8px 16px", fontSize: "14px", backgroundColor: "#9C27B0", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Reset</button>
                      <button onClick={() => handleForceEnd(challenge)} disabled={!challenge.isActive} style={{ padding: "8px 16px", fontSize: "14px", backgroundColor: challenge.isActive ? "#F44336" : "#ccc", color: "white", border: "none", borderRadius: "5px", cursor: challenge.isActive ? "pointer" : "not-allowed" }}>Force End</button>
                      <button onClick={() => handleDelete(challenge)} style={{ padding: "8px 16px", fontSize: "14px", backgroundColor: "#d32f2f", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>

                  {/* Missed Days Section */}
                  {challenge.isActive && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
                      <button
                        onClick={() => loadMissedDaysForChallenge(challenge.id)}
                        style={{ padding: "6px 14px", fontSize: "13px", backgroundColor: "#607D8B", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        {missedLoading ? "Loading..." : "View Missed Days"}
                      </button>

                      {Object.keys(missedByDay).length > 0 && (
                        <div style={{ marginTop: "10px" }}>
                          <strong>Missed Days:</strong>
                          {Object.keys(missedByDay)
                            .sort((a, b) => Number(a) - Number(b))
                            .map((day) => (
                              <div key={day} style={{ marginTop: "6px", fontSize: "13px" }}>
                                <span style={{ fontWeight: "bold" }}>Day {day}:</span>{" "}
                                {missedByDay[day].map((u) => u.displayName).join(", ")}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
