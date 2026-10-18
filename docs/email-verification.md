# Registration email verification

## Flow and security controls

New registrations create a `pending` user and an `EmailVerification` record,
but no session. The six-digit code is generated with Node cryptographic random
generation, bound to the user ID with HMAC-SHA256, stored only as a hash, valid
for 10 minutes, limited to five failed attempts, and consumed in the same
transaction that marks the user verified. A row lock serializes concurrent
verification attempts, so one code can create at most one verified transition.

EmailJS is called only from server code. Resending is protected by database-backed
trusted-IP and HMAC-obscured per-email rate limits plus a 60-second record-level
cooldown. A successful resend atomically replaces the previous code. A definite
EmailJS rejection preserves the previously usable code. An ambiguous timeout or
network failure instead makes the possibly delivered new code usable while
retaining the cooldown. Provider errors return bounded messages and verification
codes, API keys, HMAC keys, and session tokens are not logged.

The authenticated-user lookup rejects `pending` users even if a stale session
row somehow exists. Login reveals the verification action only after the caller
has supplied the correct password; nonexistent emails and wrong passwords retain
the same generic response.

Registration returns `409` with an already-registered error when the email is
in use, including pending accounts. This intentionally reveals account existence
at registration so the form does not claim a new code was sent. Existing pending
accounts can request another code from the verification page.

## Required environment variables

Configure these as server-side Vercel environment variables for Production and
Preview, then redeploy:

```env
EMAIL_PROVIDER=emailjs
EMAILJS_SERVICE_ID=service_...
EMAILJS_TEMPLATE_ID=template_...
EMAILJS_PUBLIC_KEY=<server-side-public-key>
EMAILJS_PRIVATE_KEY=<server-side-private-key>
EMAIL_VERIFICATION_HMAC_KEY=<at-least-32-random-characters>
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

## EmailJS setup and limitations

1. Connect the intended Gmail sender to an EmailJS service.
2. Configure the `One-Time Password` template with `to_email`, `to_name`,
   `verification_code`, and `expires_in` variables.
3. Copy the service ID, template ID, public key, and private key to both the
   Preview and Production Vercel environments, then redeploy each environment.
4. Set `NEXT_PUBLIC_APP_URL` to that environment's exact deployed origin. The
   application first validates same-host requests and uses this configured
   origin as the secure fallback; do not put a path or guessed deployment URL
   in this variable.

EmailJS is invoked through `POST https://api.emailjs.com/api/v1.0/email/send`
from the server. Public and private keys are intentionally not prefixed with
`NEXT_PUBLIC_` and are never read by client components. The REST API has no
idempotency key or durable message ID in this integration, so the application
does not automatically retry. Timeouts and network failures are recorded as
ambiguous, retain the cooldown, and make a possibly accepted replacement code
usable. A 2xx response records provider acceptance as `sent`, not delivery.
Bounces, complaints, Gmail sending limits, and EmailJS free-tier quotas must be
monitored in the provider accounts because there is no application delivery
webhook after removal of the Resend integration.

Automated integration tests never contact EmailJS. Their delivery stub and
deterministic OTP are accepted only when `DATABASE_URL` exactly matches the
explicit `TEST_DATABASE_URL`.

For a manual delivery test, register a disposable address in the intended
deployment, confirm one message appears in EmailJS history and the recipient
inbox, enter the code once, and confirm replay fails. Also test one resend after
the 60-second cooldown. Do not use production credentials in automated tests.

Provider rollback does not require a database change: deploy the last Resend
application revision, restore its three provider variables and signed webhook,
and redeploy. Existing pending codes and verification rows remain compatible.
Do not run a schema rollback for an email-provider-only rollback.

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
