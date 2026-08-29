# Changelog

All notable changes to EAJelly Desktop are documented here.

## 1.1.0 - 2026-08-29

- Branded the window title as EAJelly Music by Feishin.
- Enabled ReplayGain track mode and the compressor by default, with the compressor toggle locked on.
- Resized the mini player to 360 pixels and kept it within the screen while preserving its position when toggling the queue.

## 1.0.2 - 2026-08-29

- Enlarged the mini player to a DPI-aware 420-pixel square with a top-right display inset.
- Made the queue replace the cover or lyrics within the same frame instead of widening the window.
- Hid inherited lyric editing controls and disabled lyric pointer interactions in mini-player mode.
- Unified the exit and playback control fade behavior, normalized control sizing, and closed the volume popup on pointer exit.
- Enabled ReplayGain track mode by default and migrated existing profiles so tagged Jellyfin audio is normalized.

## 1.0.1 - 2026-08-28

- Anchored the mini player to the lower-right and made its queue expand left within the active display.
- Added a lyrics toggle that replaces the cover art without changing the cover panel dimensions.
- Added a compact mini-player volume control with mute and a slider.
- Replaced the repeat and repeat-one controls with heavier, more visible icons.
- Made mini-player controls fade out with the pointer, matching the restore control.

## 1.0.0 - 2026-08-28

- Set HTTPS EAJelly as the built-in Jellyfin server with network-only HTTP fallback.
- Added `--server-override` to restore manual server configuration when needed.
- Moved update checks and release links to the EAJelly GitHub repository.
- Added Windows and macOS release workflows.
- Added Windows migration from an existing Feishin installation.
- Added a persistent, always-on-top cover-art mini player with playback controls and an expandable queue.
- Improved startup behavior and deferred nonessential work.
- Added Jellyfin 12-compatible login response handling and authentication diagnostics.
- Added EAJelly notices while preserving the GPL-3.0-only license and upstream attribution.
