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

// Snap actual current time to the nearest :00 or :30 in the user's timezone.
// Cloud Scheduler can drift by up to ~18 minutes — snapping means a 1:00 PM
// reminder always matches the 1:00 run, never the 1:18 drift.
const getSnappedMinutesSinceMidnight = (timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === "hour").value, 10);
    const m = parseInt(parts.find((p) => p.type === "minute").value, 10);
    // Snap minute to nearest 0 or 30
    const snappedM = m < 15 ? 0 : m < 45 ? 30 : 0;
    const snappedH = m >= 45 ? (h + 1) % 24 : h;
    return snappedH * 60 + snappedM;
  } catch {
    return null;
  }
};

const parseTimeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const getTodayInTimeZone = (timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year").value;
    const mo = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    return `${y}-${mo}-${d}`;
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

// Fires at exactly :00 and :30 UTC every hour.
// We snap the user's local time to nearest :00/:30 before comparing,
// so scheduler drift never affects when the user receives the notification.
exports.sendChallengeReminders = onSchedule("0,30 * * * *", async () => {
  const db = getFirestore();
  const messaging = getMessaging();

  const snapshot = await db
    .collection("challengeReminders")
    .where("enabled", "==", true)
    .get();

  if (snapshot.empty) {
    console.log("No enabled reminders found.");
    return;
  }

  const sends = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const { fcmToken, time, timeZone, lastSentDate } = data;

    if (!fcmToken || !time || !timeZone) return;

    const today = getTodayInTimeZone(timeZone);
    if (lastSentDate === today) return;

    // Use snapped time — ignores scheduler drift completely
    const snappedMinutes = getSnappedMinutesSinceMidnight(timeZone);
    if (snappedMinutes === null) return;

    const reminderMinutes = parseTimeToMinutes(time);

    // Exact match only — snapped time must equal the set reminder time
    if (snappedMinutes !== reminderMinutes) return;

    const message = getRandomMessage();
    console.log(`🕐 Snapped time ${snappedMinutes} matches reminder ${reminderMinutes} for ${data.userId}`);

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
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              vibrate: [200, 100, 200],
            },
            fcm_options: {
              link: "https://plank-squat.vercel.app",
            },
          },
        })
        .then(async () => {
          await db.collection("challengeReminders").doc(docSnap.id).update({
            lastSentDate: today,
            lastSentAt: Timestamp.now(),
          });
          console.log(`✅ Sent reminder to ${data.userId} for challenge ${data.challengeId}`);
        })
        .catch((err) => {
          console.error(`❌ Failed to send to ${data.userId}:`, err.message);
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
