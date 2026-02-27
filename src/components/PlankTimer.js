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

// Simple helper to request/release screen wake lock
// Uses the Screen Wake Lock API if supported by the browser.
async function requestScreenWakeLock() {
  try {
    // Extra defensive checks so we don't crash on older browsers
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

// Check if wake lock is supported
function isWakeLockSupported() {
  return (
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    navigator.wakeLock &&
    typeof navigator.wakeLock.request === "function"
  );
}

// Recovery tip messages (rotate randomly)
const RECOVERY_TIPS = [
  "Take some deep breaths",
  "Stretch those muscles",
  "Shake it out and reset",
  "Stay strong, you've got this",
];

// High celebration messages (+15s or more over goal)
const HIGH_CELEBRATIONS = [
  "Crushing it! 💪",
  "You're on fire! 🔥",
  "Beast mode! 💪",
  "Incredible! 🌟",
  "Unstoppable! 💪",
  "Next level! 🚀",
  "Keep dominating! 💪",
];

// Standard celebration messages (goal met, under +15s)
const STANDARD_CELEBRATIONS = [
  "Goal achieved! Well done! ✓",
  "Target reached! Nice job!",
  "You did it! Goal accomplished!",
  "Success! You met today's goal!",
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
  attemptNumber, // 1, 2, or 3
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

  // Anti-cheating states
  const [stillGoingCountdown, setStillGoingCountdown] = useState(20); // 20 second countdown
  const [frozenTime, setFrozenTime] = useState(0); // Time when frozen (for Keep/Do-over screen)
  const [showWakeLockWarning, setShowWakeLockWarning] = useState(false);
  const [stillGoingStartTime, setStillGoingStartTime] = useState(null); // Track when prompt started

  const intervalRef = useRef(null);
  const recoveryIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const stillGoingIntervalRef = useRef(null);

  // Store wake lock sentinel so we can release it later
  const wakeLockRef = useRef(null);

  const RECOVERY_LIMIT = 60;

  // Check wake lock support on mount and show warning if not supported
  useEffect(() => {
    if (!isWakeLockSupported()) {
      setShowWakeLockWarning(true);
      const timer = setTimeout(() => {
        setShowWakeLockWarning(false);
      }, 5000); // Hide after 5 seconds
      return () => clearTimeout(timer);
    }
  }, []);

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

        // Check for "Still Going?" prompts (at 5min, then every 2min AFTER 5min)
        const shouldPrompt = 
          (total === 300) || // 5 minutes
          (total > 300 && (total - 300) % 120 === 0); // Every 2 minutes AFTER the 5min mark (7, 9, 11...)
        
        if (shouldPrompt) {
          clearInterval(intervalRef.current);
          setFrozenTime(total);
          setStillGoingCountdown(20);
          setStillGoingStartTime(Date.now()); // Record when prompt started
          setStage("stillGoingPrompt");
          return;
        }

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

  // Auto-stop animation (flash green 0.5s, then show Keep/Do-over)
  useEffect(() => {
    if (stage === "autoStopping") {
      const timer = setTimeout(() => {
        setFrozenTime(targetSeconds);
        setStage("keepRedoScreen");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stage, targetSeconds]);

  // "Still Going?" countdown timer
  useEffect(() => {
    if (stage === "stillGoingPrompt") {
      stillGoingIntervalRef.current = setInterval(() => {
        setStillGoingCountdown((prev) => {
          if (prev <= 1) {
            // Time's up - they missed it - DON'T add the 20 seconds penalty
            clearInterval(stillGoingIntervalRef.current);
            // Just use the frozen time without adding response time
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

  // Keep/Do-over screen timeout (20 seconds)
  useEffect(() => {
    if (stage === "keepRedoScreen") {
      const timer = setTimeout(() => {
        // Timeout - same behavior as clicking do-over
        handleRedoAttempt();
      }, 20000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

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

  // Handle wake lock when stage changes
  useEffect(() => {
    let isMounted = true;

    const ensureWakeLock = async () => {
      // Keep screen on during all these stages
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
        // For complete, failed, or when leaving:
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
      // Extra guard so we don't call the API where it doesn't exist
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
      // Select random recovery tip
      const randomTip = RECOVERY_TIPS[Math.floor(Math.random() * RECOVERY_TIPS.length)];
      setRecoveryTip(randomTip);
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

  const handleDone = () => {
    // Manual stop (never paused, going past goal)
    setFrozenTime(elapsed);
    setStage("keepRedoScreen");
  };

  const handleStillGoingPressed = () => {
    // User confirmed they're still going - calculate actual elapsed time
    const responseTime = Math.floor((Date.now() - stillGoingStartTime) / 1000);
    const actualElapsed = frozenTime + responseTime;
    
    // Resume timer from actual elapsed time (frozen time + response time)
    setStage("active");
    startTimeRef.current = Date.now() - actualElapsed * 1000;
  };

  const handleKeepTime = async () => {
    // User chose to keep their time - log it as success
    await handleLogAttempt(frozenTime, frozenTime >= targetSeconds);
  };

  const handleRedoAttempt = () => {
    if (attemptNumber >= 3) {
      // Already on 3rd attempt, no more do-overs
      // Log as failed and advance to next day
      handleFailedAttempt();
      return;
    }

    // Do-over requested - increment attempt number and return to Active tab
    onRedoUsed(); // Increment attempt number in App.js
    onComplete(true); // Pass true to indicate this is a do-over (don't reset attemptNumber)
  };

  const getCelebrationMessage = (actualValue) => {
    const overAmount = actualValue - targetSeconds;
    if (overAmount >= 15) {
      // High celebration
      const msg = HIGH_CELEBRATIONS[Math.floor(Math.random() * HIGH_CELEBRATIONS.length)];
      return `+${overAmount} seconds over goal! ${msg}`;
    } else {
      // Standard celebration
      return STANDARD_CELEBRATIONS[Math.floor(Math.random() * STANDARD_CELEBRATIONS.length)];
    }
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

      // If success, update stats with overrideDisplayName and teamId
      if (success && user) {
        await updatePlankStatsOnSuccess({
          user,
          challengeId,
          actualSeconds: actualValue,
          overrideDisplayName: displayName || undefined,
          teamId: teamId || null,
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
        onComplete(false); // Pass false - day actually completed, reset attemptNumber
      }, 2000);
    } catch (error) {
      console.error("Error logging attempt:", error);
      alert("Failed to log attempt: " + (error?.message || "unknown error"));
    }
  };

  const handleFailedAttempt = async () => {
    // Recovery expired or 3rd attempt timeout - log failed attempt AND advance day
    try {
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

      // Advance to next day (same as success, but without updating stats)
      const nextDay = day + 1;
      const isComplete = nextDay > numberOfDays;

      await updateDoc(doc(db, "userChallenges", userChallengeId), {
        currentDay: nextDay,
        lastCompletedDay: day,
        lastCompletedDate: Timestamp.fromDate(getPhoenixDate()),
        status: isComplete ? "completed" : "active",
      });

      setTimeout(() => {
        onComplete(false); // Pass false - day failed but completed, reset attemptNumber
      }, 3000);
    } catch (error) {
      console.error("Error logging failed attempt:", error);
      onComplete(false);
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

  // Determine if we should show pause button
  const shouldShowPauseButton = hasPaused || elapsed < targetSeconds;

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
          {attemptNumber > 1 && (
            <div
              style={{
                fontSize: attemptNumber === 3 ? "40px" : "20px",
                color: "var(--color-warning)",
                marginBottom: "40px",
                padding: attemptNumber === 3 ? "30px" : "0",
                backgroundColor: attemptNumber === 3 ? "rgba(251, 191, 36, 0.2)" : "transparent",
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
            Day {day} challenge Goal: {targetSeconds} seconds
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

          {/* Paused Status with Recovery Tip */}
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
                Recovery: {formatTime(Math.max(0, recoveryRemaining))} - {recoveryTip}
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
            {/* Active - show Done button if past goal and never paused */}
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

                {/* Pause button - only show if haven't paused yet OR still under goal */}
                {shouldShowPauseButton && (
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
                )}
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

      {/* STILL GOING PROMPT - Full Screen RED Button */}
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
          {/* Main Message */}
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

          {/* Countdown */}
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

          {/* Display the time */}
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
            <p style={{ fontSize: "18px", color: "var(--color-text)", marginBottom: "40px" }}>
              🎉 You met your goal of {targetSeconds} seconds!
            </p>
          ) : (
            <p style={{ fontSize: "18px", color: "var(--color-text)", marginBottom: "40px" }}>
              Goal: {targetSeconds} seconds
            </p>
          )}

          {/* Buttons */}
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
              {3 - attemptNumber} {3 - attemptNumber === 1 ? "do-over" : "do-overs"} remaining
            </p>
          )}
        </div>
      )}

      {/* COMPLETION SCREEN */}
      {stage === "complete" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "80px", marginBottom: "20px" }}>🎉</div>
          <h2 style={{ color: "var(--color-success)", marginBottom: "16px" }}>
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

      {/* FAILED SCREEN (Recovery Expired or 3rd attempt timeout) */}
      {stage === "failed" && (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "60px", marginBottom: "20px" }}>📝</div>
          <h2 style={{ color: "var(--color-text)", marginBottom: "12px" }}>
            Day {day} challenge logged - tomorrow's a new opportunity!
          </h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "18px" }}>
            Ready to crush Day {day + 1} challenge tomorrow!
          </p>
        </div>
      )}
    </div>
  );
}
