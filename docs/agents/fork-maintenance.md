# EAJelly Fork Maintenance

Read this before syncing `upstream` (Feishin) or changing fork-specific configuration and dependencies. Keep this page short; update it when a customization, compatibility constraint, or sync convention changes.

## Fork identity

- `origin`: `eaforlife/feishin-eajelly`; `upstream`: `jeffvli/feishin`.
- Fetch and merge from `upstream` only. Push commits, tags, and releases only to `origin`; never push or publish to Feishin or its package channels.
- Product/package: EAJelly (`package.json`, currently version `1.3.2`). The repo is a customization fork, not a clean mirror.
- Keep user-facing identity, release/update endpoints, and EAJelly service behavior intact when bringing upstream changes forward.

## Customization hotspots

Search these anchors before resolving upstream changes; this is a map, not a complete inventory.

- **Branding and release identity:** `package.json`, `electron-builder.yml`, `xyz.eajelly.desktop.metainfo.xml`, `scripts/after-all-artifact-build.mjs`, `scripts/update-app-stream.mjs`, `src/main/index.ts`, `src/main/menu.ts`, `src/renderer/index.html`, `src/renderer/layouts/window-bar.tsx`, `src/renderer/hooks/use-github-releases.ts`, `.github/workflows/`.
- **EAJelly server compatibility:** `src/shared/utils/eajelly-server.ts`, `scripts/check-eajelly-fallback.mjs`, `package.json` (`check:eajelly-fallback`). Keep the `https://eajelly.xyz` behavior and its compatibility fallback covered by the existing check.
- **Local product changes:** inspect the fork-only commits and files touched in the branch being synchronized. In particular, preserve intentional EAJelly player/window behavior and release automation; do not assume every fork commit is branding-only.

To identify overlap efficiently, compare the proposed upstream range against the fork base and search only the touched paths for the anchors above. Review actual diffs; commit subjects and file names are clues, not proof of intent.

## Dependency compatibility

- Package manager is pinned to `pnpm@11.5.2`; use `pnpm-lock.yaml` as the resolved dependency source and keep it in sync with `package.json` and `pnpm-workspace.yaml`.
- Preserve exact versions where deliberately pinned: `@atlaskit/pragmatic-drag-and-drop` `1.7.7`; TanStack React Query packages `5.96.2`; `butterchurn` `3.0.0-beta.5`; `butterchurn-presets` `3.0.0-beta.4`; `fast-average-color` `9.5.0`; `node-mpv` commit `32b4d64395289ad710c41d481d2707a7acfc228f`; `react-window` `1.8.11` alongside the `react-window-v2` alias; `xml2js` `0.5.0` override.
- Keep the `xml2js` override aligned in `package.json` and `pnpm-workspace.yaml` if dependency configuration is reorganized. Preserve pnpm build-script allow/deny policy and the `taglib-wasm@1.5.1` release-age exception unless deliberately revalidated.
- When adopting upstream dependency changes, inspect direct pins, aliases, overrides, native Electron modules, and the resulting lockfile diff. Avoid changing resolved transitive versions without a specific compatibility reason.
- The desktop build depends on Electron/native modules and `node-mpv`; a renderer-only compatibility assumption is insufficient for changes that cross into main/preload or packaging. Read `docs/agents/architecture.md` for process/build boundaries.

## EAJelly compatibility notes

- The Jellyfin API client retries the exact EAJelly HTTPS host over HTTP only on a network error, then validates the successful response. Keep the fallback inside the common client so password and Quick Connect calls share it; `pnpm check:eajelly-fallback` protects the host matching rule.
- The settings store is at version `37`. Its migration preserves the fork's ReplayGain/compressor defaults, adds upstream's Playlists home item, and sets the default Playlist list to Grid with Large cards for existing installs.
- Jellyfin's `GET /users/{id}` auth check bypasses the generic 401 logout handler so `useServerAuthenticated` can retry with a saved password. After successful re-authentication, it restores that server as current; keep this flow intact when changing auth interceptors or the auth outlet.
- Jellyfin's `GET /Audio/{id}/Lyrics` may return 401 while other server requests and playback remain valid. Treat that endpoint's failure as unavailable lyrics; do not clear credentials or log out for its 401 response.
- Server lock mode keeps server selection/manage actions hidden; the rescan action is limited to administrators. Preserve the upstream menu's `showMainWindow` callback and EAJelly's `xyz.eajelly.desktop` app identity when resolving main-process changes.
- Release and update endpoints must remain on `eaforlife/feishin-eajelly`. Do not carry upstream-specific package publishing actions or identifiers into this fork.
- A `v*.*.*` tag starts the consolidated desktop and Docker builds. The release job waits for all platforms, then creates a published (non-draft) GitHub release with Windows and macOS updater assets; keep every package and release target scoped to this fork.
- Linux artifacts ship `xyz.eajelly.desktop.metainfo.xml`; keep its AppStream ID and launchable aligned with `electron-builder.yml` (`xyz.eajelly.desktop`).
- The renderer opens the server's Playlists list at `/` and after sign-in; the Home page remains at `/home`. Preserve both routes when changing startup navigation.

## EAJelly versioning

For a requested version bump, increment the patch by one through `.99`, then increment the minor and reset patch to zero (for example, `1.2.7` to `1.2.8` and `1.2.99` to `1.3.0`). Follow an explicit version supplied by the user, including a requested skip. Keep `package.json`, the Git tag, release title, and updater metadata on the same version.

## Upstream sync workflow

1. Fetch upstream branches without tags (`git fetch --no-tags upstream`) because Feishin and EAJelly can reuse version tag names. Inspect the proposed commit range and changed paths before merging/rebasing.
2. Compare upstream changes with fork-only commits since the shared base. Resolve overlapping paths by preserving both upstream behavior and the documented EAJelly customization; don't blindly take either side.
3. Recheck branding/endpoints, fork release workflows, dependency constraints above, and process boundaries for affected files.
4. Use the smallest relevant checks already defined in `package.json`. For changes to the server fallback, run `pnpm check:eajelly-fallback`. For dependency changes, inspect the lockfile and use the repo's configured package manager. Run broader checks only when the change surface calls for them or the user requests them.
5. Before pushing, review every workflow trigger and external destination. Release metadata and automatic updates belong to this fork; do not publish artifacts or changes to Feishin's repository/package channels.
6. The Test workflow lints first-parent commits so upstream history imported by a merge is not re-linted against EAJelly's commit rules.
7. Update this page only when the customization map or compatibility constraints actually change.

Do not fetch external upstream documentation to rediscover details already present in this repository. Prefer the Git history, in-repo types/configuration, and targeted diffs to keep sync review focused.
