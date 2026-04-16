// src/notificationHelpers.js
import { messaging } from './firebase';
import { getToken } from 'firebase/messaging';
import { db } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';

const VAPID_KEY = 'BHA23WO3Pq3hunM1-sYJhBYyJBnsazlhZvCFEUc3FoTh7m0RRdJBA-D8Peg0TStSCbSihARi9l7qoaJXbnynMmU';

// Motivational messages — randomly picked for each notification
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

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      return { success: false, error: 'notifications_not_supported' };
    }

    // If already denied, can't re-request
    if (Notification.permission === 'denied') {
      return { success: false, error: 'permission_denied' };
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'permission_denied' };
    }

    // Get FCM token
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

// Save reminder settings to Firestore
// reminderId format: userId_challengeId_slot (slot = 1 or 2)
export const saveReminder = async (userId, challengeId, slot, settings) => {
  try {
    const reminderId = `${userId}_${challengeId}_${slot}`;
    const reminderRef = doc(db, 'challengeReminders', reminderId);
    await setDoc(reminderRef, {
      userId,
      challengeId,
      slot,
      enabled: settings.enabled,
      time: settings.time,           // "07:30" 24-hour format
      timeZone: settings.timeZone,   // e.g. "America/Phoenix"
      fcmToken: settings.fcmToken,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('saveReminder error:', err);
    return { success: false, error: err.message };
  }
};

// Load reminder settings from Firestore
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

// Disable a reminder slot
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

// Generate 30-minute increment time options for picker (12:00 AM - 11:30 PM)
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

// Detect user's local timezone
export const getUserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/Phoenix';
  }
};
