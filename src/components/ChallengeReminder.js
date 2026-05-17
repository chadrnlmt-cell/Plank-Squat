// src/components/ChallengeReminder.js
import React, { useState, useEffect } from 'react';
import {
  requestNotificationPermission,
  saveReminder,
  loadReminder,
  disableReminder,
  getTimeOptions,
  getUserTimeZone,
} from '../notificationHelpers';

const TIME_OPTIONS = getTimeOptions();

// Detect iOS Safari running outside of PWA (Home Screen) mode
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.navigator.standalone === true;
const isIOSBrowser = isIOS && !isInStandaloneMode;

export default function ChallengeReminder({ userId, challengeId, challengeName, challengeActive = true }) {
  const [expanded, setExpanded] = useState(false);

  // slot 1 state
  const [slot1Enabled, setSlot1Enabled] = useState(false);
  const [slot1Time, setSlot1Time] = useState('07:00');
  const [slot1Saving, setSlot1Saving] = useState(false);
  const [slot1Status, setSlot1Status] = useState(''); // '' | 'saved' | 'error' | 'denied' | 'unsupported'

  // slot 2 state
  const [slot2Enabled, setSlot2Enabled] = useState(false);
  const [slot2Time, setSlot2Time] = useState('19:00');
  const [slot2Saving, setSlot2Saving] = useState(false);
  const [slot2Status, setSlot2Status] = useState('');

  // Pre-permission modal
  const [showPermModal, setShowPermModal] = useState(false);
  const [pendingSlot, setPendingSlot] = useState(null);

  // Browser support check
  const notificationsSupported = 'Notification' in window;
  const permissionDenied = notificationsSupported && Notification.permission === 'denied';

  // Load existing reminder settings on mount
  useEffect(() => {
    if (!userId || !challengeId) return;
    const load = async () => {
      const r1 = await loadReminder(userId, challengeId, 1);
      if (r1) {
        setSlot1Enabled(r1.enabled || false);
        setSlot1Time(r1.time || '07:00');
      }
      const r2 = await loadReminder(userId, challengeId, 2);
      if (r2) {
        setSlot2Enabled(r2.enabled || false);
        setSlot2Time(r2.time || '19:00');
      }
    };
    load();
  }, [userId, challengeId]);

  // Called when user taps the toggle ON for a slot
  const handleEnableSlot = (slot) => {
    // If already have permission, skip pre-modal
    if (notificationsSupported && Notification.permission === 'granted') {
      activateSlot(slot);
    } else {
      setPendingSlot(slot);
      setShowPermModal(true);
    }
  };

  // Called after permission confirmed in modal
  const handlePermissionConfirm = async () => {
    setShowPermModal(false);
    if (pendingSlot !== null) {
      await activateSlot(pendingSlot);
      setPendingSlot(null);
    }
  };

  const handlePermissionCancel = () => {
    setShowPermModal(false);
    setPendingSlot(null);
  };

  const activateSlot = async (slot) => {
    const setSaving = slot === 1 ? setSlot1Saving : setSlot2Saving;
    const setEnabled = slot === 1 ? setSlot1Enabled : setSlot2Enabled;
    const setStatus = slot === 1 ? setSlot1Status : setSlot2Status;
    const time = slot === 1 ? slot1Time : slot2Time;

    setSaving(true);
    setStatus('');

    const result = await requestNotificationPermission();
    if (!result.success) {
      setSaving(false);
      if (result.error === 'permission_denied') {
        setStatus('denied');
      } else if (result.error === 'notifications_not_supported') {
        setStatus('unsupported');
      } else {
        setStatus('error');
      }
      return;
    }

    const saveResult = await saveReminder(userId, challengeId, slot, {
      enabled: true,
      time,
      timeZone: getUserTimeZone(),
      fcmToken: result.token,
    });

    setSaving(false);
    if (saveResult.success) {
      setEnabled(true);
      setStatus('saved');
      setTimeout(() => setStatus(''), 3000);
    } else {
      setStatus('error');
    }
  };

  const handleDisableSlot = async (slot) => {
    const setSaving = slot === 1 ? setSlot1Saving : setSlot2Saving;
    const setEnabled = slot === 1 ? setSlot1Enabled : setSlot2Enabled;
    const setStatus = slot === 1 ? setSlot1Status : setSlot2Status;

    setSaving(true);
    const result = await disableReminder(userId, challengeId, slot);
    setSaving(false);
    if (result.success) {
      setEnabled(false);
      setStatus('');
    } else {
      setStatus('error');
    }
  };

  const handleTimeChange = async (slot, newTime) => {
    const setTime = slot === 1 ? setSlot1Time : setSlot2Time;
    const enabled = slot === 1 ? slot1Enabled : slot2Enabled;
    const setStatus = slot === 1 ? setSlot1Status : setSlot2Status;
    const setSaving = slot === 1 ? setSlot1Saving : setSlot2Saving;

    setTime(newTime); // update UI immediately

    if (enabled) {
      setSaving(true);
      try {
        // Try to get a fresh token, but don't block the save if it fails
        let token = null;
        try {
          const result = await requestNotificationPermission();
          if (result.success) token = result.token;
        } catch (_) {}

        // Always save the new time — token is optional (uses merge)
        const saveData = {
          enabled: true,
          time: newTime,
          timeZone: getUserTimeZone(),
        };
        if (token) saveData.fcmToken = token;

        await saveReminder(userId, challengeId, slot, saveData);
        setStatus('saved');
        setTimeout(() => setStatus(''), 2000);
      } catch (err) {
        setStatus('error');
      } finally {
        setSaving(false);
      }
    }
  };

  const renderSlot = (slot) => {
    const enabled = slot === 1 ? slot1Enabled : slot2Enabled;
    const time = slot === 1 ? slot1Time : slot2Time;
    const saving = slot === 1 ? slot1Saving : slot2Saving;
    const status = slot === 1 ? slot1Status : slot2Status;
    const isDisabled = saving || permissionDenied || !notificationsSupported;

    return (
      <div
        key={slot}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          backgroundColor: enabled ? '#f0faf0' : '#fafafa',
          borderRadius: '8px',
          border: `1px solid ${enabled ? '#4CAF50' : '#e0e0e0'}`,
          transition: 'all 0.2s',
        }}
      >
        {/* Toggle row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>
            Reminder {slot}
          </span>
          <button
            onClick={() => enabled ? handleDisableSlot(slot) : handleEnableSlot(slot)}
            disabled={isDisabled}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: enabled ? '#4CAF50' : '#e0e0e0',
              color: enabled ? 'white' : '#555',
              border: 'none',
              borderRadius: '20px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              minWidth: '52px',
            }}
          >
            {saving ? '...' : enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Time picker — only shown when enabled */}
        {enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>Time:</span>
            <select
              value={time}
              onChange={(e) => handleTimeChange(slot, e.target.value)}
              style={{
                padding: '5px 8px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status messages */}
        {status === 'saved' && (
          <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: '600' }}>✓ Reminder saved!</span>
        )}
        {status === 'denied' && (
          <div style={{ fontSize: '12px', color: '#c62828', backgroundColor: '#ffebee', padding: '10px', borderRadius: '6px', lineHeight: '1.6' }}>
            <strong>🚫 Notifications are blocked.</strong> Here's how to fix it:<br />
            <strong>iPhone:</strong> Settings → Apps → Safari → this site → Notifications → Allow<br />
            <strong>Android:</strong> Chrome Settings → Site Settings → Notifications → Allow<br />
            <strong>Desktop Chrome:</strong> Click the 🔒 lock in the address bar → Notifications → Allow<br />
            Then reload the page and try again.
          </div>
        )}
        {status === 'unsupported' && (
          <div style={{ fontSize: '12px', color: '#e65100', backgroundColor: '#fff3e0', padding: '10px', borderRadius: '6px', lineHeight: '1.6' }}>
            {isIOSBrowser ? (
              <>
                <strong>📲 iPhone users:</strong> You must add this app to your Home Screen first.<br />
                Tap the <strong>Share button</strong> (□↑) in Safari → <strong>"Add to Home Screen"</strong> → open the app from your Home Screen → then set up reminders here.
              </>
            ) : (
              <>⚠️ Your browser doesn't support push notifications. Try Chrome or Edge.</>
            )}
          </div>
        )}
        {status === 'error' && (
          <span style={{ fontSize: '12px', color: '#d32f2f' }}>Something went wrong. Try again.</span>
        )}
      </div>
    );
  };

  // ── Challenge ended state ────────────────────────────────────────────────
  if (!challengeActive) {
    return (
      <div style={{ marginTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            color: '#999',
            fontSize: '13px',
          }}
        >
          <span>🔔</span>
          <span>Challenge has ended — reminders stopped</span>
        </div>
      </div>
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: expanded ? '#e8f5e9' : '#f5f5f5',
          border: '1px solid #e0e0e0',
          borderRadius: expanded ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        <span style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>
          🔔 Reminders {slot1Enabled || slot2Enabled ? '✓' : ''}
        </span>
        <span style={{ fontSize: '12px', color: '#666' }}>{expanded ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {expanded && (
        <div
          style={{
            padding: '14px',
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* iOS browser — must install to Home Screen first */}
          {isIOSBrowser && !notificationsSupported && (
            <div style={{ fontSize: '13px', color: '#e65100', backgroundColor: '#fff3e0', padding: '12px', borderRadius: '8px', lineHeight: '1.7' }}>
              <strong>📲 iPhone users:</strong> To receive reminders you must first install this app.<br />
              In Safari tap the <strong>Share button</strong> (□↑) → <strong>"Add to Home Screen"</strong> → then open the app from your Home Screen and set up reminders here.
            </div>
          )}

          {/* Generic unsupported (non-iOS) */}
          {!notificationsSupported && !isIOSBrowser && (
            <p style={{ fontSize: '13px', color: '#f57c00', margin: 0 }}>
              ⚠️ Your browser doesn't support push notifications. Try Chrome or Edge for the best experience.
            </p>
          )}

          {/* Notifications blocked */}
          {permissionDenied && (
            <div style={{ fontSize: '13px', color: '#c62828', backgroundColor: '#ffebee', padding: '12px', borderRadius: '8px', lineHeight: '1.7' }}>
              <strong>🚫 Notifications are blocked.</strong> Here's how to re-enable them:<br />
              <strong>iPhone:</strong> Settings → Apps → Safari → plank-squat.vercel.app → Notifications → Allow<br />
              <strong>Android Chrome:</strong> Chrome menu → Settings → Site Settings → Notifications → find this site → Allow<br />
              <strong>Desktop Chrome:</strong> Click the 🔒 lock icon in the address bar → Notifications → Allow<br />
              Then <strong>reload this page</strong> and try again.
            </div>
          )}

          {renderSlot(1)}
          {renderSlot(2)}

          <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0', textAlign: 'center' }}>
            📍 Reminders are sent to this device &amp; browser only
          </p>
        </div>
      )}

      {/* Pre-permission modal */}
      {showPermModal && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '28px 24px',
              maxWidth: '340px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔔</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>
              Turn on reminders?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 8px 0', lineHeight: '1.5' }}>
              We'll send you a daily nudge at the time you pick to keep your <strong>{challengeName}</strong> streak alive! 💪
            </p>

            {/* iPhone-specific install warning inside modal */}
            {isIOSBrowser && (
              <div style={{ fontSize: '12px', color: '#e65100', backgroundColor: '#fff3e0', padding: '10px', borderRadius: '8px', margin: '0 0 14px 0', lineHeight: '1.6', textAlign: 'left' }}>
                📲 <strong>iPhone users:</strong> You must add this app to your Home Screen first — tap the Share button (□↑) → "Add to Home Screen" → open from Home Screen, then come back here.
              </div>
            )}

            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 20px 0' }}>
              Your browser will ask to confirm — tap <strong>Allow</strong> when prompted. Reminders only work on this device.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handlePermissionCancel}
                style={{
                  flex: 1, padding: '11px', fontSize: '15px',
                  backgroundColor: '#f0f0f0', color: '#555',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                }}
              >
                Not Now
              </button>
              <button
                onClick={handlePermissionConfirm}
                style={{
                  flex: 1, padding: '11px', fontSize: '15px', fontWeight: '600',
                  backgroundColor: '#4CAF50', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                }}
              >
                Turn On
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
