// src/notificationHelpers.js
import { messaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';

const VAPID_KEY = 'BHA23WO3Pq3hunM1-sYJhBYyJBnsazlhZvCFEUc3FoTh7m0RRdJBA-D8Peg0TStSCbSihARi9l7qoaJXbnynMmU';

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

export const getRandomMessage = () => {
  return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
};

// FIX: Auto-refresh FCM token on app load if permission already granted.
// Safari PWA tokens go stale after iOS updates or long background periods.
// Pass userId and array of challengeIds the user is enrolled in.
export const refreshFCMTokenIfNeeded = async (userId, challengeIds) => {
  try {
    if (!userId || !challengeIds || challengeIds.length === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

    for (const challengeId of challengeIds) {
      for (const slot of [1, 2]) {
        const reminderId = `${userId}_${challengeId}_${slot}`;
        const reminderRef = doc(db, "challengeReminders", reminderId);
        const snap = await getDoc(reminderRef);
        if (snap.exists() && snap.data().enabled && snap.data().fcmToken !== token) {
          await setDoc(reminderRef, { fcmToken: token, updatedAt: Timestamp.now() }, { merge: true });
          console.log(`🔄 Refreshed FCM token for ${reminderId}`);
        }
      }
    }
  } catch (err) {
    console.error('refreshFCMTokenIfNeeded error:', err);
  }
};

export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      return { success: false, error: 'notifications_not_supported' };
    }
    if (Notification.permission === 'denied') {
      return { success: false, error: 'permission_denied' };
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'permission_denied' };
    }
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      return { success: false, error: 'no_token' };
    }
    return { success: true, token };
  } catch (err) {
    console.error('requestNotificationPermission error:', err);
    return { success: false, error: err.message };
  }
};

export const initForegroundNotifications = () => {
  try {
    onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || 'Plank & Squat Challenge 💪';
      const body = payload?.notification?.body || getRandomMessage();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      }
    });
  } catch (err) {
    console.error('initForegroundNotifications error:', err);
  }
};

export const saveReminder = async (userId, challengeId, slot, settings) => {
  try {
    const reminderId = `${userId}_${challengeId}_${slot}`;
    const reminderRef = doc(db, 'challengeReminders', reminderId);
    await setDoc(reminderRef, {
      userId,
      challengeId,
      slot,
      enabled: settings.enabled,
      time: settings.time,
      timeZone: settings.timeZone,
      fcmToken: settings.fcmToken,
      lastSentDate: null,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('saveReminder error:', err);
    return { success: false, error: err.message };
  }
};

export const loadReminder = async (userId, challengeId, slot) => {
  try {
    const reminderId = `${userId}_${challengeId}_${slot}`;
    const reminderRef = doc(db, 'challengeReminders', reminderId);
    const snap = await getDoc(reminderRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error('loadReminder error:', err);
    return null;
  }
};

export const disableReminder = async (userId, challengeId, slot) => {
  try {
    const reminderId = `${userId}_${challengeId}_${slot}`;
    const reminderRef = doc(db, 'challengeReminders', reminderId);
    await setDoc(reminderRef, {
      userId,
      challengeId,
      slot,
      enabled: false,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('disableReminder error:', err);
    return { success: false, error: err.message };
  }
};

export const getTimeOptions = () => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour24 = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      const value = `${hour24}:${min}`;
      const period = h < 12 ? 'AM' : 'PM';
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${hour12}:${min} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
};

export const getUserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Phoenix';
  }
};
