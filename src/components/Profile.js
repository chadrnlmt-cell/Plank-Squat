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

export default function Profile({ user }) {
  const [profileName, setProfileName] = useState(user?.displayName || "");
  const [initialProfileName, setInitialProfileName] = useState(
    user?.displayName || ""
  );
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [stats, setStats] = useState({
    challengesCompleted: 0,
    totalPlankSeconds: 0,
    bestPlankSeconds: 0,
    totalSquats: 0,
    bestSquats: 0,
  });

  // Helper: format seconds as Xm Ys
  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  // Load or create users/<uid> document for web-app display name
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          const initialData = {
            userId: user.uid,
            displayName: user.displayName || "",
            createdAt: new Date().toISOString(),
          };
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

  // Load stats from userStats and userChallenges
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;
      setStatsLoading(true);
      setStatsError("");

      try {
        // 1) userStats
        const userStatsRef = doc(db, "userStats", user.uid);
        const userStatsSnap = await getDoc(userStatsRef);

        let totalPlankSeconds = 0;
        let bestPlankSeconds = 0;
        let totalSquats = 0;
        let bestSquats = 0;

        if (userStatsSnap.exists()) {
          const data = userStatsSnap.data();
          totalPlankSeconds = data.totalPlankSeconds || 0;
          bestPlankSeconds = data.bestPlankSeconds || 0;
          totalSquats = data.totalSquats || 0;
          bestSquats = data.bestSquats || 0;
        }

        // 2) challengesCompleted from userChallenges
        const ucRef = collection(db, "userChallenges");
        const qCompleted = query(
          ucRef,
          where("userId", "==", user.uid),
          where("status", "==", "completed")
        );
        const ucSnap = await getDocs(qCompleted);
        const challengesCompleted = ucSnap.size;

        setStats({
          challengesCompleted,
          totalPlankSeconds,
          bestPlankSeconds,
          totalSquats,
          bestSquats,
        });
      } catch (err) {
        console.error("Error loading profile stats:", err);
        setStatsError("Could not load stats. Please try again later.");
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = profileName.trim();

    if (!trimmed) {
      setNameMessage("Name cannot be empty.");
      return;
    }

    if (trimmed === initialProfileName) {
      setNameMessage("No changes to save.");
      return;
    }

    setIsSavingName(true);
    setNameMessage("");

    try {
      // 1) Update users/<uid> profile doc
      const userProfileRef = doc(db, "users", user.uid);
      await setDoc(
        userProfileRef,
        {
          userId: user.uid,
          displayName: trimmed,
        },
        { merge: true }
      );

      // 2) Update userStats/<uid> displayName if it exists
      const userStatsRef = doc(db, "userStats", user.uid);
      const userStatsSnap = await getDoc(userStatsRef);
      if (userStatsSnap.exists()) {
        await updateDoc(userStatsRef, {
          displayName: trimmed,
        });
      }

      // 3) Update all challengeUserStats docs for this user
      const cusRef = collection(db, "challengeUserStats");
      const qCus = query(cusRef, where("userId", "==", user.uid));
      const cusSnap = await getDocs(qCus);
      const batchUpdates = [];
      for (const d of cusSnap.docs) {
        batchUpdates.push(
          updateDoc(d.ref, {
            displayName: trimmed,
          })
        );
      }
      if (batchUpdates.length > 0) {
        await Promise.all(batchUpdates);
      }

      setInitialProfileName(trimmed);
      setNameMessage("Display name updated across app and leaderboards.");
    } catch (err) {
      console.error("Error saving display name:", err);
      setNameMessage("Failed to save name. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Profile Card */}
      <div
        className="card"
        style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}
      >
        <div className="card__body">
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Profile</h2>
          <p
            style={{
              margin: "0 0 12px 0",
              color: "var(--color-text-secondary)",
              fontSize: "14px",
            }}
          >
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

          <button
            className="btn btn--primary btn--full-width"
            onClick={handleSaveName}
            disabled={isSavingName}
          >
            {isSavingName ? "Saving..." : "Save Name"}
          </button>

          {nameMessage && (
            <p
              style={{
                marginTop: "8px",
                fontSize: "13px",
                color: "#555",
              }}
            >
              {nameMessage}
            </p>
          )}
        </div>
      </div>

      {/* Stats Card */}
      <div
        className="card"
        style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}
      >
        <div className="card__body">
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Stats</h2>

          {statsLoading && <p>Loading stats...</p>}

          {!statsLoading && statsError && (
            <p style={{ color: "var(--color-error)" }}>{statsError}</p>
          )}

          {!statsLoading && !statsError && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "14px",
              }}
            >
              <div>
                <strong>Challenges completed:</strong>{" "}
                {stats.challengesCompleted}
              </div>
              <div>
                <strong>Total plank time:</strong>{" "}
                {formatSeconds(stats.totalPlankSeconds)}
              </div>
              <div>
                <strong>Best plank:</strong>{" "}
                {formatSeconds(stats.bestPlankSeconds)}
              </div>
              <div>
                <strong>Total squats:</strong> {stats.totalSquats}
              </div>
              <div>
                <strong>Best squats:</strong> {stats.bestSquats}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
