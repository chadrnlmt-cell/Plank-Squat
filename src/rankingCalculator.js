// src/rankingCalculator.js
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

/**
 * Calculate and store final rankings for all participants in a challenge.
 * This is called lazily when the first user views an ended challenge.
 * 
 * @param {string} challengeId - The challenge ID to calculate rankings for
 * @param {string} challengeType - Either 'plank' or 'squat'
 * @returns {Promise<void>}
 */
export async function calculateChallengeRankings(challengeId, challengeType) {
  try {
    console.log('Calculating rankings for challenge:', challengeId);

    // Get all challengeUserStats for this challenge
    const statsQuery = query(
      collection(db, "challengeUserStats"),
      where("challengeId", "==", challengeId)
    );
    const statsSnapshot = await getDocs(statsQuery);

    if (statsSnapshot.empty) {
      console.log('No participants found');
      return;
    }

    // Get all userChallenges for this challenge to get totalDaysAttempted
    const userChallengesQuery = query(
      collection(db, "userChallenges"),
      where("challengeId", "==", challengeId)
    );
    const userChallengesSnapshot = await getDocs(userChallengesQuery);

    // Build a map of userId -> userChallenge data
    const userChallengeMap = {};
    userChallengesSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      userChallengeMap[data.userId] = {
        docId: docSnap.id,
        totalDaysAttempted: data.totalDaysAttempted || 0,
        successfulDaysCount: data.successfulDaysCount || 0,
      };
    });

    // Build array of participant data
    const participants = [];
    statsSnapshot.docs.forEach((docSnap) => {
      const stats = docSnap.data();
      const userChallengeData = userChallengeMap[stats.userId];

      if (!userChallengeData) return; // Skip if no userChallenge found

      participants.push({
        userId: stats.userId,
        userChallengeDocId: userChallengeData.docId,
        bestValue: challengeType === 'plank' ? (stats.bestSeconds || 0) : (stats.bestReps || 0),
        totalDaysAttempted: userChallengeData.totalDaysAttempted,
        firstAchievedAt: stats.firstAchievedAt,
      });
    });

    // Sort participants by ranking criteria
    participants.sort((a, b) => {
      // Primary: best value (higher is better)
      if (b.bestValue !== a.bestValue) {
        return b.bestValue - a.bestValue;
      }

      // Tiebreaker 1: total days attempted (more is better)
      if (b.totalDaysAttempted !== a.totalDaysAttempted) {
        return b.totalDaysAttempted - a.totalDaysAttempted;
      }

      // Tiebreaker 2: who achieved their best first (earlier is better)
      const aTime = a.firstAchievedAt?.toMillis ? a.firstAchievedAt.toMillis() : Infinity;
      const bTime = b.firstAchievedAt?.toMillis ? b.firstAchievedAt.toMillis() : Infinity;
      return aTime - bTime;
    });

    // Assign ranks and update all userChallenges documents
    const totalParticipants = participants.length;
    const updatePromises = [];
    const now = Timestamp.now();

    participants.forEach((participant, index) => {
      const rank = index + 1;
      const userChallengeRef = doc(db, "userChallenges", participant.userChallengeDocId);
      
      updatePromises.push(
        updateDoc(userChallengeRef, {
          finalRank: rank,
          totalParticipants: totalParticipants,
          rankCalculatedAt: now,
        })
      );
    });

    await Promise.all(updatePromises);
    console.log(`Successfully calculated rankings for ${totalParticipants} participants`);

  } catch (error) {
    console.error('Error calculating challenge rankings:', error);
    throw error;
  }
}
