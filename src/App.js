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
import ChallengeEndedCard from "./components/ChallengeEndedCard";
import TabNavigation from "./components/TabNavigation";
import AdminPanel from "./components/AdminPanel";
import Leaderboard from "./components/Leaderboard";
import Profile from "./components/Profile";
import Banner from "./components/Banner";
import BadgeDisplay from "./components/BadgeDisplay";
import ChallengeGuide from "./components/ChallengeGuide";
import { getChallengeBadges } from "./badgeHelpers";
import {
  getPhoenixDate,
  getChallengeDayFromStart,
  formatDateShort,
  isChallengeEnded,
} from "./utils";
import "./styles.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("available");
  const [challenges, setChallenges] = useState([]);
  const [userChallenges, setUserChallenges] = useState([]);
  const [activeChallengeData, setActiveChallengeData] = useState(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [showRedoMessage, setShowRedoMessage] = useState(false);
  const [banner, setBanner] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [challengeBadges, setChallengeBadges] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
          setProfileName(user.displayName || "");
        }
      } catch (err) {
        console.error("Error loading header profile name:", err);
        setProfileName(user.displayName || "");
      }
    };

    loadProfileName();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadChallenges();
      loadUserChallenges();
    }
  }, [user]);

  useEffect(() => {
    const loadBadges = async () => {
      if (!user || activeTab !== "active") return;

      const badgeData = {};
      for (const uc of userChallenges) {
        if (uc.status === "active") {
          const badges = await getChallengeBadges(user.uid, uc.challengeId);
          if (badges) {
            badgeData[uc.challengeId] = badges;
          }
        }
      }
      setChallengeBadges(badgeData);
    };

    loadBadges();
  }, [user, userChallenges, activeTab]);

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

      const filtered = all.filter((ch) => {
        if (!ch.startDate || !ch.numberOfDays) return false;
        return !isChallengeEnded(ch.startDate, ch.numberOfDays);
      });

      setChallenges(filtered);
    } catch (error) {
      console.error("Error loading challenges:", error);
    }
  };

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

    const challengeHasEnded = isChallengeEnded(
      challengeData.startDate,
      numberOfDays
    );

    if (
      (rawGlobalDay > numberOfDays || challengeHasEnded) &&
      status !== "completed"
    ) {
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
      setAttemptNumber(1);
      setShowRedoMessage(false);
      setBanner(null);
      setChallengeBadges({});
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleJoinChallenge = async (challenge, teamId = null) => {
    try {
      const alreadyJoined = userChallenges.some(
        (uc) => uc.challengeId === challenge.id
      );

      if (alreadyJoined) {
        setBanner({
          message: "You're already in this challenge - check the Active tab!",
          type: "info",
        });
        return;
      }

      if (!challenge.startDate || !challenge.numberOfDays) {
        setBanner({
          message: "Challenge is not configured correctly.",
          type: "warning",
        });
        return;
      }

      if (isChallengeEnded(challenge.startDate, challenge.numberOfDays)) {
        setBanner({
          message:
            "This challenge has ended - check back for new challenges!",
          type: "info",
        });
        return;
      }

      const globalDay = getChallengeDayFromStart(
        challenge.startDate,
        challenge.numberOfDays
      );

      if (globalDay === 0) {
        const startDateStr = formatDateShort(challenge.startDate.toDate());
        setBanner({
          message: `This challenge hasn't started yet - check back on ${startDateStr}!`,
          type: "info",
        });
        return;
      }

      if (globalDay > challenge.numberOfDays) {
        setBanner({
          message: "This challenge has ended - check back for new challenges!",
          type: "info",
        });
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
        totalDaysAttempted: 0,
        successfulDaysCount: 0,
        bestPerformance: 0,
        averagePerformance: 0,
        totalSuccessfulSeconds: 0,
        totalSuccessfulReps: 0,
      });

      await loadUserChallenges();
      setActiveTab("active");
    } catch (error) {
      console.error("Error joining challenge:", error);
      setBanner({ message: "Error joining challenge", type: "warning" });
    }
  };

  const handleStartChallenge = (userChallenge) => {
    if (
      isChallengeEnded(
        userChallenge.challengeDetails.startDate,
        userChallenge.challengeDetails.numberOfDays
      )
    ) {
      setBanner({
        message: "This challenge has ended. View your final stats below!",
        type: "info",
      });
      return;
    }

    if (
      userChallenge.lastCompletedDay ===
      userChallenge.challengeDetails.numberOfDays
    ) {
      setBanner({
        message:
          "\u2713 Challenge Complete! You crushed all " +
          userChallenge.challengeDetails.numberOfDays +
          " days! \uD83C\uDF89",
        type: "info",
      });
      return;
    }

    if (userChallenge.lastCompletedDate) {
      const lastCompleted = userChallenge.lastCompletedDate.toDate();
      const today = getPhoenixDate();

      lastCompleted.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (lastCompleted.getTime() === today.getTime()) {
        const isFinalDay =
          userChallenge.currentDay ===
          userChallenge.challengeDetails.numberOfDays;
        if (isFinalDay) {
          setBanner({
            message: `\u2713 Challenge Complete! You crushed all ${userChallenge.challengeDetails.numberOfDays} days! \uD83C\uDF89`,
            type: "info",
          });
        } else {
          setBanner({
            message:
              "\u2713 Today's challenge crushed! Next up tomorrow at midnight MST",
            type: "info",
          });
        }
        return;
      }
    }

    setActiveChallengeData(userChallenge);
    setShowRedoMessage(false);
  };

  const handleChallengeComplete = async (isRedo = false) => {
    setActiveChallengeData(null);
    if (!isRedo) {
      setAttemptNumber(1);
      setShowRedoMessage(false);
    } else {
      setShowRedoMessage(true);
    }
    await loadUserChallenges();
  };

  const handleChallengeCancel = () => {
    setActiveChallengeData(null);
    setAttemptNumber(1);
    setShowRedoMessage(false);
  };

  const handleRedoUsed = () => {
    setAttemptNumber((prev) => prev + 1);
  };

  if (activeChallengeData) {
    const {
      challengeDetails,
      currentDay,
      userChallengeId,
      challengeId,
      teamId,
    } = activeChallengeData;

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
          displayName={profileName || user.displayName || ""}
          teamId={teamId || null}
          numberOfDays={challengeDetails.numberOfDays}
          attemptNumber={attemptNumber}
          onComplete={handleChallengeComplete}
          onCancel={handleChallengeCancel}
          onRedoUsed={handleRedoUsed}
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
          displayName={profileName || user.displayName || ""}
          teamId={teamId || null}
          numberOfDays={challengeDetails.numberOfDays}
          onComplete={handleChallengeComplete}
          onCancel={handleChallengeCancel}
        />
      );
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

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

  const canStartToday = (userChallenge) => {
    if (
      isChallengeEnded(
        userChallenge.challengeDetails.startDate,
        userChallenge.challengeDetails.numberOfDays
      )
    ) {
      return false;
    }

    if (
      userChallenge.lastCompletedDay ===
      userChallenge.challengeDetails.numberOfDays
    ) {
      return false;
    }

    if (!userChallenge.lastCompletedDate) return true;

    const lastCompleted = userChallenge.lastCompletedDate.toDate();
    const today = getPhoenixDate();

    lastCompleted.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return lastCompleted.getTime() !== today.getTime();
  };

  const getJustCompletedChallenges = (allChallenges) => {
    return allChallenges.filter(
      (uc) =>
        uc.status === "active" &&
        uc.lastCompletedDay === uc.challengeDetails.numberOfDays &&
        !isChallengeEnded(
          uc.challengeDetails.startDate,
          uc.challengeDetails.numberOfDays
        )
    );
  };

  const getVisibleEndedChallenges = (allChallenges) => {
    const endedChallenges = allChallenges.filter(
      (uc) =>
        uc.status === "completed" &&
        isChallengeEnded(
          uc.challengeDetails.startDate,
          uc.challengeDetails.numberOfDays
        )
    );

    return endedChallenges
      .sort((a, b) => {
        const aEnd = a.lastCompletedDate?.toMillis?.() || 0;
        const bEnd = b.lastCompletedDate?.toMillis?.() || 0;
        return bEnd - aEnd;
      })
      .slice(0, 4);
  };

  const completedChallenges = getVisibleEndedChallenges(userChallenges);

  return (
    <div style={{ paddingBottom: "80px" }}>
      {banner && (
        <Banner
          message={banner.message}
          type={banner.type}
          onClose={() => setBanner(null)}
        />
      )}

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

      <div style={{ padding: "20px" }}>
        {activeTab === "available" && (
          <div>
            <h2>Available Challenges</h2>
            {challenges.length === 0 ? (
              <p style={{ color: "#999" }}>
                New challenges coming soon - check back later!
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

        {activeTab === "active" && (
          <div>
            <h2>My Active Challenges</h2>
            {(() => {
              const activeChallenges = userChallenges.filter(
                (uc) =>
                  uc.status === "active" &&
                  !isChallengeEnded(
                    uc.challengeDetails.startDate,
                    uc.challengeDetails.numberOfDays
                  ) &&
                  uc.lastCompletedDay !== uc.challengeDetails.numberOfDays
              );
              const justCompletedChallenges =
                getJustCompletedChallenges(userChallenges);
              const hasAnyChallenges =
                activeChallenges.length > 0 ||
                justCompletedChallenges.length > 0;

              if (!hasAnyChallenges) {
                return (
                  <div>
                    <p style={{ color: "#999" }}>
                      Ready to start? Check out Available challenges!
                    </p>
                    {completedChallenges.length > 0 && (
                      <p style={{ color: "#999", marginTop: "4px" }}>
                        See your completed challenges on the Profile tab.
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "15px",
                  }}
                >
                  {activeChallenges.map((userChallenge) => {
                    const canStart = canStartToday(userChallenge);
                    const restCount = userChallenge.missedDaysCount || 0;
                    const redosRemaining = 3 - attemptNumber;
                    const isFinalDay =
                      userChallenge.currentDay ===
                      userChallenge.challengeDetails.numberOfDays;
                    const badges =
                      challengeBadges[userChallenge.challengeId];

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
                          Rest days: {restCount}
                        </p>

                        {badges && (
                          <div
                            style={{
                              marginTop: "16px",
                              padding: "16px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                marginBottom: "12px",
                                color: "var(--color-text)",
                              }}
                            >
                              \uD83D\uDCDB Challenge Badges
                            </div>
                            <BadgeDisplay
                              currentStreak={badges.currentStreak || 0}
                              currentStreakBadgeLevel={
                                badges.currentStreakBadgeLevel || 0
                              }
                              completedStreakBadges={
                                badges.completedStreakBadges || {
                                  3: 0,
                                  7: 0,
                                  14: 0,
                                  21: 0,
                                  28: 0,
                                }
                              }
                              doubleBadgeCount={badges.doubleBadgeCount || 0}
                              tripleBadgeCount={badges.tripleBadgeCount || 0}
                              quadrupleBadgeCount={
                                badges.quadrupleBadgeCount || 0
                              }
                              timeBadges={badges.timeBadges || []}
                              totalPlankSeconds={
                                badges.totalPlankSeconds || 0
                              }
                              showProgress={true}
                              compact={true}
                            />
                          </div>
                        )}

                        {attemptNumber > 1 && canStart && (
                          <p
                            style={{
                              margin: "10px 0 5px 0",
                              color:
                                attemptNumber === 3 ? "#d32f2f" : "#f57c00",
                              fontWeight: "bold",
                              fontSize: "14px",
                            }}
                          >
                            {attemptNumber === 3
                              ? "\u26A0\uFE0F Final do-over remaining"
                              : `${redosRemaining} ${
                                  redosRemaining === 1
                                    ? "do-over"
                                    : "do-overs"
                                } remaining`}
                          </p>
                        )}

                        {showRedoMessage && canStart && (
                          <p
                            style={{
                              margin: "10px 0 5px 0",
                              color: "#22c55e",
                              fontWeight: "600",
                              fontSize: "15px",
                            }}
                          >
                            Ready for another try - you've got this!
                          </p>
                        )}

                        {canStart ? (
                          <button
                            onClick={() =>
                              handleStartChallenge(userChallenge)
                            }
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
                            {isFinalDay
                              ? `Start Day ${userChallenge.currentDay} (Final Day) - Make it count! \uD83C\uDFAF`
                              : `Start Day ${userChallenge.currentDay} \uD83D\uDCAA`}
                            {attemptNumber > 1 &&
                              ` (Attempt ${attemptNumber})`}
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
                            {isFinalDay
                              ? `\u2713 Challenge Complete! You crushed all ${userChallenge.challengeDetails.numberOfDays} days! \uD83C\uDF89`
                              : "\u2713 Today's challenge crushed! Next up tomorrow at midnight MST"}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {justCompletedChallenges.map((userChallenge) => (
                    <ChallengeEndedCard
                      key={userChallenge.userChallengeId}
                      userChallenge={userChallenge}
                      isAwaitingGlobalEnd={true}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === "leaderboards" && (
          <Leaderboard user={user} challenges={challenges} />
        )}

        {activeTab === "profile" && (
          <Profile user={user} completedChallenges={completedChallenges} />
        )}

        {activeTab === "challengeGuide" && <ChallengeGuide />}

        {activeTab === "admin" && user && <AdminPanel user={user} />}
      </div>

      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
      />
    </div>
  );
}
