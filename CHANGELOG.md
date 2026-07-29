# Changelog

## Unreleased

### Added

- Version-independent `HEADBANG_CLOUD_SAVE` schema and adapter registry.
- V019, V017, and generic legacy save adapters with non-destructive
  unknown-field preservation.
- V019 game build, including levels 8–10 and the Magic Bite, The Siberian,
  and David Neon character content, merged without editing its minified bundle.
- V019 subpath normalization for PC and character-unlock images, plus a
  non-destructive menu action to replay the skull dialogue intro.
- Domain-aware local/cloud merge, local backups, offline pending state,
  debounced change detection, and revision-controlled RPC synchronization.
- Feature-flagged cloud-save management UI and first-sync choices.
- Canonical non-negative points and per-ID achievement merge rules.
- Public, read-only SCORE TOP 10 interface with loading, empty, and error
  states.
- Incremental Phase 3 SQL migration, anonymized fixtures, unit tests, and a
  future-adapter guide.
- Supabase Auth Phase 2 bridge API for sign-up, login, logout, password
  recovery, password updates, session state, and auth subscriptions.
- Idempotent authenticated initialization of `game_progress`.
- Responsive HEADBANG DEALERS account overlay with guest mode.
- Password requirements, accessible form feedback, focus management, and
  duplicate-request protection.
- Phase 2 authentication documentation and environment template.

### Security

- Cloud saves are validated, limited to 64 KB, and reject dangerous or
  sensitive keys.
- Device IDs are random pseudonymous UUIDs and are never authentication
  credentials.
- Economy, commercial rewards, discounts, and competitive prizes remain
  non-authoritative client data.
- The browser has no score submission or leaderboard mutation path.
- Auth events expose no tokens or complete emails.
- Account and newsletter flows remain separate.
- The game save remains local and is never copied to Supabase in Phase 2.
- Only the Supabase publishable key is used in browser code.
