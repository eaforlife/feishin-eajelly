# EAJelly Fork Maintenance

Read this before syncing `upstream` (Feishin) or changing fork-specific configuration and dependencies. Keep this page short; update it when a customization, compatibility constraint, or sync convention changes.

## Fork identity

- `origin`: `eaforlife/feishin-eajelly`; `upstream`: `jeffvli/feishin`.
- Product/package: EAJelly (`package.json`, currently version `1.2.7`). The repo is a customization fork, not a clean mirror.
- Keep user-facing identity, release/update endpoints, and EAJelly service behavior intact when bringing upstream changes forward.

## Customization hotspots

Search these anchors before resolving upstream changes; this is a map, not a complete inventory.

- **Branding and release identity:** `package.json`, `src/main/index.ts`, `src/main/menu.ts`, `src/renderer/index.html`, `src/renderer/layouts/window-bar.tsx`, `src/renderer/hooks/use-github-releases.ts`, `.github/workflows/`.
- **EAJelly server compatibility:** `src/shared/utils/eajelly-server.ts`, `scripts/check-eajelly-fallback.mjs`, `package.json` (`check:eajelly-fallback`). Keep the `https://eajelly.xyz` behavior and its compatibility fallback covered by the existing check.
- **Local product changes:** inspect the fork-only commits and files touched in the branch being synchronized. In particular, preserve intentional EAJelly player/window behavior and release automation; do not assume every fork commit is branding-only.

To identify overlap efficiently, compare the proposed upstream range against the fork base and search only the touched paths for the anchors above. Review actual diffs; commit subjects and file names are clues, not proof of intent.

## Dependency compatibility

- Package manager is pinned to `pnpm@11.5.2`; use `pnpm-lock.yaml` as the resolved dependency source and keep it in sync with `package.json` and `pnpm-workspace.yaml`.
- Preserve exact versions where deliberately pinned: `@atlaskit/pragmatic-drag-and-drop` `1.7.7`; TanStack React Query packages `5.96.2`; `butterchurn` `3.0.0-beta.5`; `butterchurn-presets` `3.0.0-beta.4`; `fast-average-color` `9.5.0`; `node-mpv` commit `32b4d64395289ad710c41d481d2707a7acfc228f`; `react-window` `1.8.11` alongside the `react-window-v2` alias; `xml2js` `0.5.0` override.
- Keep the `xml2js` override aligned in `package.json` and `pnpm-workspace.yaml` if dependency configuration is reorganized. Preserve pnpm build-script allow/deny policy and the `taglib-wasm@1.5.1` release-age exception unless deliberately revalidated.
- When adopting upstream dependency changes, inspect direct pins, aliases, overrides, native Electron modules, and the resulting lockfile diff. Avoid changing resolved transitive versions without a specific compatibility reason.
- The desktop build depends on Electron/native modules and `node-mpv`; a renderer-only compatibility assumption is insufficient for changes that cross into main/preload or packaging. Read `docs/agents/architecture.md` for process/build boundaries.

## Upstream sync workflow

1. Fetch `upstream` and inspect its proposed commit range and changed paths before merging/rebasing.
2. Compare upstream changes with fork-only commits since the shared base. Resolve overlapping paths by preserving both upstream behavior and the documented EAJelly customization; don't blindly take either side.
3. Recheck branding/endpoints, fork release workflows, dependency constraints above, and process boundaries for affected files.
4. Use the smallest relevant checks already defined in `package.json`. For changes to the server fallback, run `pnpm check:eajelly-fallback`. For dependency changes, inspect the lockfile and use the repo's configured package manager. Run broader checks only when the change surface calls for them or the user requests them.
5. Update this page only when the customization map or compatibility constraints actually change.

Do not fetch external upstream documentation to rediscover details already present in this repository. Prefer the Git history, in-repo types/configuration, and targeted diffs to keep sync review focused.
