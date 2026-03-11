// src/components/PlankTimer.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import Confetti from "react-confetti";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { getPhoenixDate } from "../utils";
import { updatePlankStatsOnSuccess } from "../statsHelpers";
import { updateBadgesOnCompletion } from "../badgeHelpers";
import BadgeCelebration from "./BadgeCelebration";

// Simple helper to request/release screen wake lock
async function requestScreenWakeLock() {
  try {
    if (
      typeof navigator !== "undefined" &&
      "wakeLock" in navigator &&
      navigator.wakeLock &&
      typeof navigator.wakeLock.request === "function"
    ) {
      const wakeLock = await navigator.wakeLock.request("screen");
      return wakeLock;
    }
  } catch (err) {
    console.error("Error requesting wake lock:", err);
  }
  return null;
}

function isWakeLockSupported() {
  return (
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    navigator.wakeLock &&
    typeof navigator.wakeLock.request === "function"
  );
}

const RECOVERY_TIPS = [
  "Take some deep breaths",
  "Stretch those muscles",
  "Shake it out and reset",
  "Stay strong, you've got this",
];

// Emoji pool to randomize alongside tips
const RECOVERY_EMOJIS = ["💪", "🔥", "😤", "🧘", "✊", "😮\u200d💨"];

const HIGH_CELEBRATIONS = [
  "Crushing it! 💪",
  "You're on fire! 🔥",
  "Beast mode! 💪",
  "Incredible! 🌟",
  "Unstoppable! 💪",
  "Next level! 🚀",
  "Keep dominating! 💪",
];

const STANDARD_CELEBRATIONS = [
  "Goal achieved! Well done! ✓",
  "Target reached! Nice job!",
  "You did it! Goal accomplished!",
  "Success! You met today's goal!",
];

// Milestone config: multiplier -> banner details
const MILESTONES = [
  {
    multiplier: 2,
    label: "DOUBLE TIME!",
    emoji: "🥇",
    sub: "You doubled your goal — incredible!",
    bg: "linear-gradient(135deg, #b45309 0%, #eab308 100%)",
    confettiColors: ["#eab308", "#fbbf24", "#ffffff", "#f59e0b"],
  },
  {
    multiplier: 3,
    label: "TRIPLE TIME!",
    emoji: "🔥",
    sub: "You tripled your goal — you're a beast!",
    bg: "linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)",
    confettiColors: ["#a855f7", "#d8b4fe", "#ffffff", "#7c3aed"],
  },
  {
    multiplier: 4,
    label: "QUADRUPLE TIME!",
    emoji: "🚀",
    sub: "You quadrupled your goal — LEGENDARY!",
    bg: "linear-gradient(135deg, #c2410c 0%, #f97316 100%)",
    confettiColors: ["#f97316", "#fed7aa", "#ffffff", "#ea580c"],
  },
];

