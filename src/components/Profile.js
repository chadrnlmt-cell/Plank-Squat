// src/components/Profile.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { getAllUserBadges } from "../badgeHelpers";
import { getPracticeStats } from "../practiceHelpers";
import { LegacyBadgeDisplay } from "./BadgeDisplay";
import ChallengeEndedCard from "./ChallengeEndedCard";

export default function Profile({ user, completedChallenges = [] }) {
  const [profileName, setProfileName] = useState(user?.displayName || "");
  const [initialProfileName, setInitialProfileName] = useState(user?.displayName || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [stats, setStats] = useState({
    challengesCompleted: 0,
    totalPlankSeconds: 0,
    bestPlankSeconds: 0,
    plankSuccessCount: 0,
    totalSquats: 0,
    bestSquats: 0,
    squatSuccessCount: 0,
  });

  const [badgesLoading, setBadgesLoading] = useState(true);
  const [allBadges, setAllBadges] = useState(null);

  const [practiceStats, setPracticeStats] = useState(null);
  const [practiceLoading, setPracticeLoading] = useState(true);

  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const initialData = { userId: user.uid, displayName: user.displayName || "", createdAt: new Date().toISOString() };
          await setDoc(ref, initialData);
          setProfileName(initialData.displayName);
          setInitialProfileName(initialData.displayName);
        } else {
          const data = snap.data();
          const nameFromDoc = data.displayName || user.displayName || "";
          setProfileName(nameFromDoc);
          setInitialProfileName(nameFromDoc);
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
    };
    loadUserProfile();
  }, [user]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;
      setStatsLoading(true);
      setStatsError("");
      try {
        const userStatsRef = doc(db, "userStats", user.uid);
        const userStatsSnap = await getDoc(userStatsRef);
        let totalPlankSeconds = 0, bestPlankSeconds = 0, plankSuccessCount = 0;
        let totalSquats = 0, bestSquats = 0, squatSuccessCount = 0;
        if (userStatsSnap.exists()) {
          const data = userStatsSnap.data();
          totalPlankSeconds = data.totalPlankSeconds || 0;
          bestPlankSeconds = data.bestPlankSeconds || 0;
          plankSuccessCount = data.plankSuccessCount || 0;
          totalSquats = data.totalSquats || 0;
          bestSquats = data.bestSquats || 0;
          squatSuccessCount = data.squatSuccessCount || 0;
        }
        const ucRef = collection(db, "userChallenges");
        const qCompleted = query(ucRef, where("userId", "==", user.uid), where("status", "==", "completed"));
        const ucSnap = await getDocs(qCompleted);
        setStats({ challengesCompleted: ucSnap.size, totalPlankSeconds, bestPlankSeconds, plankSuccessCount, totalSquats, bestSquats, squatSuccessCount });
      } catch (err) {
        console.error("Error loading profile stats:", err);
        setStatsError("Could not load stats. Please try again later.");
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [user]);

  useEffect(() => {
    const loadBadges = async () => {
      if (!user) return;
      setBadgesLoading(true);
      try {
        const badges = await getAllUserBadges(user.uid);
        setAllBadges(badges);
      } catch (err) {
        console.error("Error loading badges:", err);
      } finally {
        setBadgesLoading(false);
      }
    };
    loadBadges();
  }, [user]);

  useEffect(() => {
    const loadPractice = async () => {
      if (!user) return;
      setPracticeLoading(true);
      try {
        const stats = await getPracticeStats(user.uid);
        setPracticeStats(stats);
      } catch (err) {
        console.error("Error loading practice stats:", err);
      } finally {
        setPracticeLoading(false);
      }
    };
    loadPractice();
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = profileName.trim();
    if (!trimmed) { setNameMessage("Name cannot be empty."); return; }
    if (trimmed === initialProfileName) { setNameMessage("No changes to save."); return; }
    setIsSavingName(true);
    setNameMessage("");
    try {
      const userProfileRef = doc(db, "users", user.uid);
      await setDoc(userProfileRef, { userId: user.uid, displayName: trimmed }, { merge: true });
      const userStatsRef = doc(db, "userStats", user.uid);
      const userStatsSnap = await getDoc(userStatsRef);
      if (userStatsSnap.exists()) await updateDoc(userStatsRef, { displayName: trimmed });
      const cusRef = collection(db, "challengeUserStats");
      const qCus = query(cusRef, where("userId", "==", user.uid));
      const cusSnap = await getDocs(qCus);
      if (cusSnap.docs.length > 0) await Promise.all(cusSnap.docs.map((d) => updateDoc(d.ref, { displayName: trimmed })));
      setInitialProfileName(trimmed);
      setNameMessage("Display name updated across app and leaderboards.");
    } catch (err) {
      console.error("Error saving display name:", err);
      setNameMessage("Failed to save name. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  };

  const allTimePlankAvg = stats.plankSuccessCount > 0 ? Math.round(stats.totalPlankSeconds / stats.plankSuccessCount) : null;
  const allTimeSquatAvg = stats.squatSuccessCount > 0 ? Math.round(stats.totalSquats / stats.squatSuccessCount) : null;

  const sectionDividerStyle = { display: "flex", alignItems: "center", gap: "8px", margin: "12px 0 8px 0" };
  const sectionLabelStyle = { fontSize: "13px", fontWeight: "700", color: "var(--color-text)", whiteSpace: "nowrap" };
  const sectionLineStyle = { flex: 1, height: "1px", backgroundColor: "#e0e0e0" };

  const hasPlankData = stats.totalPlankSeconds > 0 || stats.bestPlankSeconds > 0;
  const hasSquatData = stats.totalSquats > 0 || stats.bestSquats > 0;

  // Legacy data from allBadges
  const legacyData = allBadges?.legacy || {
    consecutiveRun: 0,
    consecutiveRunBadgeLevel: 0,
    earnedConsecutiveRunBadges: [],
    earnedTimeBadges: [],
  };

  // ── Performance Badges (inline, Profile only) ──────────────────────────────
  const performancePills = [
    {
      key: "double",
      emoji: "⚡",
      label: "Double Trouble",
      count: allBadges?.allMultipliers?.double || 0,
      bg: "#dbeafe",
      border: "#3b82f6",
      color: "#1e3a8a",
    },
    {
      key: "triple",
      emoji: "🚀",
      label: "Triple Threat",
      count: allBadges?.allMultipliers?.triple || 0,
      bg: "#fce7f3",
      border: "#ec4899",
      color: "#831843",
    },
    {
      key: "quadruple",
      emoji: "👑",
      label: "4x Champion",
      count: allBadges?.allMultipliers?.quadruple || 0,
      bg: "#f3e8ff",
      border: "#a855f7",
      color: "#581c87",
    },
  ].filter((p) => p.count > 0);

  // Streak pills — size grows dramatically with milestone (2px font bump each tier)
  const streakPillConfig = [
    { days: 3,  label: "3-Day Streak",  fontSize: 13, paddingV: 8,  paddingH: 14 },
    { days: 7,  label: "7-Day Streak",  fontSize: 15, paddingV: 10, paddingH: 16 },
    { days: 14, label: "14-Day Streak", fontSize: 17, paddingV: 11, paddingH: 18 },
    { days: 21, label: "21-Day Streak", fontSize: 19, paddingV: 12, paddingH: 20 },
    { days: 28, label: "28-Day Streak", fontSize: 21, paddingV: 14, paddingH: 22 },
  ];

  const streakPills = streakPillConfig
    .map((cfg) => ({
      ...cfg,
      count: allBadges?.allStreakBadges?.[cfg.days] || 0,
    }))
    .filter((p) => p.count > 0);

  const hasAnyPerformanceBadges = performancePills.length > 0;
  const hasAnyStreakBadges = streakPills.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Profile Card */}
      <div className="card" style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}>
        <div className="card__body">
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Profile</h2>
          <p style={{ margin: "0 0 12px 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Signed in with: {user.email}
          </p>
          <div className="form-group">
            <label className="form-label">Display name (in this app)</label>
            <input
              type="text"
              className="form-control"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={isSavingName}
              placeholder="Enter name to show in app"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
            <button className="btn btn--primary" onClick={handleSaveName} disabled={isSavingName}>
              {isSavingName ? "Saving..." : "Save Name"}
            </button>
          </div>
          {nameMessage && <p style={{ marginTop: "8px", fontSize: "13px", color: "#555" }}>{nameMessage}</p>}
        </div>
      </div>

      {/* Stats Card */}
      <div className="card" style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}>
        <div className="card__body">
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Stats</h2>
          {statsLoading && <p>Loading stats...</p>}
          {!statsLoading && statsError && <p style={{ color: "var(--color-error)" }}>{statsError}</p>}
          {!statsLoading && !statsError && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px" }}>
              <div><strong>Challenges completed:</strong> {stats.challengesCompleted}</div>
              {hasPlankData && (
                <>
                  <div style={sectionDividerStyle}><span style={sectionLabelStyle}>🏐 Plank</span><div style={sectionLineStyle} /></div>
                  <div><strong>Total plank time:</strong> {formatSeconds(stats.totalPlankSeconds)}</div>
                  <div><strong>Personal Best plank:</strong> {formatSeconds(stats.bestPlankSeconds)}</div>
                  {allTimePlankAvg !== null && <div><strong>All-time plank avg:</strong> {formatSeconds(allTimePlankAvg)}</div>}
                </>
              )}
              {hasSquatData && (
                <>
                  <div style={sectionDividerStyle}><span style={sectionLabelStyle}>🦵 Squats</span><div style={sectionLineStyle} /></div>
                  <div><strong>Total squats:</strong> {stats.totalSquats} reps</div>
                  <div><strong>Personal Best squats:</strong> {stats.bestSquats} reps</div>
                  {allTimeSquatAvg !== null && <div><strong>All-time squat avg:</strong> {allTimeSquatAvg} reps</div>}
                </>
              )}
              {!hasPlankData && !hasSquatData && (
                <div style={{ color: "var(--color-text-secondary)", marginTop: "4px" }}>Complete a challenge day to see your stats here!</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* All-Time Performance Badges Card */}
      <div className="card" style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}>
        <div className="card__body">
          <h2 style={{ marginTop: 0, marginBottom: "4px" }}>💪 All-Time Performance Badges</h2>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: 0, marginBottom: "16px" }}>
            Earned across all challenges
          </p>

          {badgesLoading && <p>Loading badges...</p>}

          {!badgesLoading && allBadges && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* 💪 Performance Sub-Section */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--color-text-secondary)", marginBottom: "10px" }}>
                  💪 Performance
                </div>
                {hasAnyPerformanceBadges ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {performancePills.map((pill) => (
                      <div
                        key={pill.key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "10px 18px",
                          backgroundColor: pill.bg,
                          border: `2px solid ${pill.border}`,
                          borderRadius: "20px",
                          fontSize: "14px",
                          fontWeight: "600",
                          color: pill.color,
                          minWidth: "100px",
                        }}
                      >
                        <span>{pill.emoji} {pill.label}</span>
                        <span>×{pill.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>
                    Double, triple, or quadruple your goal to earn badges!
                  </div>
                )}
              </div>

              {/* 🔥 Streaks Sub-Section */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--color-text-secondary)", marginBottom: "10px" }}>
                  🔥 Streaks
                </div>
                {hasAnyStreakBadges ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
                    {streakPills.map((pill) => (
                      <div
                        key={pill.days}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: `${pill.paddingV}px ${pill.paddingH}px`,
                          backgroundColor: "#fef3c7",
                          border: "2px solid #fbbf24",
                          borderRadius: "20px",
                          fontSize: `${pill.fontSize}px`,
                          fontWeight: "600",
                          color: "#78350f",
                          minWidth: "80px",
                        }}
                      >
                        <span>🔥 {pill.label}</span>
                        <span>×{pill.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>
                    Complete a 3-day streak to earn your first streak badge!
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* 🏆 Lifetime Achievements Card — gold border, permanent wall */}
      <div
        className="card"
        style={{
          textAlign: "left",
          maxWidth: "500px",
          margin: "0 auto",
          border: "2px solid #eab308",
          backgroundColor: "#fffbeb",
        }}
      >
        <div className="card__body">
          <h2 style={{ marginTop: 0, marginBottom: "4px", color: "#92400e" }}>
            🏆 Lifetime Achievements
          </h2>
          <p style={{ fontSize: "13px", color: "#a16207", marginBottom: "16px", marginTop: 0 }}>
            Permanent records earned across your entire journey
          </p>

          {badgesLoading && <p>Loading...</p>}

          {!badgesLoading && (
            <LegacyBadgeDisplay
              consecutiveRun={legacyData.consecutiveRun}
              consecutiveRunBadgeLevel={legacyData.consecutiveRunBadgeLevel}
              earnedConsecutiveRunBadges={legacyData.earnedConsecutiveRunBadges}
              earnedTimeBadges={legacyData.earnedTimeBadges}
              totalPlankSeconds={stats.totalPlankSeconds}
            />
          )}
        </div>
      </div>

      {/* Practice Session History — visible whenever there's practice data, even after Leave */}
      {!practiceLoading && practiceStats && (practiceStats.totalSessions || 0) > 0 && (
        <div
          className="card"
          style={{
            textAlign: "left",
            maxWidth: "500px",
            margin: "0 auto",
            border: "2px solid #10b981",
            background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
          }}
        >
          <div className="card__body">
            <h2 style={{ marginTop: 0, marginBottom: "4px", color: "#065f46" }}>
              🏋️ Practice Session History
            </h2>
            <p style={{ fontSize: "13px", color: "#047857", marginTop: 0, marginBottom: "16px" }}>
              {practiceStats.joined ? "You're currently in Practice Session." : "You've left Practice Session — your history is saved."}
            </p>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "rgba(16,185,129,0.10)", borderRadius: "8px" }}>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#065f46" }}>{practiceStats.totalSessions || 0}</div>
                <div style={{ fontSize: "11px", color: "#047857" }}>Sessions</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "rgba(16,185,129,0.10)", borderRadius: "8px" }}>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#065f46" }}>{formatSeconds(practiceStats.totalSeconds || 0)}</div>
                <div style={{ fontSize: "11px", color: "#047857" }}>Total Time</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "rgba(16,185,129,0.10)", borderRadius: "8px" }}>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#065f46" }}>{formatSeconds(practiceStats.bestSeconds || 0)}</div>
                <div style={{ fontSize: "11px", color: "#047857" }}>Best</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fbbf24" }}>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#78350f" }}>
                  🔥 {practiceStats.currentStreak || 0}
                </div>
                <div style={{ fontSize: "11px", color: "#92400e" }}>Current Streak</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fbbf24" }}>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#78350f" }}>{practiceStats.bestStreak || 0}</div>
                <div style={{ fontSize: "11px", color: "#92400e" }}>Best Streak</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Challenges Section */}
      {completedChallenges.length > 0 && (
        <div style={{ maxWidth: "500px", margin: "0 auto", width: "100%" }}>
          <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "8px 0 16px 0" }} />
          <h2 style={{ margin: "0 0 12px 0", fontSize: "20px" }}>Completed Challenges</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {completedChallenges.map((userChallenge) => (
              <ChallengeEndedCard key={userChallenge.userChallengeId} userChallenge={userChallenge} isAwaitingGlobalEnd={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
