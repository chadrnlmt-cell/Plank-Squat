// src/components/PlankTimer.js
import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { getPhoenixDate } from "../utils";
import { updatePlankStatsOnSuccess } from "../statsHelpers";

// simple helper to request/release screen wake lock
// Uses the Screen Wake Lock API if supported by the browser.[web:17][web:18][web:39]
async function requestScreenWakeLock() {
  try {
    // extra defensive checks so we don't crash on older browsers
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

export default function PlankTimer({
  targetSeconds,
  day,
  userChallengeId,
  challengeId,
  userId,
  user,
  displayName, // profile display name from App
  numberOfDays,
  onComplete,
  onCancel,
}) {
  const [stage, setStage] = useState("countdown"); // countdown | active | paused | autoStopping | complete | failed
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [totalRecoveryUsed, setTotalRecoveryUsed] = useState(0);
  const [currentPauseStart, setCurrentPauseStart] = useState(null);
  const [currentRecoveryTime, setCurrentRecoveryTime] = useState(0);
  const [hasPaused, setHasPaused] = useState(false);
  const [pausedElapsed, setPausedElapsed] = useState(0);

  const intervalRef = useRef(null);
  const recoveryIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // store wake lock sentinel so we can release it later
  const wakeLockRef = useRef(null);

  const RECOVERY_LIMIT = 60;

  // Countdown phase: Ready (1s), Set (1s), Go (1s)
  useEffect(() => {
    if (stage === "countdown" && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (stage === "countdown" && countdown === 0) {
      setStage("active");
      // If resuming from pause, adjust start time to continue from pausedElapsed
      if (pausedElapsed > 0) {
        startTimeRef.current = Date.now() - pausedElapsed * 1000;
      } else {
        startTimeRef.current = Date.now();
      }
    }
  }, [stage, countdown, pausedElapsed]);

  // Active timer - counts up
  useEffect(() => {
    if (stage === "active") {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const total = Math.floor((now - startTimeRef.current) / 1000);
        setElapsed(total);

        // If they paused before and hit goal, AUTO-STOP
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
  }, [stage, hasPaused, targetSeconds]);

  // Auto-stop animation (flash green 0.5s, then complete)
  useEffect(() => {
    if (stage === "autoStopping") {
      const timer = setTimeout(() => {
        handleLogAttempt(targetSeconds, true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stage, targetSeconds]);

  // Recovery timer (when paused)
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

  // Handle visibility change (tab switch, minimize) - auto-pause
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && stage === "active") {
        handlePause();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stage, elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle wake lock when stage changes
  useEffect(() => {
    let isMounted = true;

    const ensureWakeLock = async () => {
      // Only try to keep screen on while plank is actually running.[web:17][web:20]
      if (stage === "active" || stage === "autoStopping") {
        if (!wakeLockRef.current) {
          const wl = await requestScreenWakeLock();
          if (isMounted) {
            wakeLockRef.current = wl;
          }
        }
      } else {
        // For countdown, paused, complete, failed, or when leaving:
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
      // extra guard so we don't call the API where it doesn't exist[web:16][web:39]
      const hasWakeLockApi =
        typeof navigator !== "undefined" &&
        "wakeLock" in navigator &&
        navigator.wakeLock &&
        typeof navigator.wakeLock.request === "function";

      if (
        hasWakeLockApi &&
        document.visibilityState === "visible" &&
        (stage === "active" || stage === "autoStopping") &&
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

        // Do another Ready, Set, Go countdown
        setCountdown(3);
        setStage("countdown");
      }
    }
  };

  const handleDone = async () => {
    // Manual stop (never paused, going past goal)
    await handleLogAttempt(elapsed, elapsed >= targetSeconds);
  };

  const handleLogAttempt = async (actualValue, success) => {
    try {
      // Log attempt
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

      // If success, update stats with overrideDisplayName so leaderboard uses profile name
      if (success && user) {
        await updatePlankStatsOnSuccess({
          user,
          challengeId,
          actualSeconds: actualValue,
          overrideDisplayName: displayName || undefined,
        });
      }

      // Update userChallenge
      const nextDay = day + 1;
      const isComplete = nextDay > numberOfDays;

      await updateDoc(doc(db, "userChallenges", userChallengeId), {
        currentDay: nextDay,
        lastCompletedDay: day,
        lastCompletedDate: Timestamp.fromDate(getPhoenixDate()),
        status: isComplete ? "completed" : "active",
      });

      setStage("complete");
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Error logging attempt:", error);
      alert("Failed to log attempt: " + (error?.message || "unknown error"));
    }
  };

  const handleFailedAttempt = async () => {
    // Recovery expired - log failed attempt
    try {
      await addDoc(collection(db, "attempts"), {
        userId: userId,
        userChallengeId: userChallengeId,
        challengeId: challengeId,
        day: day,
        targetValue: targetSeconds,
        actualValue: elapsed,
        success: false,
        missed: false, // "failed" during the day, not a no‑show
        timestamp: Timestamp.fromDate(getPhoenixDate()),
      });

      // Don't advance day - they can try again tomorrow
      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (error) {
      console.error("Error logging failed attempt:", error);
      onComplete();
    }
  };

  // Call handleFailedAttempt when stage becomes "failed"
  useEffect(() => {
    if (stage === "failed") {
      handleFailedAttempt();
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTimerColor = () => {
    if (stage === "autoStopping") return "#22c55e"; // Green flash
    if (elapsed < targetSeconds * 0.5) return "#3b82f6"; // Blue - under halfway
    if (elapsed < targetSeconds) return "#3b82f6"; // Blue - still under goal
    if (elapsed < targetSeconds * 2) return "#22c55e"; // Green - at goal up to double
    return "#eab308"; // Gold - doubled goal!
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

  // Recovery remaining calculation
  const recoveryRemaining =
    RECOVERY_LIMIT - totalRecoveryUsed - currentRecoveryTime;

  return (
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
      {/* Cancel button (top-left) - only during countdown and active */}
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

      {/* COUNTDOWN PHASE: Ready, Set, Go */}
      {stage === "countdown" && (
        <div style={{ textAlign: "center" }}>
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

      {/* ACTIVE OR PAUSED PHASE */}
      {(stage === "active" ||
        stage === "paused" ||
        stage === "autoStopping") && (
        <div
          style={{
            textAlign: "center",
            width: "100%",
            maxWidth: "500px",
            padding: "0 20px",
          }}
        >
          {/* Goal Display */}
          <div
            style={{
              fontSize: "20px",
              color: "var(--color-text-secondary)",
              marginBottom: "40px",
            }}
          >
            Day {day} Goal: {targetSeconds} seconds
          </div>

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

          {/* Paused Status */}
          {stage === "paused" && (
            <div
              style={{
                fontSize: "24px",
                color: "var(--color-warning)",
                marginBottom: "30px",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: "bold" }}>⏸️ PAUSED</div>
              <div
                style={{
                  fontSize: "18px",
                  marginTop: "12px",
                  color: "var(--color-text-secondary)",
                }}
              >
                Recovery: {formatTime(Math.max(0, recoveryRemaining))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "stretch",
              width: "100%",
            }}
          >
            {/* Active - always show Pause button, and Done button if past goal */}
            {stage === "active" && (
              <>
                {/* Done button - only show if past goal and never paused */}
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

                {/* Pause button - always available during active */}
                <button
                  className="btn btn--secondary"
                  onClick={handlePause}
                  style={{
                    fontSize: "20px",
                    padding: "16px 32px",
                  }}
                >
                  Pause
                </button>
              </>
            )}

            {/* Paused - show Resume */}
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

      {/* COMPLETION SCREEN */}
      {stage === "complete" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "80px", marginBottom: "20px" }}>🎉</div>
          <h2 style={{ color: "var(--color-success)", marginBottom: "16px" }}>
            Day {day} Complete!
          </h2>
          <p
            style={{
              fontSize: "24px",
              color: "var(--color-text)",
              fontWeight: "600",
            }}
          >
            {formatTime(elapsed >= targetSeconds ? elapsed : targetSeconds)}
          </p>
          {!hasPaused && elapsed > targetSeconds && (
            <p
              style={{
                fontSize: "18px",
                color: "var(--color-primary)",
                marginTop: "12px",
              }}
            >
              +{elapsed - targetSeconds} seconds over goal! 💪
            </p>
          )}
        </div>
      )}

      {/* FAILED SCREEN (Recovery Expired) */}
      {stage === "failed" && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>😓</div>
          <h2 style={{ color: "var(--color-error)", marginBottom: "12px" }}>
            Day {day} - Not Completed Today
          </h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "18px" }}>
            Recovery time expired. Try again tomorrow!
          </p>
        </div>
      )}
    </div>
  );
}