export default function PlankTimer({
  targetSeconds,
  day,
  userChallengeId,
  challengeId,
  userId,
  user,
  displayName,
  teamId,
  numberOfDays,
  attemptNumber,
  onComplete,
  onCancel,
  onRedoUsed,
}) {
  const [stage, setStage] = useState("countdown");
  // Stages: countdown | active | paused | autoStopping | stillGoingPrompt | keepRedoScreen | complete | failed

  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [totalRecoveryUsed, setTotalRecoveryUsed] = useState(0);
  const [currentPauseStart, setCurrentPauseStart] = useState(null);
  const [currentRecoveryTime, setCurrentRecoveryTime] = useState(0);
  const [hasPaused, setHasPaused] = useState(false);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [recoveryTip, setRecoveryTip] = useState("");
  const [recoveryEmoji, setRecoveryEmoji] = useState("💪");

  // Anti-cheating states
  const [stillGoingCountdown, setStillGoingCountdown] = useState(20);
  const [frozenTime, setFrozenTime] = useState(0);
  const [showWakeLockWarning, setShowWakeLockWarning] = useState(false);
  const [stillGoingStartTime, setStillGoingStartTime] = useState(null);

  // Badge celebration
  const [newBadges, setNewBadges] = useState([]);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  // Milestone celebration banner
  const [activeMilestone, setActiveMilestone] = useState(null); // null or one of MILESTONES
  const [showConfetti, setShowConfetti] = useState(false);
  const milestonesFiredRef = useRef(new Set()); // track which multipliers already fired
  const milestoneDismissTimerRef = useRef(null);

  const intervalRef = useRef(null);
  const recoveryIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const stillGoingIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  const RECOVERY_LIMIT = 60;

  // Dismiss the milestone banner
  const dismissMilestone = useCallback(() => {
    setActiveMilestone(null);
    setShowConfetti(false);
    if (milestoneDismissTimerRef.current) {
      clearTimeout(milestoneDismissTimerRef.current);
      milestoneDismissTimerRef.current = null;
    }
  }, []);

  // Fire a milestone banner
  const fireMilestone = useCallback((milestone) => {
    // Clear any existing banner first
    if (milestoneDismissTimerRef.current) {
      clearTimeout(milestoneDismissTimerRef.current);
    }
    setActiveMilestone(milestone);
    setShowConfetti(true);
    // Auto-dismiss after 10 seconds
    milestoneDismissTimerRef.current = setTimeout(() => {
      setActiveMilestone(null);
      setShowConfetti(false);
      milestoneDismissTimerRef.current = null;
    }, 10000);
  }, []);

  // Cleanup milestone timer on unmount
  useEffect(() => {
    return () => {
      if (milestoneDismissTimerRef.current) {
        clearTimeout(milestoneDismissTimerRef.current);
      }
    };
  }, []);

  // Check wake lock support on mount
  useEffect(() => {
    if (!isWakeLockSupported()) {
      setShowWakeLockWarning(true);
      const timer = setTimeout(() => {
        setShowWakeLockWarning(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Countdown phase
  useEffect(() => {
    if (stage === "countdown" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (stage === "countdown" && countdown === 0) {
      setStage("active");
      if (pausedElapsed > 0) {
        startTimeRef.current = Date.now() - pausedElapsed * 1000;
      } else {
        startTimeRef.current = Date.now();
      }
    }
  }, [stage, countdown, pausedElapsed]);

  // Active timer — also checks milestones
  useEffect(() => {
    if (stage === "active") {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const total = Math.floor((now - startTimeRef.current) / 1000);
        setElapsed(total);

        // Check milestones (2x, 3x, 4x)
        for (const milestone of MILESTONES) {
          const threshold = targetSeconds * milestone.multiplier;
          if (total === threshold && !milestonesFiredRef.current.has(milestone.multiplier)) {
            milestonesFiredRef.current.add(milestone.multiplier);
            fireMilestone(milestone);
          }
        }

        const shouldPrompt =
          (total === 300) ||
          (total > 300 && (total - 300) % 120 === 0);

        if (shouldPrompt) {
          clearInterval(intervalRef.current);
          setFrozenTime(total);
          setStillGoingCountdown(20);
          setStillGoingStartTime(Date.now());
          setStage("stillGoingPrompt");
          return;
        }

        if (hasPaused && total >= targetSeconds) {
          clearInterval(intervalRef.current);
          setStage("autoStopping");
        }
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stage, hasPaused, targetSeconds, fireMilestone]);

  // Auto-stop animation
  useEffect(() => {
    if (stage === "autoStopping") {
      const timer = setTimeout(() => {
        setFrozenTime(targetSeconds);
        setStage("keepRedoScreen");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stage, targetSeconds]);

  // Still Going countdown
  useEffect(() => {
    if (stage === "stillGoingPrompt") {
      stillGoingIntervalRef.current = setInterval(() => {
        setStillGoingCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(stillGoingIntervalRef.current);
            setStage("keepRedoScreen");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (stillGoingIntervalRef.current) {
        clearInterval(stillGoingIntervalRef.current);
        stillGoingIntervalRef.current = null;
      }
    }
    return () => {
      if (stillGoingIntervalRef.current) {
        clearInterval(stillGoingIntervalRef.current);
      }
    };
  }, [stage]);

  // Keep/Do-over timeout
  useEffect(() => {
    if (stage === "keepRedoScreen") {
      const timer = setTimeout(() => {
        handleRedoAttempt();
      }, 20000);
      return () => clearTimeout(timer);
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recovery timer
  useEffect(() => {
    if (stage === "paused" && currentPauseStart) {
      recoveryIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const currentPauseDuration = Math.floor(
          (now - currentPauseStart) / 1000
        );
        setCurrentRecoveryTime(currentPauseDuration);

        const newTotalRecovery = totalRecoveryUsed + currentPauseDuration;

        if (newTotalRecovery >= RECOVERY_LIMIT) {
          clearInterval(recoveryIntervalRef.current);
          setTotalRecoveryUsed(RECOVERY_LIMIT);
          setCurrentRecoveryTime(0);
          setStage("failed");
        }
      }, 100);
    } else {
      if (recoveryIntervalRef.current) {
        clearInterval(recoveryIntervalRef.current);
        recoveryIntervalRef.current = null;
      }
    }
    return () => {
      if (recoveryIntervalRef.current)
        clearInterval(recoveryIntervalRef.current);
    };
  }, [stage, currentPauseStart, totalRecoveryUsed]);

  // Wake lock management
  useEffect(() => {
    let isMounted = true;

    const ensureWakeLock = async () => {
      if (
        stage === "countdown" ||
        stage === "active" ||
        stage === "paused" ||
        stage === "autoStopping" ||
        stage === "stillGoingPrompt" ||
        stage === "keepRedoScreen"
      ) {
        if (!wakeLockRef.current) {
          const wl = await requestScreenWakeLock();
          if (isMounted) {
            wakeLockRef.current = wl;
          }
        }
      } else {
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch (err) {
            console.error("Error releasing wake lock:", err);
          }
          wakeLockRef.current = null;
        }
      }
    };

    ensureWakeLock();

    const handleVisibility = async () => {
      const hasWakeLockApi = isWakeLockSupported();

      if (
        hasWakeLockApi &&
        document.visibilityState === "visible" &&
        (stage === "countdown" ||
          stage === "active" ||
          stage === "paused" ||
          stage === "autoStopping" ||
          stage === "stillGoingPrompt" ||
          stage === "keepRedoScreen") &&
        !wakeLockRef.current
      ) {
        const wl = await requestScreenWakeLock();
        if (isMounted) {
          wakeLockRef.current = wl;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [stage]);

  const handlePause = () => {
    if (stage === "active") {
      setHasPaused(true);
      setPausedElapsed(elapsed);
      setCurrentPauseStart(Date.now());
      setCurrentRecoveryTime(0);
      const randomTip =
        RECOVERY_TIPS[Math.floor(Math.random() * RECOVERY_TIPS.length)];
      const randomEmoji =
        RECOVERY_EMOJIS[Math.floor(Math.random() * RECOVERY_EMOJIS.length)];
      setRecoveryTip(randomTip);
      setRecoveryEmoji(randomEmoji);
      setStage("paused");
    }
  };

  const handleResume = () => {
    if (stage === "paused" && currentPauseStart) {
      const pauseDuration = currentRecoveryTime;
      const newTotalRecovery = totalRecoveryUsed + pauseDuration;

      if (newTotalRecovery >= RECOVERY_LIMIT) {
        setTotalRecoveryUsed(RECOVERY_LIMIT);
        setCurrentRecoveryTime(0);
        setStage("failed");
      } else {
        setTotalRecoveryUsed(newTotalRecovery);
        setCurrentPauseStart(null);
        setCurrentRecoveryTime(0);
        setCountdown(3);
        setStage("countdown");
      }
    }
  };

  const handleDone = () => {
    dismissMilestone();
    setFrozenTime(elapsed);
    setStage("keepRedoScreen");
  };

  const handleStillGoingPressed = () => {
    const responseTime = Math.floor((Date.now() - stillGoingStartTime) / 1000);
    const actualElapsed = frozenTime + responseTime;
    setStage("active");
    startTimeRef.current = Date.now() - actualElapsed * 1000;
  };

  const handleKeepTime = async () => {
    await handleLogAttempt(frozenTime, frozenTime >= targetSeconds);
  };

  const handleRedoAttempt = () => {
    if (attemptNumber >= 3) {
      handleFailedAttempt();
      return;
    }
    onRedoUsed();
    onComplete(true);
  };

  const getCelebrationMessage = (actualValue) => {
    const overAmount = actualValue - targetSeconds;
    if (overAmount >= 15) {
      const msg =
        HIGH_CELEBRATIONS[
          Math.floor(Math.random() * HIGH_CELEBRATIONS.length)
        ];
      return `+${overAmount} seconds over goal! ${msg}`;
    } else {
      return STANDARD_CELEBRATIONS[
        Math.floor(Math.random() * STANDARD_CELEBRATIONS.length)
      ];
    }
  };

  const handleLogAttempt = async (actualValue, success) => {
    try {
      const userChallengeRef = doc(db, "userChallenges", userChallengeId);
      const userChallengeSnap = await getDoc(userChallengeRef);
      const currentData = userChallengeSnap.data() || {};

      const currentTotalDays = currentData.totalDaysAttempted || 0;
      const currentSuccessfulDays = currentData.successfulDaysCount || 0;
      const currentBest = currentData.bestPerformance || 0;
      const currentTotalSeconds = currentData.totalSuccessfulSeconds || 0;

      const newTotalDays = currentTotalDays + 1;
      const newSuccessfulDays = success
        ? currentSuccessfulDays + 1
        : currentSuccessfulDays;
      const newBest = Math.max(currentBest, success ? actualValue : 0);
      const newTotalSeconds =
        currentTotalSeconds + (success ? actualValue : 0);
      const newAverage =
        newSuccessfulDays > 0
          ? Math.round(newTotalSeconds / newSuccessfulDays)
          : 0;

      await addDoc(collection(db, "attempts"), {
        userId: userId,
        userChallengeId: userChallengeId,
        challengeId: challengeId,
        day: day,
        targetValue: targetSeconds,
        actualValue,
        success,
        missed: false,
        timestamp: Timestamp.fromDate(getPhoenixDate()),
      });

      if (success && user) {
        await updatePlankStatsOnSuccess({
          user,
          challengeId,
          actualSeconds: actualValue,
          overrideDisplayName: displayName || undefined,
          teamId: teamId || null,
        });

        const badgeResult = await updateBadgesOnCompletion({
          userId: userId,
          challengeId: challengeId,
          currentDay: day,
          actualValue: actualValue,
          targetValue: targetSeconds,
          movementType: "plank",
        });

        if (badgeResult.newBadges && badgeResult.newBadges.length > 0) {
          setNewBadges(badgeResult.newBadges);
          setShowBadgeCelebration(true);
        }
      }

      const nextDay = day + 1;

      await updateDoc(userChallengeRef, {
        currentDay: nextDay,
        lastCompletedDay: day,
        lastCompletedDate: Timestamp.fromDate(getPhoenixDate()),
        totalDaysAttempted: newTotalDays,
        successfulDaysCount: newSuccessfulDays,
        bestPerformance: newBest,
        totalSuccessfulSeconds: newTotalSeconds,
        averagePerformance: newAverage,
      });

      setStage("complete");
      setTimeout(() => {
        onComplete(false);
      }, 5000);
    } catch (error) {
      console.error("Error logging attempt:", error);
      alert("Failed to log attempt: " + (error?.message || "unknown error"));
    }
  };

  const handleFailedAttempt = async () => {
    try {
      const userChallengeRef = doc(db, "userChallenges", userChallengeId);
      const userChallengeSnap = await getDoc(userChallengeRef);
      const currentData = userChallengeSnap.data() || {};

      const currentTotalDays = currentData.totalDaysAttempted || 0;
      const newTotalDays = currentTotalDays + 1;

      await addDoc(collection(db, "attempts"), {
        userId: userId,
        userChallengeId: userChallengeId,
        challengeId: challengeId,
        day: day,
        targetValue: targetSeconds,
        actualValue: elapsed || frozenTime,
        success: false,
        missed: false,
        timestamp: Timestamp.fromDate(getPhoenixDate()),
      });

      const nextDay = day + 1;

      await updateDoc(userChallengeRef, {
        currentDay: nextDay,
        lastCompletedDay: day,
        lastCompletedDate: Timestamp.fromDate(getPhoenixDate()),
        totalDaysAttempted: newTotalDays,
      });

      setTimeout(() => {
        onComplete(false);
      }, 3000);
    } catch (error) {
      console.error("Error logging failed attempt:", error);
      onComplete(false);
    }
  };

  useEffect(() => {
    if (stage === "failed") {
      handleFailedAttempt();
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer color: Blue -> Green -> Gold -> Purple -> Orange
  const getTimerColor = () => {
    if (stage === "autoStopping") return "#22c55e";
    if (elapsed < targetSeconds) return "#3b82f6";          // Blue (under goal)
    if (elapsed < targetSeconds * 2) return "#22c55e";     // Green (goal to 2x)
    if (elapsed < targetSeconds * 3) return "#eab308";     // Gold (2x to 3x)
    if (elapsed < targetSeconds * 4) return "#a855f7";     // Purple (3x to 4x)
    return "#f97316";                                       // Orange (4x+)
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCountdownText = () => {
    if (countdown === 3) return "Ready";
    if (countdown === 2) return "Set";
    if (countdown === 1) return "Go!";
    return "";
  };

  const recoveryRemaining =
    RECOVERY_LIMIT - totalRecoveryUsed - currentRecoveryTime;

  const shouldShowPauseButton = hasPaused || elapsed < targetSeconds;

  return (
    <>
      {/* Badge Celebration Modal */}
      {showBadgeCelebration && (
        <BadgeCelebration
          badges={newBadges}
          onClose={() => setShowBadgeCelebration(false)}
        />
      )}

      {/* Confetti — renders behind the banner, above the timer */}
      {showConfetti && activeMilestone && (
        <Confetti
          style={{ position: "fixed", top: 0, left: 0, zIndex: 1010, pointerEvents: "none" }}
          width={window.innerWidth}
          height={window.innerHeight}
          numberOfPieces={220}
          recycle={false}
          gravity={0.25}
          colors={activeMilestone.confettiColors}
        />
      )}

      {/* Milestone Banner — top of screen, non-blocking */}
      {activeMilestone && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1020,
            background: activeMilestone.bg,
            padding: "18px 24px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            animation: "slideDownBanner 0.4s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "40px", lineHeight: 1 }}>{activeMilestone.emoji}</span>
            <div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: "900",
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                  textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              >
                {activeMilestone.label}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.88)",
                  marginTop: "2px",
                  fontWeight: "500",
                }}
              >
                {activeMilestone.sub}
              </div>
            </div>
          </div>
          <button
            onClick={dismissMilestone}
            style={{
              background: "rgba(255,255,255,0.25)",
              border: "none",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: "bold",
              cursor: "pointer",
              padding: "6px 12px",
              flexShrink: 0,
            }}
            aria-label="Dismiss celebration"
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideDownBanner {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--color-background)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        {/* Wake Lock Warning Banner */}
        {showWakeLockWarning && (
          <div
            style={{
              position: "absolute",
              top: "60px",
              left: "20px",
              right: "20px",
              backgroundColor: "#fbbf24",
              color: "#78350f",
              padding: "30px 24px",
              borderRadius: "12px",
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              animation: "fadeIn 0.3s ease-in",
              zIndex: 1001,
              fontWeight: "600",
            }}
          >
            <span style={{ fontSize: "28px" }}>⚠️</span>
            <span>
              Your browser may not support keeping the screen on. If your screen
              goes to sleep during the plank, the timer will pause automatically.
            </span>
          </div>
        )}

        {/* Cancel button */}
        {(stage === "countdown" || stage === "active" || stage === "paused") && (
          <button
            onClick={onCancel}
            style={{
              position: "absolute",
              top: "20px",
              left: "20px",
              background: "transparent",
              border: "none",
              color: "var(--color-text-secondary)",
              fontSize: "14px",
              cursor: "pointer",
              padding: "8px 12px",
            }}
          >
            Cancel
          </button>
        )}

        {/* COUNTDOWN PHASE */}
        {stage === "countdown" && (
          <div style={{ textAlign: "center" }}>
            {attemptNumber > 1 && (
              <div
                style={{
                  fontSize: attemptNumber === 3 ? "40px" : "20px",
                  color: "var(--color-warning)",
                  marginBottom: "40px",
                  padding: attemptNumber === 3 ? "30px" : "0",
                  backgroundColor:
                    attemptNumber === 3
                      ? "rgba(251, 191, 36, 0.2)"
                      : "transparent",
                  borderRadius: attemptNumber === 3 ? "12px" : "0",
                  fontWeight: attemptNumber === 3 ? "bold" : "normal",
                }}
              >
                {attemptNumber === 3 ? (
                  <div>
                    <div style={{ fontSize: "50px", marginBottom: "10px" }}>⚠️</div>
                    <div>Last chance today - you've got this!</div>
                  </div>
                ) : (
                  `Attempt ${attemptNumber} of 3`
                )}
              </div>
            )}
            <h1
              style={{
                fontSize: "80px",
                margin: 0,
                color: "var(--color-text)",
                fontWeight: "bold",
              }}
            >
              {getCountdownText()}
            </h1>
          </div>
        )}

        {/* ACTIVE OR PAUSED */}
        {(stage === "active" ||
          stage === "paused" ||
          stage === "autoStopping") && (
          <div
            style={{
              textAlign: "center",
              width: "100%",
              maxWidth: "500px",
              padding: "0 20px",
              // Push content down when milestone banner is showing
              marginTop: activeMilestone ? "90px" : "0",
              transition: "margin-top 0.4s ease",
            }}
          >
            {/* Subtitle */}
            <div
              style={{
                fontSize: "20px",
                color: "var(--color-text-secondary)",
                marginBottom: "20px",
              }}
            >
              Day {day} challenge Goal: {targetSeconds} seconds
            </div>

            {/* PAUSED: tip + recovery — consolidated above the timer */}
            {stage === "paused" && (
              <div
                style={{
                  marginBottom: "24px",
                  textAlign: "center",
                }}
              >
                {/* Recovery tip with randomized emoji */}
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: "bold",
                    color: "#f97316",
                    lineHeight: "1.2",
                    marginBottom: "12px",
                  }}
                >
                  {recoveryEmoji} {recoveryTip}
                </div>
                {/* Recovery remaining — turns red under 10s */}
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: recoveryRemaining <= 10 ? "#ef4444" : "var(--color-text-secondary)",
                    transition: "color 0.3s ease",
                  }}
                >
                  ⏱️ {Math.max(0, recoveryRemaining)}s remaining
                </div>
              </div>
            )}

            {/* Big Timer */}
            <div
              style={{
                fontSize: "120px",
                fontWeight: "bold",
                color: getTimerColor(),
                marginBottom: "40px",
                transition: "color 0.3s ease",
              }}
            >
              {formatTime(stage === "paused" ? pausedElapsed : elapsed)}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                alignItems: "stretch",
                width: "100%",
              }}
            >
              {stage === "active" && (
                <>
                  {!hasPaused && elapsed >= targetSeconds && (
                    <button
                      className="btn btn--primary"
                      onClick={handleDone}
                      style={{
                        fontSize: "24px",
                        padding: "20px 40px",
                        fontWeight: "bold",
                      }}
                    >
                      ✓ Done
                    </button>
                  )}
                  {shouldShowPauseButton && (
                    <button
                      className="btn btn--secondary"
                      onClick={handlePause}
                      style={{ fontSize: "20px", padding: "16px 32px" }}
                    >
                      Pause
                    </button>
                  )}
                </>
              )}
              {stage === "paused" && (
                <button
                  className="btn btn--primary"
                  onClick={handleResume}
                  style={{
                    fontSize: "24px",
                    padding: "20px 40px",
                    fontWeight: "bold",
                  }}
                >
                  Resume
                </button>
              )}
            </div>
          </div>
        )}

        {/* STILL GOING PROMPT */}
        {stage === "stillGoingPrompt" && (
          <div
            onClick={handleStillGoingPressed}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#dc2626",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1002,
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: "white",
                marginBottom: "20px",
                textAlign: "center",
                padding: "0 20px",
              }}
            >
              Still crushing it? Tap here!
            </div>
            <div
              style={{
                fontSize: "20px",
                color: "white",
                marginBottom: "40px",
                opacity: 0.9,
              }}
            >
              (Tap anywhere)
            </div>
            <div
              style={{
                fontSize: "80px",
                fontWeight: "bold",
                color: "white",
                textAlign: "center",
              }}
            >
              {stillGoingCountdown}
            </div>
            <div
              style={{
                fontSize: "24px",
                color: "white",
                marginTop: "10px",
                opacity: 0.9,
              }}
            >
              seconds
            </div>
          </div>
        )}

        {/* KEEP TIME OR DO-OVER SCREEN */}
        {stage === "keepRedoScreen" && (
          <div
            style={{
              textAlign: "center",
              width: "100%",
              maxWidth: "500px",
              padding: "0 20px",
            }}
          >
            <h2 style={{ color: "var(--color-text)", marginBottom: "20px" }}>
              Your Time
            </h2>
            <div
              style={{
                fontSize: "80px",
                fontWeight: "bold",
                color:
                  frozenTime >= targetSeconds
                    ? "var(--color-success)"
                    : "var(--color-warning)",
                marginBottom: "40px",
              }}
            >
              {formatTime(frozenTime)}
            </div>
            {frozenTime >= targetSeconds ? (
              <p
                style={{
                  fontSize: "18px",
                  color: "var(--color-text)",
                  marginBottom: "40px",
                }}
              >
                🎉 You met your goal of {targetSeconds} seconds!
              </p>
            ) : (
              <p
                style={{
                  fontSize: "18px",
                  color: "var(--color-text)",
                  marginBottom: "40px",
                }}
              >
                Goal: {targetSeconds} seconds
              </p>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                alignItems: "stretch",
                width: "100%",
              }}
            >
              <button
                className="btn btn--primary"
                onClick={handleKeepTime}
                style={{
                  fontSize: "24px",
                  padding: "20px 40px",
                  fontWeight: "bold",
                }}
              >
                ✓ Keep Time
              </button>
              <button
                className="btn btn--secondary"
                onClick={handleRedoAttempt}
                disabled={attemptNumber >= 3}
                style={{
                  fontSize: "20px",
                  padding: "16px 32px",
                  opacity: attemptNumber >= 3 ? 0.5 : 1,
                  cursor: attemptNumber >= 3 ? "not-allowed" : "pointer",
                }}
              >
                {attemptNumber >= 3 ? "No Do-Overs Left" : "🔄 Do-Over"}
              </button>
            </div>
            {attemptNumber < 3 && (
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--color-text-secondary)",
                  marginTop: "20px",
                }}
              >
                {3 - attemptNumber}{" "}
                {3 - attemptNumber === 1 ? "do-over" : "do-overs"} remaining
              </p>
            )}
          </div>
        )}

        {/* COMPLETION SCREEN */}
        {stage === "complete" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "80px", marginBottom: "20px" }}>🎉</div>
            <h2
              style={{ color: "var(--color-success)", marginBottom: "16px" }}
            >
              Day {day} challenge Complete!
            </h2>
            <p
              style={{
                fontSize: "24px",
                color: "var(--color-text)",
                fontWeight: "600",
              }}
            >
              {formatTime(frozenTime)}
            </p>
            {!hasPaused && frozenTime > targetSeconds && (
              <p
                style={{
                  fontSize: "18px",
                  color: "var(--color-primary)",
                  marginTop: "12px",
                }}
              >
                {getCelebrationMessage(frozenTime)}
              </p>
            )}
          </div>
        )}

        {/* FAILED SCREEN */}
        {stage === "failed" && (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div style={{ fontSize: "60px", marginBottom: "20px" }}>📝</div>
            <h2
              style={{ color: "var(--color-text)", marginBottom: "12px" }}
            >
              Day {day} challenge logged - tomorrow's a new opportunity!
            </h2>
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontSize: "18px",
              }}
            >
              Ready to crush Day {day + 1} challenge tomorrow!
            </p>
          </div>
        )}
      </div>
    </>
  );
}
