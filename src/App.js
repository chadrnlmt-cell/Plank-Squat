// src/App.js
import React, { useState, useEffect } from "react";
import { auth, db, provider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import PlankTimer from "./components/PlankTimer";
import SquatLogger from "./components/SquatLogger";
import ChallengeCard from "./components/ChallengeCard";
import TabNavigation from "./components/TabNavigation";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import Profile from "./components/Profile";
import { getPhoenixDate, getChallengeDayFromStart } from "./utils";
import "./styles.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("available");
  const [challenges, setChallenges] = useState([]);
  const [userChallenges, setUserChallenges] = useState([]);
  const [activeChallengeData, setActiveChallengeData] = useState(null);

  // NEW: app-level profile name from Firestore users/<uid>
  const [profileName, setProfileName] = useState("");

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load profile name from users collection whenever user changes
  useEffect(() => {
    const loadProfileName = async () => {
      if (!user) {
        setProfileName("");
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setProfileName(data.displayName || "");
        } else {
          // no profile doc yet; default to auth displayName
          setProfileName(user.displayName || "");
        }
      } catch (err) {
        console.error("Error loading header profile name:", err);
        setProfileName(user.displayName || "");
      }
    };

    loadProfileName();
  }, [user]);

  // Load challenges when user logs in
  useEffect(() => {
    if (user) {
      loadChallenges();
      loadUserChallenges();
    }
  }, [user]);

  const loadChallenges = async () => {
    try {
      const q = query(
        collection(db, "challenges"),
        where("isActive", "==", true)
      );
      const snapshot = await getDocs(q);
      const all = snapshot.docs.map((snap) => ({
        id: snap.id,
        ...snap.data(),
      }));

      // Filter out challenges that have fully finished (global day > numberOfDays)
      const filtered = all.filter((ch) => {
        if (!ch.startDate || !ch.numberOfDays) return false;
        const globalDay = getChallengeDayFromStart(
          ch.startDate,
          ch.numberOfDays
        );
        if (globalDay === 0) return true; // not started yet, show
        return globalDay <= ch.numberOfDays; // hide if fully finished
      });

      setChallenges(filtered);
    } catch (error) {
      console.error("Error loading challenges:", error);
    }
  };

  // Sync helper (unchanged from your version)
  const syncUserChallengeWithCalendar = async (docSnap, challengeData) => {
    const userChallengeData = docSnap.data();

    if (
      !challengeData ||
      !challengeData.startDate ||
      !challengeData.numberOfDays
    ) {
      return {
        userChallengeId: docSnap.id,
        ...userChallengeData,
        challengeDetails: challengeData,
        missedDaysCount: userChallengeData.missedDaysCount || 0,
      };
    }

    const numberOfDays = challengeData.numberOfDays;
    const rawGlobalDay = getChallengeDayFromStart(
      challengeData.startDate,
      numberOfDays
    );

    if (rawGlobalDay === 0) {
      return {
        userChallengeId: docSnap.id,
        ...userChallengeData,
        challengeDetails: challengeData,
        missedDaysCount: userChallengeData.missedDaysCount || 0,
      };
    }

    const todayGlobalDay = Math.min(rawGlobalDay, numberOfDays);
    const prevLastCompleted = userChallengeData.lastCompletedDay || 0;
    let currentDay = userChallengeData.currentDay || 1;
    let status = userChallengeData.status || "active";
    let missedDaysCount = userChallengeData.missedDaysCount || 0;

    const skippedDays = [];

    for (let d = prevLastCompleted + 1; d < todayGlobalDay; d++) {
      if (d >= 1 && d <= numberOfDays) {
        skippedDays.push(d);
      }
    }

    if (rawGlobalDay > numberOfDays && status !== "completed") {
      for (
        let d = Math.max(todayGlobalDay, prevLastCompleted + 1);
        d <= numberOfDays;
        d++
      ) {
        if (!skippedDays.includes(d)) {
          skippedDays.push(d);
        }
      }
      status = "completed";
      currentDay = numberOfDays + 1;
    } else {
      currentDay = todayGlobalDay;
    }

    if (skippedDays.length > 0) {
      const attemptsRef = collection(db, "attempts");
      const nowTs = Timestamp.fromDate(getPhoenixDate());

      for (const d of skippedDays) {
        const existingMissedQuery = query(
          attemptsRef,
          where("userId", "==", userChallengeData.userId),
          where("challengeId", "==", userChallengeData.challengeId),
          where("day", "==", d),
          where("missed", "==", true)
        );
        const existingSnap = await getDocs(existingMissedQuery);

        if (!existingSnap.empty) {
          continue;
        }

        await addDoc(attemptsRef, {
          userId: userChallengeData.userId,
          displayName: userChallengeData.displayName || null,
          userChallengeId: docSnap.id,
          challengeId: userChallengeData.challengeId,
          day: d,
          targetValue: null,
          actualValue: 0,
          success: false,
          missed: true,
          timestamp: nowTs,
        });
        missedDaysCount += 1;
      }

      await updateDoc(doc(db, "userChallenges", docSnap.id), {
        currentDay,
        status,
        missedDaysCount,
      });
    } else {
      const updates = {};
      let needsUpdate = false;

      if (currentDay !== (userChallengeData.currentDay || 1)) {
        updates.currentDay = currentDay;
        needsUpdate = true;
      }
      if (status !== (userChallengeData.status || "active")) {
        updates.status = status;
        needsUpdate = true;
      }
      if (missedDaysCount !== (userChallengeData.missedDaysCount || 0)) {
        updates.missedDaysCount = missedDaysCount;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await updateDoc(doc(db, "userChallenges", docSnap.id), updates);
      }
    }

    return {
      userChallengeId: docSnap.id,
      ...userChallengeData,
      currentDay,
      status,
      challengeDetails: challengeData,
      missedDaysCount,
    };
  };

  const loadUserChallenges = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "userChallenges"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const results = [];

      for (const docSnap of snapshot.docs) {
        const userChallengeData = docSnap.data();

        const challengeQuery = await getDocs(
          query(
            collection(db, "challenges"),
            where("__name__", "==", userChallengeData.challengeId)
          )
        );

        if (challengeQuery.empty) {
          continue;
        }

        const challengeData = challengeQuery.docs[0].data();

        const updated = await syncUserChallengeWithCalendar(
          docSnap,
          challengeData
        );
        results.push(updated);
      }

      setUserChallenges(results);
    } catch (error) {
      console.error("Error loading user challenges:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setChallenges([]);
      setUserChallenges([]);
      setActiveTab("available");
      setProfileName("");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleJoinChallenge = async (challenge, teamId = null) => {
    try {
      if (!challenge.startDate || !challenge.numberOfDays) {
        alert("Challenge is not configured correctly.");
        return;
      }

      const globalDay = getChallengeDayFromStart(
        challenge.startDate,
        challenge.numberOfDays
      );

      if (globalDay === 0) {
        alert(
          "This challenge hasn't started yet. You can join on the start date."
        );
        return;
      }

      if (globalDay > challenge.numberOfDays) {
        alert(
          "This challenge has already finished and can no longer be joined."
        );
        return;
      }

      const startDay = globalDay;

      await addDoc(collection(db, "userChallenges"), {
        userId: user.uid,
        displayName: profileName || user.displayName || null,
        challengeId: challenge.id,
        teamId: teamId || null,
        joinedAt: Timestamp.now(),
        currentDay: startDay,
        lastCompletedDay: 0,
        lastCompletedDate: null,
        status: "active",
        missedDaysCount: 0,
      });

      await loadUserChallenges();
      setActiveTab("active");
    } catch (error) {
      console.error("Error joining challenge:", error);
      alert("Error joining challenge");
    }
  };

  const handleStartChallenge = (userChallenge) => {
    if (userChallenge.lastCompletedDate) {
      const lastCompleted = userChallenge.lastCompletedDate.toDate();
      const today = getPhoenixDate();

      lastCompleted.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (lastCompleted.getTime() === today.getTime()) {
        alert(
          "You've already completed today's challenge! Come back tomorrow at midnight MST."
        );
        return;
      }
    }

    setActiveChallengeData(userChallenge);
  };

  const handleChallengeComplete = async () => {
    setActiveChallengeData(null);
    await loadUserChallenges();
  };

  const handleChallengeCancel = () => {
    setActiveChallengeData(null);
  };

  // Show active challenge screen (PlankTimer or SquatLogger)
  if (activeChallengeData) {
    const { challengeDetails, currentDay, userChallengeId, challengeId } =
      activeChallengeData;

    if (challengeDetails.type === "plank") {
      const targetSeconds =
        challengeDetails.startingValue +
        (currentDay - 1) * challengeDetails.incrementPerDay;

      return (
        <PlankTimer
          targetSeconds={targetSeconds}
          day={currentDay}
          userChallengeId={userChallengeId}
          challengeId={challengeId}
          userId={user.uid}
          user={user}
          displayName={profileName || user.displayName || ""} // important
          numberOfDays={challengeDetails.numberOfDays}
          onComplete={handleChallengeComplete}
          onCancel={handleChallengeCancel}
        />
      );
    } else if (challengeDetails.type === "squat") {
      const targetReps =
        challengeDetails.startingValue +
        (currentDay - 1) * challengeDetails.incrementPerDay;

      return (
        <SquatLogger
          targetReps={targetReps}
          day={currentDay}
          userChallengeId={userChallengeId}
          challengeId={challengeId}
          userId={user.uid}
          user={user}
          numberOfDays={challengeDetails.numberOfDays}
          onComplete={handleChallengeComplete}
          onCancel={handleChallengeCancel}
        />
      );
    }
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "20px",
        }}
      >
        <h1>Plank & Squat Challenge</h1>
        <p style={{ marginBottom: "20px", color: "#666" }}>
          Sign in to join challenges and track your progress
        </p>
        <button
          onClick={handleGoogleSignIn}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  // Helper function to check if challenge can be started today
  const canStartToday = (userChallenge) => {
    if (!userChallenge.lastCompletedDate) return true;

    const lastCompleted = userChallenge.lastCompletedDate.toDate();
    const today = getPhoenixDate();

    lastCompleted.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return lastCompleted.getTime() !== today.getTime();
  };

  // Main App (Logged In)
  return (
    <div style={{ paddingBottom: "80px" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#f8f8f8",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px" }}>
            Plank & Squat Challenge
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "#666" }}>
            {profileName || user.displayName}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            backgroundColor: "#d32f2f",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ padding: "20px" }}>
        {/* TAB 1: Available Challenges */}
        {activeTab === "available" && (
          <div>
            <h2>Available Challenges</h2>
            {challenges.length === 0 ? (
              <p style={{ color: "#999" }}>
                No challenges available at this time.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                {challenges.map((challenge) => {
                  const alreadyJoined = userChallenges.some(
                    (uc) => uc.challengeId === challenge.id
                  );

                  return (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      onJoin={handleJoinChallenge}
                      alreadyJoined={alreadyJoined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Active Challenges */}
        {activeTab === "active" && (
          <div>
            <h2>My Active Challenges</h2>
            {userChallenges.filter((uc) => uc.status === "active").length ===
            0 ? (
              <p style={{ color: "#999" }}>
                You haven't joined any challenges yet. Check the Available tab!
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                {userChallenges
                  .filter((uc) => uc.status === "active")
                  .map((userChallenge) => {
                    const canStart = canStartToday(userChallenge);
                    const missedCount = userChallenge.missedDaysCount || 0;

                    return (
                      <div
                        key={userChallenge.userChallengeId}
                        style={{
                          backgroundColor: "white",
                          padding: "20px",
                          borderRadius: "8px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                      >
                        <h3 style={{ margin: "0 0 10px 0" }}>
                          {userChallenge.challengeDetails.name}
                        </h3>
                        <p style={{ margin: "5px 0", color: "#666" }}>
                          Day {userChallenge.currentDay} of{" "}
                          {userChallenge.challengeDetails.numberOfDays}
                        </p>
                        <p style={{ margin: "5px 0", color: "#666" }}>
                          {userChallenge.challengeDetails.description}
                        </p>
                        <p style={{ margin: "5px 0", color: "#666" }}>
                          Missed days: {missedCount}
                        </p>

                        {canStart ? (
                          <button
                            onClick={() => handleStartChallenge(userChallenge)}
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
                            Start Day {userChallenge.currentDay}
                          </button>
                        ) : (
                          <div
                            style={{
                              marginTop: "15px",
                              padding: "10px 20px",
                              fontSize: "16px",
                              backgroundColor: "#f0f0f0",
                              color: "#666",
                              border: "1px solid #ddd",
                              borderRadius: "5px",
                              textAlign: "center",
                            }}
                          >
                            ✓ Completed Today! Come back tomorrow at midnight
                            MST
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Leaderboards */}
        {activeTab === "leaderboards" && (
          <Leaderboard user={user} challenges={challenges} />
        )}

        {/* TAB 4: Profile */}
        {activeTab === "profile" && <Profile user={user} />}

        {/* TAB 5: Admin Panel */}
        {activeTab === "admin" && user && <AdminPanel user={user} />}
      </div>

      {/* Bottom Navigation */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
      />
    </div>
  );
}
