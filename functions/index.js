const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const MOTIVATIONAL_MESSAGES = [
  "Time to crush today's challenge! 💪",
  "Small effort today, stronger tomorrow. 🔥",
  "Your streak is waiting — let's go! 🏆",
  "30 seconds of courage changes everything. ⚡",
  "Don't break the chain — you've got this! 🔗",
  "Today's challenge is calling your name! 🎯",
  "Stronger every day — one rep at a time. 💥",
  "Your future self thanks you. Go get it! 🚀",
];

const getRandomMessage = () =>
  MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

// Returns current time in minutes-since-midnight for a given IANA timezone
const getMinutesSinceMidnight = (timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === "hour").value, 10);
    const m = parseInt(parts.find((p) => p.type === "minute").value, 10);
    return h * 60 + m;
  } catch {
    return null;
  }
};

// Parse "HH:MM" string to minutes since midnight
const parseTimeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

// Runs every 30 minutes — checks challengeReminders for any that fall within the current window
exports.sendChallengeReminders = onSchedule("every 30 minutes", async () => {
  const db = getFirestore();
  const messaging = getMessaging();

  // Get all enabled reminders
  const snapshot = await db
    .collection("challengeReminders")
    .where("enabled", "==", true)
    .get();

  if (snapshot.empty) {
    console.log("No enabled reminders found.");
    return;
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const sends = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const { fcmToken, time, timeZone, lastSentDate } = data;

    if (!fcmToken || !time || !timeZone) return;

    // Don't send twice in the same day
    if (lastSentDate === today) return;

    const currentMinutes = getMinutesSinceMidnight(timeZone);
    if (currentMinutes === null) return;

    const reminderMinutes = parseTimeToMinutes(time);

    // FIX: Widened window to 35 minutes to account for Cloud Scheduler drift/cold starts.
    // Previously 30 min window meant if function ran at :31 for a :00 reminder, it was missed.
    const diff = currentMinutes - reminderMinutes;
    if (diff < 0 || diff >= 35) return;

    const message = getRandomMessage();

    sends.push(
      messaging
        .send({
          token: fcmToken,
          notification: {
            title: "Plank & Squat Challenge 💪",
            body: message,
          },
          webpush: {
            notification: {
              // FIX: corrected icon path to match actual file in public root
              icon: "/icon-192.svg",
              badge: "/icon-192.svg",
              vibrate: [200, 100, 200],
            },
            fcm_options: {
              link: "https://plank-squat.vercel.app",
            },
          },
        })
        .then(async () => {
          // Mark as sent today so we don't double-send
          await db.collection("challengeReminders").doc(docSnap.id).update({
            lastSentDate: today,
            lastSentAt: Timestamp.now(),
          });
          console.log(`✅ Sent reminder to ${data.userId} for challenge ${data.challengeId}`);
        })
        .catch((err) => {
          console.error(`❌ Failed to send to ${data.userId}:`, err.message);
          // If token is invalid, disable the reminder
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            db.collection("challengeReminders").doc(docSnap.id).update({
              enabled: false,
            });
          }
        })
    );
  });

  await Promise.allSettled(sends);
  console.log(`Processed ${sends.length} reminder(s).`);
});
