# Kanvas

**A free, simple mood board app for your desktop.** Collect images and notes on an endless canvas, arrange them freely, and keep every board as a plain folder on your own computer. No account, no cloud.

![A living-room mood board in Kanvas: a colour palette, furniture and decor images and two notes arranged on the dark dot-grid canvas, with the floating toolbar at the top](Screenshots/v0.9.0_Linux_01.png)

> [!NOTE]
> **Kanvas is a vibe-coded app.** It was designed, directed and tested by a person. The code was written by AI coding assistants (GitHub Copilot, then Claude). It's free to download and use. It's a beta, so expect some rough edges.

## What you can do

- Import images, paste them from other apps or drag them in from a folder, and add text notes.
- Move, resize and select several items at once; pan and zoom around the board.
- Undo and redo (Ctrl+Z, Ctrl+Shift+Z), and copy, cut and paste items between boards.
- Save each board as a folder: a `.kanvas` file plus copies of its images, so nothing breaks if the originals move. Each save keeps the previous one as a backup.
- Pick a dark, light or system theme, and customise colours, the grid, the toolbar and text defaults.
- Reopen recent boards from the toolbar.

## Download

**Linux (Debian, Ubuntu and similar, 64-bit):** [Kanvas_0.9.0_amd64.deb](https://github.com/KhaledAlmanla/Kanvas/releases/download/v0.9.0/Kanvas_0.9.0_amd64.deb)

```bash
sudo apt install ./Kanvas_0.9.0_amd64.deb   # install; Kanvas appears in your app menu under Graphics
sudo apt remove kanvas                      # uninstall
```

Windows and macOS versions are planned for 1.0. See all [releases](https://github.com/KhaledAlmanla/Kanvas/releases).

### Opening Kanvas for the first time on Windows or macOS

Kanvas is free and isn't signed with a paid developer certificate, so Windows and macOS warn you the first time you open it. This is expected.

- **Windows:** if "Windows protected your PC" appears, click **More info**, then **Run anyway**.
- **macOS:** open Kanvas once; macOS will refuse. Then go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to the Kanvas message. If macOS says Kanvas "is damaged", move it to Applications and run this in Terminal, then open it again:

  ```bash
  xattr -cr /Applications/Kanvas.app
  ```

## Status

**Current: 0.9.0 (beta).** **Next: 1.0:** Windows and macOS builds, and testing on all three systems.

- [Changelog](MoodBoard%20App/CHANGELOG.md): what changed in each version
- [Roadmap](MoodBoard%20App/Roadmap.md): what's planned

## Build it yourself

Kanvas is built with [Tauri 2](https://tauri.app) (Rust) and React with TypeScript. You need Node.js, Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system.

```bash
npm install
npm run tauri dev     # run the app while developing
npm run tauri build   # build an installable package
```

New to the code? The [Codebase Guide](MoodBoard%20App/Codebase%20Guide.md) explains how it's organised, in plain language.
