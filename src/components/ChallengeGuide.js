import React from "react";

export default function ChallengeGuide() {
  return (
    <div style={{ padding: "20px", maxWidth: "720px", margin: "0 auto" }}>
      <h2>Challenge Guide</h2>

      {/* QUICK START */}
      <section style={{ marginBottom: "20px" }}>
        <h3>🚀 Quick Start</h3>
        <p>Sign in with Google, then:</p>
        <ol style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>
            Open <strong>👤 Profile</strong> and set your <strong>screen name</strong>, then save.
          </li>
          <li>
            Tap <strong>🏆 Available</strong> and <strong>Join</strong> a challenge — it moves to{" "}
            <strong>💪 Active</strong>.
          </li>
          <li>
            On the active card, tap <strong>Start Day X</strong> to launch the plank timer or squat
            logger.
          </li>
          <li>
            ⚠️ When you finish a plank attempt, you have <strong>20 seconds to tap Keep</strong> —
            see the Plank Timer section below.
          </li>
        </ol>
        <p>That&apos;s the whole loop. The rest of this guide is here when you want to go deeper.</p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* PRACTICE SESSION */}
      <section style={{ marginBottom: "20px" }}>
        <h3>🏋️ Practice Session — try it first</h3>
        <p>
          Not ready to commit to a multi-day challenge?{" "}
          <strong>Practice Session is always available</strong> — no start date, no end date, no
          pressure. Every session counts toward your totals and badges.
        </p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>
            <strong>Target:</strong> 60-second plank, every session.
          </li>
          <li>
            <strong>Daily streak:</strong> Practice once per day (Phoenix calendar day) to grow
            your 🔥 practice streak.
          </li>
          <li>
            The practice card shows total <strong>Sessions</strong>, <strong>Total Time</strong>,
            and <strong>Best</strong>.
          </li>
          <li>
            You can <strong>Leave Practice Session</strong> any time from the card — your badges,
            streaks, and history are saved if you ever come back.
          </li>
          <li>
            A <strong>🏋️ Practice Session History</strong> card on your Profile keeps your records
            visible even after leaving.
          </li>
        </ul>
        <p>
          If you&apos;re brand new, this is the easiest way to learn the timer before joining a real
          challenge.
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* JOINING A CHALLENGE */}
      <section style={{ marginBottom: "20px" }}>
        <h3>🏆 Joining a Challenge</h3>
        <p>
          The <strong>Available</strong> tab shows every plank and squat challenge you can join.
          Tap <strong>Join</strong> and it moves into <strong>💪 My Active Challenges</strong>.
        </p>
        <p>
          Each active card shows your current <strong>day</strong> out of total days, today&apos;s{" "}
          <strong>target</strong>, and a big <strong>Start Day X</strong> button. If you&apos;ve
          already completed today, the card tells you so and you&apos;re done until tomorrow.
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* PLANK TIMER */}
      <section style={{ marginBottom: "20px" }}>
        <h3>
          ⏱️ Plank Timer — Start, Pause, Redo, <em>Keep</em>
        </h3>
        <p>
          Tapping <strong>Start Day X</strong> on a plank challenge opens the{" "}
          <strong>Plank Timer</strong> with today&apos;s target time.
        </p>

        <h4 style={{ marginBottom: "4px" }}>Pause</h4>
        <p style={{ marginTop: "4px" }}>
          You can press <strong>Pause</strong> if you need a quick breather. You can pause and
          resume multiple times, but you only get about <strong>one minute total</strong> of pause
          time before the attempt ends. <strong>Resume</strong> picks up where you left off.
        </p>

        <h4 style={{ marginBottom: "4px" }}>Redo</h4>
        <p style={{ marginTop: "4px" }}>
          Didn&apos;t go how you wanted? Use <strong>Redo</strong> to try again — up to{" "}
          <strong>3 attempts per day</strong>.
        </p>

        <h4 style={{ marginBottom: "4px" }}>⚠️ Keep — don&apos;t skip this!</h4>
        <p style={{ marginTop: "4px" }}>
          After your plank, you get a <strong>Keep / Redo</strong> screen.
        </p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>
            Tap <strong>Keep Time</strong> to save the attempt, add it to your totals, and advance
            your challenge day.
          </li>
          <li>
            <strong>
              If you don&apos;t tap Keep within 20 seconds, the app automatically redoes the
              attempt — your time is gone.
            </strong>{" "}
            This is the most common way people lose progress, so watch for it.
          </li>
          <li>
            Tapping <strong>Cancel</strong> also throws the attempt away.
          </li>
        </ul>

        <h4 style={{ marginBottom: "4px" }}>Squat logger</h4>
        <p style={{ marginTop: "4px" }}>
          Squat challenges open a logger instead of a timer. Enter how many squats you did today
          and <strong>Save</strong> — your reps add to your total for that challenge.
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* LEADERBOARD */}
      <section style={{ marginBottom: "20px" }}>
        <h3>📊 Leaderboard</h3>
        <p>Each challenge has its own leaderboard. Your position comes from two things:</p>
        <ol style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>
            Your <strong>best single performance</strong> — best plank time or best squat reps in
            one day.
          </li>
          <li>
            Your <strong>total</strong> — total successful plank time or total squats logged in
            that challenge.
          </li>
        </ol>
        <p>
          In plain terms: post a strong best effort <strong>and</strong> keep showing up daily to
          climb the board.
        </p>
        <p>
          When a challenge ends, you&apos;ll see a <strong>Challenge End Summary</strong> with your
          final rank reveal (🥇🥈🥉 with confetti), the badges you earned, and your final stats.
          The <strong>Final Leaderboard</strong> for any archived challenge stays available from
          the Leaders tab.
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* BADGES */}
      <section style={{ marginBottom: "20px" }}>
        <h3>🏅 Badges</h3>
        <p>
          Badges are awarded automatically — no buttons to press. They show up on each active
          challenge card and on your Profile.
        </p>

        <h4 style={{ marginBottom: "4px" }}>On each challenge card</h4>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6, marginTop: "4px" }}>
          <li>
            🔥 <strong>Streak badges</strong> at <strong>3, 7, 14, 21, and 28</strong> consecutive
            days inside that challenge.
          </li>
          <li>
            <strong>Multiplier badges</strong> when you go past today&apos;s target:
            <ul style={{ paddingLeft: "20px" }}>
              <li>⚡ <strong>2×</strong> — double the target</li>
              <li>🚀 <strong>3×</strong> — triple the target</li>
              <li>👑 <strong>4×</strong> — quadruple the target</li>
            </ul>
          </li>
          <li>
            ⏱️ <strong>Time milestones</strong> (plank only) — every <strong>15 minutes</strong> of
            successful plank time, up to <strong>5 hours</strong>.
          </li>
        </ul>

        <h4 style={{ marginBottom: "4px" }}>On your Profile</h4>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6, marginTop: "4px" }}>
          <li>
            💪 <strong>All-Time Performance Badges</strong> — every multiplier and streak you&apos;ve
            earned across all challenges.
          </li>
          <li>
            🏆 <strong>Lifetime Achievements</strong> (gold card, never resets):
            <ul style={{ paddingLeft: "20px" }}>
              <li>🔥 <strong>Lifetime Streak</strong> in 30-day steps up to 365 days.</li>
              <li>⏱️ <strong>Lifetime Plank Time</strong> in 30-minute steps up to 10 hours.</li>
            </ul>
          </li>
        </ul>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* INSTALL */}
      <section style={{ marginBottom: "20px" }}>
        <h3>📲 Install to Home Screen</h3>
        <p>
          Installing the app puts it on your home screen and runs it full screen — no browser bars,
          faster to open, feels native.
        </p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>
            <strong>iPhone (Safari):</strong> Tap the <strong>Share</strong> icon →{" "}
            <strong>Add to Home Screen</strong>.
          </li>
          <li>
            <strong>iPhone (Chrome / Firefox / other):</strong> Open the page in{" "}
            <strong>Safari</strong> first, then Share → Add to Home Screen.
          </li>
          <li>
            <strong>Android (Chrome):</strong> Tap the <strong>Install</strong> prompt when it
            appears, or use the menu → <strong>Install app</strong>.
          </li>
        </ul>
        <p>
          You&apos;ll see a friendly in-app prompt the first time you visit on a supported device.
          Dismissing it just hides it for that session — you can install any time.
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* REMINDERS */}
      <section style={{ marginBottom: "20px" }}>
        <h3>🔔 Reminders</h3>
        <p>
          Each active challenge has its own reminders so you don&apos;t break your streak. Open
          the <strong>🔔 Remind me</strong> section on the challenge card.
        </p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>
            <strong>Two reminder slots per challenge</strong> — for example, one in the morning and
            one in the evening.
          </li>
          <li>Pick a time from the dropdown (30-minute increments).</li>
          <li>
            The first time you enable a reminder, your browser will ask for{" "}
            <strong>notification permission</strong> — accept it to turn reminders on.
          </li>
          <li>
            Reminders fire in your <strong>local time zone</strong> with rotating motivational
            messages.
          </li>
          <li>
            If you previously denied notifications, re-enable them in your browser or phone
            settings before reminders will work.
          </li>
        </ul>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "20px 0" }} />

      {/* PROFILE */}
      <section>
        <h3>👤 Profile</h3>
        <p>Your Profile is the long view of everything you&apos;ve done:</p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.6 }}>
          <li>Your <strong>screen name</strong> (edit any time).</li>
          <li>
            <strong>Stats</strong> — total plank time and total squats across everything.
          </li>
          <li>
            <strong>All-Time Performance Badges</strong> and{" "}
            <strong>🏆 Lifetime Achievements</strong>.
          </li>
          <li>
            <strong>🏋️ Practice Session History</strong>.
          </li>
          <li>
            <strong>Completed Challenges</strong> — past challenges with your final stats and rank.
          </li>
        </ul>
      </section>
    </div>
  );
}
