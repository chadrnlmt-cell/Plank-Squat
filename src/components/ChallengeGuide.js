import React from "react";

export default function ChallengeGuide() {
  return (
    <div style={{ padding: "20px" }}>
      <h2>Challenge Guide</h2>

      <section style={{ marginBottom: "16px" }}>
        <h3>1. Sign in and set your name</h3>
        <p>
          Sign in with Google to get started. Go to <strong>Profile</strong> and set the
          <strong> screen name</strong> you want everyone to see, then save it so it
          shows on your challenges and on the leaderboard.
        </p>
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3>2. Join a challenge</h3>
        <p>
          Open the <strong>Available</strong> tab to see plank and squat challenges you can
          join. Tap <strong>Join</strong> on a challenge and it will move into
          <strong> My Active Challenges</strong>.
        </p>
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3>3. Start today&apos;s workout</h3>
        <p>
          In <strong>My Active Challenges</strong>, each card shows your current
          <strong> day</strong> and total days. If you can do today&apos;s workout, you&apos;ll see
          a big <strong>Start Day X</strong> button. If you&apos;ve already done today, you&apos;ll see a
          message that today is already completed.
        </p>
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3>4. Plank timer: Start, Pause, Redo, Keep</h3>
        <p>
          When you hit <strong>Start</strong> on a plank challenge, the
          <strong> Plank Timer</strong> opens with today&apos;s target time. Do your plank while the
          timer runs, then finish the attempt on that screen.
        </p>
        <p>
          You can press <strong>Pause</strong> if you need a quick breather. You can pause and
          resume multiple times, but you only get about <strong>one minute total</strong> of pause
          time to recover before you should either finish or restart the attempt. When
          you tap <strong>Resume</strong>, the timer picks up where you left off.
        </p>
        <p>
          If the attempt didn&apos;t go how you wanted, you can use a <strong>redo</strong> to try
          again (you have up to <strong>3 attempts</strong> in a day). When you
          <strong> Keep</strong> an attempt, the app saves it, adds the time to your totals, and
          updates your challenge day. If you <strong>Cancel</strong> out instead of keeping it,
          that attempt won&apos;t count.
        </p>
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3>5. Squat logging</h3>
        <p>
          Squat challenges open the <strong>Squat Logger</strong> instead of a timer. Enter how
          many squats you did for today and save it. These reps are added to your total
          squat reps for that challenge.
        </p>
      </section>

      <section style={{ marginBottom: "16px" }}>
        <h3>6. Leaderboard</h3>
        <p>
          Each challenge has its own leaderboard. Your position mainly comes from your
          <strong> best performance</strong> (best single plank time or squat reps) and your
          <strong> total successful plank time or total squats</strong> logged in that challenge.
        </p>
        <p>
          In simple terms: do a strong best effort and log more total plank time or
          total squats than other people to climb higher on the board.
        </p>
      </section>

      <section>
        <h3>7. Profile and stats</h3>
        <p>
          The <strong>Profile</strong> tab shows your name and a summary of how you&apos;re doing
          across challenges. Check it to see how much time you&apos;ve spent planking and
          how many squats you&apos;ve done over time.
        </p>
      </section>
    </div>
  );
}
