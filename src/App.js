// src/App.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import PlankTimer from "./components/PlankTimer";
import SquatLogger from "./components/SquatLogger";
import Leaderboard from "./components/Leaderboard";
import Profile from "./components/Profile";
import AdminPanel from "./components/AdminPanel";
import BadgeCelebration from "./components/BadgeCelebration";
import ChallengeGuide from "./components/ChallengeGuide";
import TabNavigation from "./components/TabNavigation";
import ChallengeCard from "./components/ChallengeCard";
import PracticeCard from "./components/PracticeCard";
import Banner from "./components/Banner";
import InstallPrompt from "./components/InstallPrompt";
import ChallengeEndSummaryModal from "./components/ChallengeEndSummaryModal";
import { PRACTICE_CHALLENGE_ID, PRACTICE_TARGET_SECONDS } from "./practiceConstants";
import { initForegroundNotifications } from "./notificationHelpers";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [userChallenges, setUserChallenges] = useState([]);
  const [activeTab, setActiveTab] = useState("available");
  const [activeChallengeData, setActiveChallengeData] = useState(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [showRedoMessage, setShowRedoMessage] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [newBadges, setNewBadges] = useState([]);
  const [practiceReloadKey, setPracticeReloadKey] = useState(0);
  // targetLeaderboardChallengeId: when set, Leaderboard auto-jumps to that archived challenge
  const [targetLeaderboardChallengeId, setTargetLeaderboardChallengeId] = useState(null);
  // Challenge-end summary modal
  const [summaryModal, setSummaryModal] = useState(null); // null | { challengeId, challengeName, challengeType, userId }

  const auth = getAuth();

  // FIX: Initialize foreground notification handler once on mount.
  // Without this, push notifications received while the app is open are silently dropped.
  useEffect(() => {
    initForegroundNotifications();
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        // Ensure user profile doc exists
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await updateDoc(userRef, {}).catch(() => {});
        }
        loadUserChallenges(firebaseUser);
      } else {
        setUserChallenges([]);
      }
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-open active challenge on tab focus ───────────────────────────────
  useEffect(() => {
    if (!user || activeTab !== "active") return;
    const todayReady = userChallenges.find(
      (uc) => uc.status === "active" && !uc.todayComplete && uc.currentDay <= (uc.numberOfDays || 30)
    );
    if (todayReady && !activeChallengeData) {
      // Don't auto-launch; just ensure data is fresh
    }
  }, [user, userChallenges, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the leaderboard deep-link target whenever user manually switches tabs
  // (but NOT when we programmatically navigate to leaderboards)
  const handleTabChange = (tab) => {
    if (tab !== "leaderboards") {
      setTargetLeaderboardChallengeId(null);
    }
    setActiveTab(tab);
  };

  // ── Archive leaderboard before deactivating ───────────────────────────────
  const archiveLeaderboardBeforeDeactivate = async (challengeId) => {
    try {
      const challengeRef = doc(db, "challenges", challengeId);
      const challengeSnap = await getDoc(challengeRef);
      if (!challengeSnap.exists()) throw new Error("Challenge not found");
      const challengeData = challengeSnap.data();

      // Build leaderboard snapshot
      const statsQuery = query(
        collection(db, "challengeUserStats"),
        where("challengeId", "==", challengeId)
      );
      const statsSnap = await getDocs(statsQuery);

      const entries = statsSnap.docs.map((d) => ({
        userId: d.data().userId,
        displayName: d.data().displayName || "Anonymous",
        photoURL: d.data().photoURL || null,
        totalSeconds: d.data().totalSeconds || 0,
        totalReps: d.data().totalReps || 0,
        bestSeconds: d.data().bestSeconds || 0,
        bestReps: d.data().bestReps || 0,
        daysCompleted: d.data().daysCompleted || 0,
        teamId: d.data().teamId || null,
      }));

      // Calculate team standings if this is a team challenge
      let teamStandings = [];
      if (challengeData.isTeamChallenge) {
        const teamsSnap = await getDocs(collection(db, "teams"));
        const teamsMap = {};
        teamsSnap.forEach((d) => { teamsMap[d.id] = { id: d.id, ...d.data() }; });

        const teamTotals = {};
        entries.forEach((e) => {
          if (!e.teamId) return;
          if (!teamTotals[e.teamId]) {
            teamTotals[e.teamId] = {
              teamId: e.teamId,
              teamName: teamsMap[e.teamId]?.name || "Unknown",
              teamColor: teamsMap[e.teamId]?.color || "#999",
              totalSeconds: 0,
              totalReps: 0,
              memberCount: 0,
            };
          }
          teamTotals[e.teamId].totalSeconds += e.totalSeconds;
          teamTotals[e.teamId].totalReps += e.totalReps;
          teamTotals[e.teamId].memberCount += 1;
        });

        teamStandings = Object.values(teamTotals).map((t) => ({
          ...t,
          avgSeconds: t.memberCount > 0 ? Math.round(t.totalSeconds / t.memberCount) : 0,
          avgReps: t.memberCount > 0 ? Math.round(t.totalReps / t.memberCount) : 0,
        }));
      }

      await addDoc(collection(db, "leaderboardHistory"), {
        challengeId,
        challengeName: challengeData.name || "Challenge",
        challengeType: challengeData.type || "plank",
        isTeamChallenge: challengeData.isTeamChallenge || false,
        archivedAt: serverTimestamp(),
        entries,
        teamStandings,
        numberOfDays: challengeData.numberOfDays || 30,
      });

      return true;
    } catch (err) {
      console.error("archiveLeaderboardBeforeDeactivate error:", err);
      return false;
    }
  };

  // ── Load challenges ───────────────────────────────────────────────────────
  const loadChallenges = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "challenges"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChallenges(data);
    } catch (err) {
      console.error("loadChallenges error:", err);
    }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  // ── Load user challenges ──────────────────────────────────────────────────
  const loadUserChallenges = useCallback(async (firebaseUser) => {
    const currentUser = firebaseUser || user;
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "userChallenges"),
        where("userId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Enrich with challenge details
      const enriched = await Promise.all(
        data.map(async (uc) => {
          const cSnap = await getDoc(doc(db, "challenges", uc.challengeId));
          if (!cSnap.exists()) return null;
          const c = cSnap.data();
          return {
            ...uc,
            challengeName: c.name,
            challengeType: c.type,
            isTeamChallenge: c.isTeamChallenge || false,
            numberOfDays: c.numberOfDays || 30,
            isActive: c.isActive !== false,
          };
        })
      );
      setUserChallenges(enriched.filter(Boolean));
    } catch (err) {
      console.error("loadUserChallenges error:", err);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile name ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchName = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().displayName) {
          setProfileName(snap.data().displayName);
        } else {
          setProfileName(user.displayName || "");
        }
      } catch {
        setProfileName(user.displayName || "");
      }
    };
    fetchName();
  }, [user]);

  // ── Sign in / out ─────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign in error:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setActiveTab("available");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // ── Challenge actions ─────────────────────────────────────────────────────
  const handleStartChallenge = (challengeDetails, userChallengeId, currentDay, challengeId, teamId) => {
    setActiveChallengeData({ challengeDetails, userChallengeId, currentDay, challengeId, teamId, isPractice: false });
    setAttemptNumber(1);
    setShowRedoMessage(false);
  };

  const handleStartPractice = () => {
    setActiveChallengeData({
      challengeDetails: { name: "Practice", type: "plank", numberOfDays: 1 },
      userChallengeId: null,
      currentDay: 1,
      challengeId: PRACTICE_CHALLENGE_ID,
      teamId: null,
      isPractice: true,
    });
    setAttemptNumber(1);
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
    // After a fresh completion (not a redo), take user straight to leaderboard
    if (!isRedo) setActiveTab("leaderboards");
  };

  const handleChallengeCancel = () => {
    setActiveChallengeData(null);
    setAttemptNumber(1);
    setShowRedoMessage(false);
  };

  const handleRedoUsed = () => {
    setAttemptNumber((prev) => prev + 1);
  };

  // Navigate to leaderboard and deep-link to a specific archived challenge
  const handleViewFinalLeaderboard = (challengeId) => {
    setTargetLeaderboardChallengeId(challengeId);
    setActiveTab("leaderboards");
  };

  if (activeChallengeData) {
    const {
      challengeDetails,
      currentDay,
      userChallengeId,
      challengeId,
      teamId,
      isPractice: isPracticeFlow,
    } = activeChallengeData;

    if (isPracticeFlow) {
      return (
        <PlankTimer
          isPractice
          targetSeconds={PRACTICE_TARGET_SECONDS}
          day={1}
          userChallengeId={null}
          challengeId={PRACTICE_CHALLENGE_ID}
          userId={user.uid}
          user={user}
          displayName={profileName || user.displayName || ""}
          teamId={null}
          numberOfDays={1}
          attemptNumber={1}
          onComplete={() => {
            setActiveChallengeData(null);
            setPracticeReloadKey((k) => k + 1);
          }}
          onCancel={handleChallengeCancel}
          onRedoUsed={handleRedoUsed}
          onNewBadges={(badges) => setNewBadges(badges)}
        />
      );
    }

    if (challengeDetails.type === "plank") {
      return (
        <PlankTimer
          targetSeconds={challengeDetails.targetSeconds || 60}
          day={currentDay}
          userChallengeId={userChallengeId}
          challengeId={challengeId}
          userId={user.uid}
          user={user}
          displayName={profileName || user.displayName || ""}
          teamId={teamId}
          numberOfDays={challengeDetails.numberOfDays || 30}
          attemptNumber={attemptNumber}
          onComplete={handleChallengeComplete}
          onCancel={handleChallengeCancel}
          onRedoUsed={handleRedoUsed}
          onNewBadges={(badges) => setNewBadges(badges)}
        />
      );
    }

    if (challengeDetails.type === "squat") {
      return (
        <SquatLogger
          targetReps={challengeDetails.targetReps || 20}
          day={currentDay}
          userChallengeId={userChallengeId}
          challengeId={challengeId}
          userId={user.uid}
          user={user}
          displayName={profileName || user.displayName || ""}
          teamId={teamId}
          numberOfDays={challengeDetails.numberOfDays || 30}
          attemptNumber={attemptNumber}
          onComplete={handleChallengeComplete}
          onCancel={handleChallengeCancel}
          onRedoUsed={handleRedoUsed}
          onNewBadges={(badges) => setNewBadges(badges)}
        />
      );
    }
  }

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f5f5f5" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏋️</div>
          <p style={{ color: "#666", fontSize: "16px" }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ── Sign in screen ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", minHeight: "100vh", backgroundColor: "#f5f5f5",
        padding: "20px", textAlign: "center",
      }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>🏋️‍♀️</div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", marginBottom: "8px" }}>
          Plank &amp; Squat Challenge
        </h1>
        <p style={{ color: "#666", fontSize: "16px", marginBottom: "32px", maxWidth: "300px" }}>
          Track your daily plank and squat challenges. Compete with friends!
        </p>
        <button
          onClick={handleSignIn}
          style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "14px 28px", backgroundColor: "#fff",
            border: "2px solid #ddd", borderRadius: "12px",
            fontSize: "16px", fontWeight: "600", color: "#333",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="24" height="24" />
          Sign in with Google
        </button>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  const activeChallenges = userChallenges.filter(
    (uc) => uc.status === "active" && uc.isActive !== false
  );
  const completedChallenges = userChallenges.filter(
    (uc) => uc.status === "completed" || uc.isActive === false
  );

  // Get challenges user hasn't joined yet
  const joinedChallengeIds = userChallenges.map((uc) => uc.challengeId);
  const availableChallenges = challenges.filter(
    (c) => c.isActive !== false && !joinedChallengeIds.includes(c.id)
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", paddingBottom: "80px" }}>
      <Banner />
      <InstallPrompt />

      {/* Badge celebration overlay */}
      {newBadges.length > 0 && (
        <BadgeCelebration
          badges={newBadges}
          onDismiss={() => setNewBadges([])}
        />
      )}

      {/* Challenge end summary modal */}
      {summaryModal && (
        <ChallengeEndSummaryModal
          challengeId={summaryModal.challengeId}
          challengeName={summaryModal.challengeName}
          challengeType={summaryModal.challengeType}
          userId={summaryModal.userId}
          onClose={() => setSummaryModal(null)}
          onViewLeaderboard={handleViewFinalLeaderboard}
        />
      )}

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "16px",
        }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
              🏋️ Plank &amp; Squat
            </h1>
            <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
              {profileName || user.displayName || user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              padding: "8px 16px", backgroundColor: "transparent",
              border: "1px solid #ddd", borderRadius: "8px",
              fontSize: "14px", color: "#666", cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>

        {/* Available Challenges Tab */}
        {activeTab === "available" && (
          <div>
            {/* Practice card always shown */}
            <PracticeCard
              key={practiceReloadKey}
              user={user}
              onStartPractice={handleStartPractice}
            />

            {availableChallenges.length === 0 ? (
              <div style={{
                backgroundColor: "#fff", borderRadius: "12px",
                padding: "32px", textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
                <h3 style={{ color: "#1a1a1a", marginBottom: "8px" }}>You're all caught up!</h3>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  You've joined all active challenges. Check back soon for new ones!
                </p>
              </div>
            ) : (
              availableChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  user={user}
                  onJoin={async () => {
                    await loadUserChallenges();
                    await loadChallenges();
                    setActiveTab("active");
                  }}
                />
              ))
            )}
          </div>
        )}

        {/* Active Challenges Tab */}
        {activeTab === "active" && (
          <div>
            {showRedoMessage && (
              <div style={{
                backgroundColor: "#fff3cd", border: "1px solid #ffc107",
                borderRadius: "8px", padding: "12px 16px", marginBottom: "12px",
                fontSize: "14px", color: "#856404",
              }}>
                ✅ Redo logged! Your best time will be used for the leaderboard.
              </div>
            )}

            {activeChallenges.length === 0 ? (
              <div style={{
                backgroundColor: "#fff", borderRadius: "12px",
                padding: "32px", textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>👀</div>
                <h3 style={{ color: "#1a1a1a", marginBottom: "8px" }}>No active challenges</h3>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  Head to Available to join a challenge!
                </p>
                <button
                  onClick={() => setActiveTab("available")}
                  style={{
                    marginTop: "16px", padding: "10px 24px",
                    backgroundColor: "#4CAF50", color: "#fff",
                    border: "none", borderRadius: "8px",
                    fontSize: "14px", fontWeight: "600", cursor: "pointer",
                  }}
                >
                  Browse Challenges
                </button>
              </div>
            ) : (
              activeChallenges.map((uc) => {
                const challengeDetails = challenges.find((c) => c.id === uc.challengeId);
                if (!challengeDetails) return null;
                return (
                  <ChallengeCard
                    key={uc.id}
                    challenge={challengeDetails}
                    userChallenge={uc}
                    user={user}
                    onStart={(currentDay) =>
                      handleStartChallenge(
                        challengeDetails,
                        uc.id,
                        currentDay,
                        uc.challengeId,
                        uc.teamId || null
                      )
                    }
                    onViewLeaderboard={handleViewFinalLeaderboard}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === "leaderboards" && (
          <Leaderboard
            user={user}
            challenges={challenges}
            targetChallengeId={targetLeaderboardChallengeId}
          />
        )}
        {activeTab === "profile" && (
          <Profile user={user} onNameUpdate={setProfileName} />
        )}
        {activeTab === "challengeGuide" && <ChallengeGuide />}
        {activeTab === "admin" && user && <AdminPanel user={user} />}
      </div>

      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        user={user}
        activeChallengesCount={activeChallenges.length}
      />
    </div>
  );
}
