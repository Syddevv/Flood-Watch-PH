# Registration email verification

## Flow and security controls

New registrations create a `pending` user and an `EmailVerification` record,
but no session. The six-digit code is generated with Node cryptographic random
generation, bound to the user ID with HMAC-SHA256, stored only as a hash, valid
for 10 minutes, limited to five failed attempts, and consumed in the same
transaction that marks the user verified. A row lock serializes concurrent
verification attempts, so one code can create at most one verified transition.

Resend is called only from server code. Resending is protected by database-backed
trusted-IP and HMAC-obscured per-email rate limits plus a 60-second record-level
cooldown. A successful resend atomically replaces the previous code. If Resend
fails, the previously usable code is preserved. Provider errors return bounded
messages and verification codes, API keys, HMAC keys, and session tokens are not
logged.

The authenticated-user lookup rejects `pending` users even if a stale session
row somehow exists. Login reveals the verification action only after the caller
has supplied the correct password; nonexistent emails and wrong passwords retain
the same generic response.

## Required environment variables

Configure these as server-side Vercel environment variables for Production and
Preview, then redeploy:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS="Flood Watch <verify@your-verified-domain.example>"
EMAIL_VERIFICATION_HMAC_KEY=<at-least-32-random-characters>
RESEND_WEBHOOK_SECRET=whsec_...
LEGACY_EMAIL_GRACE_DEADLINE=2027-01-31T00:00:00.000Z
NEXT_PUBLIC_APP_URL=https://your-deployment.example
```

Generate the HMAC key with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

For key rotation, move the old value to
`EMAIL_VERIFICATION_HMAC_KEY_PREVIOUS`, set a new current key, deploy, wait at
least 10 minutes for old codes to expire, then remove the previous key. Stored
key IDs select the correct key without storing a secret.

## Resend setup and limitations

1. Verify a sender domain in Resend and use an address on that domain in
   `EMAIL_FROM_ADDRESS`.
2. Create a webhook pointing to `/api/webhooks/resend` and subscribe to
   `email.delivered`, `email.bounced`, and `email.complained`.
3. Copy the webhook signing secret to `RESEND_WEBHOOK_SECRET`.

Resend's `onboarding@resend.dev` testing sender is restricted to Resend's allowed
test recipients. It is suitable for initial setup only and does not prove that
arbitrary production recipients can receive mail. Bounces and complaints are
recorded as a bounded status on the verification record; recipient suppression
and domain reputation remain managed in Resend.

Automated integration tests never contact Resend. Their delivery stub and
deterministic OTP are accepted only when `DATABASE_URL` exactly matches the
explicit `TEST_DATABASE_URL`.

## Database rollout and legacy users

Apply the additive migration before deploying the U3 application code:

```bash
npx prisma migrate deploy
```

The migration preserves every user, password, session, report, and role. It
marks existing ordinary users `legacy_grace` and administrators
`legacy_admin_review`; neither state is silently considered verified. These
accounts can continue authenticating only until `LEGACY_EMAIL_GRACE_DEADLINE`.

Inventory and confirm ownership out of band, then approve one account at a time:

```bash
npm run user:verify-legacy -- resident@example.com
npm run user:verify-legacy -- admin@example.com --allow-admin
```

Each approval writes an `AdminAuditLog` event. After the deadline, unresolved
legacy sessions are rejected by the central session lookup even if their rows
have not yet expired. Choose a deadline that leaves time to notify users and
review administrators before enforcement.

Rollback is compatibility-safe before relying on U3 registrations: deploy the
previous application version first, then drop the additive
`EmailVerification` table, status constraint/index, and the two added `User`
columns in a separately reviewed rollback migration. Do not remove these fields
after verified U3 accounts exist without first preserving their verification
state. Never use `prisma db push` for this rollout.
