# Forest Friends · Pebble Grove

A small online animal game with a quiet woodland garden. English game interface.

## Play

Current hosted game: https://animal-friends-duel-rt.ceruleanhorse3.chatgpt.site/

Choose an animal, invite friends with a short room code, and play Rock Paper Scissors, Gomoku or Animal Hide & Seek. Match winners earn points and can collect a friendship keepsake. Explore the zoo, share snacks, fish, exchange points for outfits, skip pebbles and keep pocket notes.

## Run locally

Install Node.js 24 or newer. No third-party runtime packages are required.

```sh
npm run dev
```

Open http://localhost:4173. Local player and match data uses an in-memory SQLite database and resets when the local server restarts. Browser profile tokens and pocket notes remain in browser storage. After restarting, an expired local profile can choose an animal again.

## Check and build

```sh
npm test
npm run build
```

Tests cover game rules, presence, economy, collection ownership, fishing, navigation and nature interactions. The build outputs a Cloudflare Worker ES module at `dist/server/index.js`; it embeds the interface and runtime image assets.

## Structure

- `worker/`: server API, shared game rules, browser interface and interaction modules.
- `assets/`: PNG art sources and WebP runtime assets. Characters and background were generated and edited with an image-generation tool; interface glyphs and effects are SVG/CSS.
- `drizzle/`: ordered SQLite/D1 migrations.
- `*-test.mjs`: executable checks.
- `.github/workflows/check.yml`: checks source changes on GitHub.

## Hosting

This is a server-backed game. GitHub stores the source; GitHub Pages alone cannot run the multiplayer API or database.

The current production site remains hosted separately. This export intentionally excludes its private hosting configuration and Git history, as well as credentials and player data. Uploading this repository does not migrate the live player database.

To deploy a separate instance, use a compatible Cloudflare Workers/D1 hosting setup, bind a D1 database as `DB`, apply every SQL migration in filename order, and deploy the built Worker. Sites users should create a new project and use its own generated `.openai/hosting.json`, rather than reuse another site's identity.

Pocket notes are kept in the current browser. Player identity currently uses a browser token; account recovery and cross-device login are future work.

## Mobile direction

The first practical release is a PWA: installable app metadata, icons, a launch screen and an offline fallback. Online games still require a network connection and the backend.

For store-distributed iOS/Android apps, package a dedicated client with Capacitor, keep the multiplayer backend hosted, and add appropriate mobile lifecycle, navigation, account recovery, privacy/support pages and device testing before submission.
