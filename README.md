# React + Vite

## LICAN Events and HEADBANG DEALERS

The main site is a React application built by Vite. The standalone game is
published from:

```text
public/headbangdealers_the_game
```

Its production URL is:

```text
/headbangdealers_the_game/
```

The game remains an autonomous static build. Its minified core bundle must not
be edited manually.

### Supabase

Copy `.env.example` to `.env.local` and provide:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Phase 2 adds optional account authentication and prepares one authenticated
`game_progress` row. Gameplay progress remains exclusively in local storage;
Phase 3 adds a version-independent cloud persistence layer, adapters, safe
merge rules, backups, offline state, and revision-based concurrency.

Cloud synchronization is controlled by:

```text
VITE_HEADBANG_CLOUD_SYNC_ENABLED
```

It defaults to `false` and is forced to `false` in the production deployment
workflow until QA and the Phase 3 SQL migration are approved. Local development
may set it to `true`.

See [AUTH_PHASE_2.md](./AUTH_PHASE_2.md) for the complete flow, security notes,
guest mode, and the legal URL that must be supplied before public release.
See [CLOUD_PERSISTENCE_PHASE_3.md](./CLOUD_PERSISTENCE_PHASE_3.md) for the
canonical schema, merge, offline, concurrency, and rollout constraints.
See [GAME_SAVE_ADAPTER_GUIDE.md](./GAME_SAVE_ADAPTER_GUIDE.md) before adding a
new local game save format.

The standalone game also exposes a public `SCORE TOP 10` screen backed only by
read access to `public.score_top_10`. Score submission is intentionally absent
from browser code and must use an authenticated Supabase Edge Function.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
