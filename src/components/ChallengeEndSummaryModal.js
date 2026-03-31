// src/components/ChallengeEndSummaryModal.js
import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import BadgeDisplay from "./BadgeDisplay";

/**
 * ChallengeEndSummaryModal
 * Shown once per completed challenge (seenEndSummary !== true).
 * Shows rank hero with confetti, earned badges, stats, and two action buttons.
 */
export default function ChallengeEndSummaryModal({ userChallenge, badges, onDismiss, onSeeLeaderboard }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [rankVisible, setRankVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const challengeDetails = userChallenge.challengeDetails;
  const isPlank = challengeDetails?.type === "plank";
  const finalRank = userChallenge.finalRank ?? null;
  const totalParticipants = userChallenge.totalParticipants ?? null;
  const isTop3 = finalRank != null && finalRank <= 3;

  // Format seconds as "Xm Ys" or "Xs"
  const formatSeconds = (sec) => {
    const s = Number(sec) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  };

  // Staggered entrance: rank animates in, then confetti fires
  useEffect(() => {
    const t1 = setTimeout(() => setRankVisible(true), 300);
    const t2 = setTimeout(() => {
      if (finalRank != null) setShowConfetti(true);
    }, 700);
    const t3 = setTimeout(() => setShowConfetti(false), isTop3 ? 6000 : 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [finalRank, isTop3]);

  const handleDismiss = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "userChallenges", userChallenge.userChallengeId), {
        seenEndSummary: true,
      });
    } catch (err) {
      console.error("Error marking seenEndSummary:", err);
    } finally {
      setSaving(false);
      onDismiss();
    }
  };

  const handleSeeLeaderboard = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "userChallenges", userChallenge.userChallengeId), {
        seenEndSummary: true,
      });
    } catch (err) {
      console.error("Error marking seenEndSummary:", err);
    } finally {
      setSaving(false);
      onSeeLeaderboard(challengeDetails?.type === "plank" ? "plank" : "squat", userChallenge.challengeId);
    }
  };

  // Rank medal emoji
  const rankMedal = finalRank === 1 ? "🥇" : finalRank === 2 ? "🥈" : finalRank === 3 ? "🥉" : null;

  // Has any earned badges
  const hasBadges = badges && (
    (badges.completedStreakBadges && Object.values(badges.completedStreakBadges).some((v) => v > 0)) ||
    (badges.doubleBadgeCount > 0) ||
    (badges.tripleBadgeCount > 0) ||
    (badges.quadrupleBadgeCount > 0) ||
    (badges.timeBadges && badges.timeBadges.length > 0)
  );

  return (
    <>
      {showConfetti && (
        <Confetti
          style={{ position: "fixed", top: 0, left: 0, zIndex: 3010, pointerEvents: "none" }}
          width={window.innerWidth}
          height={window.innerHeight}
          numberOfPieces={isTop3 ? 350 : 180}
          recycle={false}
          gravity={0.22}
          colors={
            isTop3
              ? ["#fbbf24", "#f59e0b", "#34d399", "#60a5fa", "#ffffff", "#a78bfa"]
              : ["#34d399", "#60a5fa", "#ffffff", "#f472b6"]
          }
        />
      )}

      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 3000,
          padding: "16px",
          animation: "fadeInBackdrop 0.3s ease-in",
        }}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "20px",
            padding: "32px 24px",
            maxWidth: "420px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
            animation: "scaleInModal 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏁</div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", color: "#1f2937" }}>
              Challenge Complete!
            </h2>
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
              {challengeDetails?.name}
            </p>
          </div>

          {/* Rank Hero */}
          <div
            style={{
              background: isTop3
                ? "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)"
                : "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
              borderRadius: "16px",
              padding: "24px 16px",
              textAlign: "center",
              marginBottom: "20px",
              border: isTop3 ? "2px solid #f59e0b" : "2px solid #93c5fd",
              transform: rankVisible ? "scale(1)" : "scale(0.85)",
              opacity: rankVisible ? 1 : 0,
              transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease",
            }}
          >
            {finalRank != null ? (
              <>
                {rankMedal && (
                  <div style={{ fontSize: "48px", marginBottom: "8px", animation: rankVisible ? "bounceIn 0.6s ease" : "none" }}>
                    {rankMedal}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "56px",
                    fontWeight: "900",
                    color: isTop3 ? "#92400e" : "#1e40af",
                    lineHeight: 1,
                    marginBottom: "8px",
                    animation: rankVisible ? "bounceIn 0.6s ease 0.1s backwards" : "none",
                  }}
                >
                  #{finalRank}
                </div>
                <div style={{ fontSize: "16px", color: "#374151", fontWeight: "600" }}>
                  of {totalParticipants} participant{totalParticipants !== 1 ? "s" : ""}
                </div>
                {isTop3 && (
                  <div style={{ fontSize: "13px", color: "#92400e", marginTop: "6px", fontWeight: "500" }}>
                    🔥 Top {Math.round((finalRank / totalParticipants) * 100)}% of participants!
                  </div>
                )}
              </>
            ) : (
              <div>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>⏳</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#1e40af" }}>
                  Rank: TBD
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                  Updates at midnight MST
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {[
              {
                label: isPlank ? "Best" : "Best",
                value: isPlank
                  ? formatSeconds(userChallenge.bestPerformance || 0)
                  : `${userChallenge.bestPerformance || 0} reps`,
              },
              {
                label: "Avg",
                value: isPlank
                  ? formatSeconds(userChallenge.averagePerformance || 0)
                  : `${userChallenge.averagePerformance || 0} reps`,
              },
              {
                label: "Days",
                value: `${userChallenge.successfulDaysCount || 0}/${challengeDetails?.numberOfDays || 0}`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "10px",
                  padding: "12px 8px",
                  textAlign: "center",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", marginBottom: "4px" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#111827" }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Badges */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "24px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "12px" }}>
              📋 Challenge Badges Earned
            </div>
            {hasBadges && badges ? (
              <BadgeDisplay
                currentStreak={badges.currentStreak || 0}
                currentStreakBadgeLevel={badges.currentStreakBadgeLevel || 0}
                completedStreakBadges={badges.completedStreakBadges || { 3: 0, 7: 0, 14: 0, 21: 0, 28: 0 }}
                doubleBadgeCount={badges.doubleBadgeCount || 0}
                tripleBadgeCount={badges.tripleBadgeCount || 0}
                quadrupleBadgeCount={badges.quadrupleBadgeCount || 0}
                timeBadges={badges.timeBadges || []}
                totalPlankSeconds={badges.totalPlankSeconds || 0}
                showProgress={false}
                compact={true}
              />
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>
                No badges earned this challenge
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleSeeLeaderboard}
              disabled={saving}
              style={{
                padding: "14px",
                fontSize: "16px",
                fontWeight: "700",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              🏆 See Leaderboard
            </button>
            <button
              onClick={handleDismiss}
              disabled={saving}
              style={{
                padding: "12px",
                fontSize: "15px",
                fontWeight: "600",
                backgroundColor: "white",
                color: "#6b7280",
                border: "2px solid #e5e7eb",
                borderRadius: "12px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleInModal {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}
