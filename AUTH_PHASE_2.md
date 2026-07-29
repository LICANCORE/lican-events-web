# HEADBANG DEALERS — Supabase Auth Phase 2

## Scope

Phase 2 adds account authentication to the standalone game without changing
the minified game bundle or its local save. The current gameplay save is
`hd_bt_campaign_save_v019` in `localStorage`; V017 remains supported as a
read-only fallback until the game performs its native migration.

This phase does not synchronize, migrate, merge, upload, or download gameplay
progress.

## Supabase Auth configuration

The public Auth settings were checked before implementation:

- Email provider enabled.
- Sign-up enabled.
- Email autoconfirm disabled (`mailer_autoconfirm: false`).

Users therefore need to confirm the one-time email link before a normal login.

The Vite build requires:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Only the publishable client key is used. Never add a `service_role` or secret
key to browser code.

## Registration and email confirmation

`window.HeadbangCloud.signUp(email, password)` normalizes and validates the
email and enforces a password with at least:

- 10 characters.
- One uppercase letter.
- One lowercase letter.
- One number.
- One symbol.

Supabase receives this dynamic confirmation URL:

```text
${window.location.origin}/headbangdealers_the_game/?auth=confirmed
```

With email confirmation enabled, registration shows a neutral confirmation
screen and does not create `game_progress` until Supabase provides an
authenticated session.

## Login and logout

Login uses `signInWithPassword`. Once authenticated, the bridge calls the
idempotent `ensureProgressRow()`.

Logout clears only the Supabase Auth session. It does not delete:

- `hd_bt_campaign_save_v019` and any preserved V017 fallback.
- Selected level, character, or language.
- Newsletter access state.
- Any other game preference.

After logout, the game continues in guest mode.

## Password recovery

Recovery requests use:

```text
${window.location.origin}/headbangdealers_the_game/?auth=recovery
```

The recovery link opens the new-password screen. Supabase updates the password
without requesting the old one, the temporary `auth` parameter is removed, and
the authenticated session is preserved when available.

## Auth state

The bridge keeps one Supabase `onAuthStateChange` subscription and handles:

- `INITIAL_SESSION`
- `SIGNED_IN`
- `SIGNED_OUT`
- `TOKEN_REFRESHED`
- `USER_UPDATED`
- `PASSWORD_RECOVERY`

Consumers can use `subscribeAuth(callback)` and `unsubscribeAuth(callback)`.
The global `headbang-auth-changed` event exposes only:

```js
{
  authenticated,
  userId,
  event
}
```

Tokens and full emails are not included.

## Initial `game_progress` row

`ensureProgressRow()` runs only for an authenticated user and performs an
idempotent upsert containing only:

```js
{ user_id: user.id }
```

The table defaults remain authoritative for:

- `highest_level_unlocked = 1`
- Initial characters: TREZE, HENRY, HYDRAXXX
- Empty USB, sequence, and merchandise arrays
- Empty JSON objects
- `save_version = 1`

The operation uses the authenticated user's JWT internally through Supabase JS
and remains subject to RLS.

## Guest mode

Account creation is optional. “CONTINUAR COMO INVITADO” closes the account
overlay and leaves the game entirely on local storage. It creates no user,
sends no email, and writes nothing to Supabase.

## Privacy and legal URL

Account authentication and the existing Brevo newsletter remain separate.
There is no newsletter checkbox or Brevo request in the account UI.

**Pending before public release:** set `PRIVACY_POLICY_URL` in:

```text
public/headbangdealers_the_game/assets/account-ui.js
```

It is intentionally `null` and visibly marked as pending because no published
LICAN privacy-policy URL exists in this repository.

## Abuse protection

The UI prevents duplicate submissions, disables controls during requests, and
adds a short cooldown after repeated errors. A documented
`headbang-turnstile-slot` is reserved for a future Cloudflare Turnstile
integration. Frontend cooldowns are not treated as server-side rate limiting.

## Current limitations and Phase 3

Phase 3 still needs:

- Local-to-cloud save migration.
- Deterministic conflict resolution.
- Multi-device progress merge.
- Offline synchronization queue.
- Score validation and rankings.
- Explicit rollout and rollback controls.

The minified game bundle should not be patched to implement those features.
