# Firestore Security Rules — Practice Session

The built-in **Practice Session** introduces two new collections that need
read/write rules:

- `practiceAttempts` — one doc per session (created by users, read-only history)
- `practiceUserStats/{userId}` — one aggregate doc per user (totals, streak, badges, joined flag)

Practice has **no leaderboards**, so no other collection needs to expose practice
data publicly.

Below is a complete `firestore.rules` file you can copy-paste into the Firebase
console (Build → Firestore Database → Rules). It includes the existing
collections in this app plus the new practice rules. Adjust the
`isAdmin()` helper if you want to manage admins via custom claims instead of
hard-coding the email.

---

## Complete `firestore.rules` — copy-paste

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Admin email is hard-coded in the app (AdminPanel.js / TabNavigation.js).
    // Switch to a custom claim (request.auth.token.admin == true) if/when you
    // move admin gating off email comparison.
    function isAdmin() {
      return isSignedIn()
        && request.auth.token.email == 'chadrnlmt@gmail.com';
    }

    // ────────────────────────────────────────────────────────────────────
    // Existing collections
    // ────────────────────────────────────────────────────────────────────

    // Per-user profile doc (display name, etc.)
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create, update: if isOwner(userId);
      allow delete: if isAdmin();
    }

    // Per-user lifetime stats + badges
    match /userStats/{userId} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }

    // Admin-managed catalog of challenges
    match /challenges/{challengeId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // A user's enrollment in a challenge
    match /userChallenges/{docId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn()
        && resource.data.userId == request.auth.uid;
      allow delete: if isAdmin();
    }

    // One doc per attempt in a regular challenge
    match /attempts/{attemptId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid;
      // Attempts are append-only for users; admins can clean up.
      allow update, delete: if isAdmin();
    }

    // Challenge-scoped per-user aggregates (powers leaderboards)
    match /challengeUserStats/{docId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn()
        && (request.resource.data.userId == request.auth.uid
            || resource.data.userId == request.auth.uid
            || isAdmin());
    }

    // Archived final leaderboards
    match /leaderboardHistory/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin() || isSignedIn(); // archive runs from any signed-in client
    }

    // Teams (admin-managed)
    match /teams/{teamId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // Per-user notification settings (push reminders, etc.)
    match /notificationSettings/{userId} {
      allow read, write: if isOwner(userId);
    }

    // ────────────────────────────────────────────────────────────────────
    // PRACTICE SESSION — new collections
    // ────────────────────────────────────────────────────────────────────
    //
    // Practice is built into the client (PRACTICE_CHALLENGE_ID = "practice").
    // There is NO admin doc in /challenges/practice — the rules below MUST
    // NOT depend on one. Practice has no leaderboards, so no public/global
    // aggregation collection is needed.

    // One doc per practice session — append-only history.
    match /practiceAttempts/{attemptId} {
      // Users can read their own attempts. Admins can read all.
      allow read: if isSignedIn()
        && (resource.data.userId == request.auth.uid || isAdmin());

      // Users can create attempts only for themselves and only with the
      // built-in practice challengeId.
      allow create: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.challengeId == 'practice';

      // Append-only — no edits or deletes from clients.
      allow update: if false;
      allow delete: if isAdmin();
    }

    // Per-user practice aggregate (totals, streak, badges, joined flag).
    // Doc id MUST equal the user's uid.
    match /practiceUserStats/{userId} {
      // Owner can read their own; admins can read all (for the report tab).
      allow read: if isOwner(userId) || isAdmin();

      // Owner-only writes. The doc id is the userId, and any write must
      // either preserve or set userId to the authed uid.
      allow create: if isOwner(userId)
        && request.resource.data.userId == request.auth.uid;

      allow update: if isOwner(userId)
        && request.resource.data.userId == request.auth.uid;

      // Admins can clean up if needed (e.g. reset a user's practice data).
      allow delete: if isAdmin();
    }

    // ────────────────────────────────────────────────────────────────────
    // Default deny — keep at the bottom.
    // ────────────────────────────────────────────────────────────────────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## What the practice rules guarantee

- **Append-only attempts.** Users can only create `practiceAttempts` for
  themselves and only with `challengeId == "practice"`. They cannot edit or
  delete past attempts; admins can delete for cleanup.
- **Self-only stats.** `practiceUserStats/{uid}` is readable and writable only
  by the owning user (with admin read for the report). The doc id binds the
  data to the user's auth uid, so a user can never write into another user's
  practice stats.
- **No public leaderboards.** Practice data is intentionally not exposed via
  any cross-user read path.
- **No dependency on a `challenges/practice` document.** The client treats
  practice as built-in, and the rules never read from `/challenges/practice`,
  so admins must not (and should not) create one.

## Optional hardening

- If you want to enforce the practice target server-side, add a check in the
  `practiceAttempts` create rule:
  ```firestore
  && request.resource.data.targetValue == 60
  && request.resource.data.actualValue is int
  && request.resource.data.actualValue >= 0
  ```
- To migrate `isAdmin()` away from a hard-coded email, set a custom claim
  (`admin: true`) on the admin user and replace the helper with
  `request.auth.token.admin == true`.
