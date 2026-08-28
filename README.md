<img src="assets/icons/icon.png" alt="logo" title="feishin" align="right" height="60px" width="60px" />

# EAJelly Desktop

This is a personal EAJelly-focused distribution of
[Feishin](https://github.com/jeffvli/feishin). It connects to
`http://eajelly.xyz` by default and is released for Windows and macOS.

The Windows installer detects the upstream Feishin application and, after
confirmation, uninstalls it before installing EAJelly. Feishin user data is not
removed by this migration.

Run the desktop app with `--server-override` to restore Feishin's server setup
and selection interface. See [NOTICE](NOTICE) for attribution, warranty, and
plain HTTP security information.

  <p align="center">
    <a href="https://github.com/eaforlife/feishin-eajelly/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/eaforlife/feishin-eajelly?style=flat-square&color=brightgreen"
      alt="License">
    </a>
      <a href="https://github.com/eaforlife/feishin-eajelly/releases">
      <img src="https://img.shields.io/github/v/release/eaforlife/feishin-eajelly?style=flat-square&color=blue"
      alt="Release">
    </a>
    <a href="https://github.com/eaforlife/feishin-eajelly/releases">
      <img src="https://img.shields.io/github/downloads/eaforlife/feishin-eajelly/total?style=flat-square&color=orange"
      alt="Downloads">
    </a>
  </p>
  <p align="center">
    <a href="https://discord.gg/FVKpcMDy5f">
      <img src="https://img.shields.io/discord/922656312888811530?color=black&label=discord&logo=discord&logoColor=white"
      alt="Discord">
    </a>
    <a href="https://matrix.to/#/#sonixd:matrix.org">
      <img src="https://img.shields.io/matrix/sonixd:matrix.org?color=black&label=matrix&logo=matrix&logoColor=white"
      alt="Matrix">
    </a>
  </p>

---

Rewrite of [Sonixd](https://github.com/jeffvli/sonixd).

## Features

- [x] MPV player backend
- [x] Web player backend
- [x] Modern UI
- [x] Scrobble playback to your server
- [x] Smart playlist editor (Navidrome)
- [x] Synchronized and unsynchronized lyrics support
- [ ] [Request a feature](https://github.com/eaforlife/feishin-eajelly/issues)

## Screenshots

<a href="./media/preview_full_screen_player.png"><img src="./media/preview_full_screen_player.png" width="49.5%"/></a> <a href="./media/preview_album_artist_detail.png"><img src="./media/preview_album_artist_detail.png" width="49.5%"/></a> <a href="./media/preview_album_detail.png"><img src="./media/preview_album_detail.png" width="49.5%"/></a> <a href="./media/preview_smart_playlist.png"><img src="./media/preview_smart_playlist.png" width="49.5%"/></a>

## Getting Started

### Desktop (recommended)

Download the [latest desktop client](https://github.com/eaforlife/feishin-eajelly/releases). The desktop client supports both the MPV and web player backends and includes built-in lyrics fetching.

#### macOS Notes

If you're using a device running macOS 12 (Monterey) or higher, [check here](https://github.com/jeffvli/feishin/issues/104#issuecomment-1553914730) for instructions on how to remove the app from quarantine.

For media keys to work, you will be prompted to allow EAJelly to be a Trusted Accessibility Client. After allowing, restart EAJelly for the privacy settings to take effect.

### Configuration

1. Upon startup you will be greeted with a prompt to select the path to your MPV binary. If you do not have MPV installed, you can download it [here](https://mpv.io/installation/) or install it using any package manager supported by your OS. After inputting the path, restart the app.

2. Sign in with your EAJelly credentials. The server is already configured as `http://eajelly.xyz`.

3. To use another compatible server temporarily, start EAJelly with `--server-override` and use the restored server management interface.

## FAQ

### MPV is either not working or is rapidly switching between pause/play states

First thing to do is check that your MPV binary path is correct. Navigate to the settings page and re-set the path and restart the app. If your issue still isn't resolved, try reinstalling MPV. Known working versions include `v0.35.x` and `v0.36.x`. `v0.34.x` is a known broken version.

### What music servers does Feishin support?

Feishin supports any music server that implements a [Navidrome](https://www.navidrome.org/), [Jellyfin](https://jellyfin.org/), or [OpenSubsonic compatible](https://opensubsonic.netlify.app/) API.

- [Navidrome](https://github.com/navidrome/navidrome)
- [Jellyfin](https://github.com/jellyfin/jellyfin)
- [OpenSubsonic](https://opensubsonic.netlify.app/) compatible servers, such as...
    - [Airsonic-Advanced](https://github.com/airsonic-advanced/airsonic-advanced)
    - [Ampache](https://ampache.org)
    - [Astiga](https://asti.ga/)
    - [Funkwhale](https://www.funkwhale.audio/)
    - [Gonic](https://github.com/sentriz/gonic)
    - [LMS](https://github.com/epoupon/lms)
    - [Nextcloud Music](https://apps.nextcloud.com/apps/music)
    - [Supysonic](https://github.com/spl0k/supysonic)
    - [Qm-Music](https://github.com/chenqimiao/qm-music)
    - More (?)

- [Plex](https://www.plex.tv/media-server-downloads)
    - [Feishin fork by lux032](https://github.com/lux032/feishin) - Plex is not natively supported. Use the fork by lux032 to use Plex with Feishin.

### I have the issue "The SUID sandbox helper binary was found, but is not configured correctly" on Linux

This happens when you have user (unprivileged) namespaces disabled (`sysctl kernel.unprivileged_userns_clone` returns 0). You can fix this by either enabling unprivileged namespaces, or by making the `chrome-sandbox` Setuid.

```bash
chmod 4755 chrome-sandbox
sudo chown root:root chrome-sandbox
```

Ubuntu 24.04 specifically introduced breaking changes that affect how namespaces work. Please see https://discourse.ubuntu.com/t/ubuntu-24-04-lts-noble-numbat-release-notes/39890#:~:text=security%20improvements%20 for possible fixes.

### How can I add custom themes?

On the desktop app, you can add custom themes by dropping JSON files into the Themes folder (Settings → General → Theme → Open Folder). See [the custom themes documentation](docs/CUSTOM_THEMES.md) for the file format and examples.

## Development

Built and tested using Node `v23.11.0`.

This project is built off of [electron-vite](https://github.com/alex8088/electron-vite)

- `pnpm run dev` - Start the development server
- `pnpm run dev:watch` - Start the development server in watch mode (for main / preload HMR)
- `pnpm run start` - Starts the app in production preview mode
- `pnpm run build` - Builds the app for desktop
- `pnpm run build:electron` - Build the electron app (main, preload, and renderer)
- `pnpm run build:remote` - Build the remote app (remote)
- `pnpm run build:web` - Build the standalone web app (renderer)
- `pnpm run package` - Package the project
- `pnpm run package:dev` - Package the project for development locally
- `pnpm run package:linux` - Package the project for Linux locally
- `pnpm run package:mac` - Package the project for Mac locally
- `pnpm run package:win` - Package the project for Windows locally
- `pnpm run publish:mac` - Publish the project for Mac
- `pnpm run publish:win` - Publish the project for Windows
- `pnpm run typecheck` - Type check the project
- `pnpm run typecheck:node` - Type check the project with tsconfig.node.json
- `pnpm run typecheck:web` - Type check the project with tsconfig.web.json
- `pnpm run lint` - Lint the project
- `pnpm run lint:fix` - Lint the project and fix linting errors
- `pnpm run i18next` - Generate i18n files

## Translation

This project uses [Weblate](https://hosted.weblate.org/projects/feishin/) for translations. If you would like to contribute, please visit the link and submit a translation.

## License

[GNU General Public License v3.0](LICENSE). See [NOTICE](NOTICE) for upstream
attribution and the modified-distribution disclaimer.
