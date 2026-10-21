---
Permission: AI allowed
---
#### Changes by "GitHub Copilot"_ Date[03.10.2026]_time[12:56]:
- Refactored the board logic into the dedicated canvas component, leaving the app shell minimal and clean.
- Kept the floating toolbar as the board control surface while moving board state, item rendering, and theme handling into the canvas component.
- Added working image import behavior, rendering imported images onto the board as movable and resizable objects.
- Added text-box creation and content editing using a real textarea when the user enters edit mode.
- Added a dark/light theme toggle that switches the moodboard canvas and panel styling through shared CSS variables.
- Added hover option bars for board items, including delete controls for both imported images and text boxes.
- Verified the project still builds successfully after the refactor and feature additions using the production build command.
#### Changes by "Claude"_ Date[15.10.2026]_time[23:05]:
- Added a root `.gitignore` and stopped tracking `node_modules/`, `dist/` and Obsidian's `workspace.json`.
- Replaced the localStorage save with real board files on disk. Each board is its own folder: `MyBoard/MyBoard.kanvas` (JSON with positions, sizes, text, theme and view) plus `MyBoard/Images/` holding copies of every imported image. Image paths are stored relative to the board folder, so the folder can be moved.
- Added New board, Open board, Save and Save As to the floating toolbar, with Ctrl+N, Ctrl+O, Ctrl+S and Ctrl+Shift+S shortcuts.
- Unsaved changes show a • in the window title, and New, Open and closing the window ask Save / Don't Save / Cancel.
- The last opened board reopens on startup.
- Image import now uses the native file dialog and real file paths, so images survive restarts.
- Rust side: new commands `prepare_board_path`, `read_board`, `write_board` (writes through a temp file) and `copy_image_to_board` (unique file names, no duplicate copies), plus the dialog plugin and asset protocol. Added 5 Rust unit tests.
#### Changes by "Claude"_ Date[15.10.2026]_time[23:09]:
- Merged images and text boxes into one `items` list; its order is the stacking order (prepares for layer ordering and undo/redo).
- Replaced `C_Images.tsx`, `C_textBoxes.tsx` and the unused `C_optionsBar.tsx` with one memoized `C_boardItem.tsx`, so dragging re-renders only the moved items.
- Dragging, resizing, panning and box selection now run from one set of listeners in the canvas instead of two window listeners per item that were re-attached on every frame.
- Fixed: move and resize now follow the cursor at any zoom level.
- Fixed: dragging a selected item moves the whole selection; a plain click inside a selection selects just that item; Ctrl+click toggles; Ctrl+drag adds to the selection.
- Fixed: mouse-wheel zoom uses a non-passive listener, so the webview no longer scrolls or warns; scrolling inside a text box being edited still works.
- Fixed: right-click toolbar placement measures the real toolbar size instead of assuming 220px.
- Text boxes are edited with a double-click (matching the hint text), so dragging a text box no longer drops it into edit mode. The option bar no longer disappears while the mouse crosses the gap to it. The unfinished crop button is shown disabled.
- Board file format version 2 (single `items` list, string IDs). Version 1 boards still open and are upgraded on save.
- Updated README and PROJECT_GUIDE to match.
#### Changes by "Claude"_ Date[15.10.2026]_time[23:21]:
- Delete or Backspace now deletes all selected items (ignored while typing in a text box).
- Removed "reopen the last board on startup". The app now always starts with an empty Untitled board. It is listed in [[Settings Panel]] as an optional setting instead.

#### Changes by "Claude"_ Date[15.10.2026]_time[23:21]: Settings panel outline
- Wrote a proposal for the settings panel. Moved to its own note: [[Settings Panel]].

#### Changes by "Claude"_ Date[16.10.2026]_time[07:59]:
- Added [[Codebase Guide]] to the vault: a plain-language map of the code for a non-TypeScript/React/Rust reader. It covers the frontend/backend split, a folder map, a short intro to each language, how the app starts, what each file does, where data lives (including the .kanvas format), walkthroughs of dragging, saving, opening and closing, recipes for adding features (including a step-by-step starting point for the settings panel), commands to run, and a glossary.
- No code changes.
#### Changes by "Claude"_ Date[16.10.2026]_time[21:09]:
- Moved the settings panel outline out of this log into its own note, [[Settings Panel]]. The content is unchanged; its sub-titles are now headings.
- [[Codebase Guide]] now links to [[Settings Panel]].
#### Changes by "Claude"_ Date[16.10.2026]_time[21:29]:
- Built the first version of the settings dialog described in [[Settings Panel]]. It is a centered dialog, opened with the new gear button at the end of the toolbar or Ctrl+, and closed with Esc, ✕ or a click outside.
- Settings are saved automatically to `settings.json` in the app's config folder (Rust commands `load_settings` / `save_settings`). Missing or invalid values fall back to defaults.
- General: reopen last board on startup, default folder for Open / Save As, recent boards (on/off, 5 / 10 / 20, clear). Clicking Open in the toolbar now lists recent boards first, with "Browse…"; boards that can't be opened are removed from the list.
- Appearance: Dark / Light / Follow system; per-board theme and background (Dot grid / Plain), marked "This board"; grid spacing; accent colour (selection, handles); editable colour schemes for dark and light mode, with reset. The toolbar's theme button flips the board's theme if it has one, otherwise the app theme.
- Canvas and mouse: zoom limits, option bar mode (hover + selected / selected only / right-click only), remember toolbar position, toolbar size (small / medium / large).
- Text boxes: default font, size, colour and alignment for new text boxes, with a live preview. Text boxes now also keep line breaks.
- Keyboard shortcuts list and About section (version, file format, GitHub link).
- Images are now copied into the board's Images folder on import (on the first save for a never-saved board).
- Board file format is now version 3: a `settings` block (theme override, background) replaces `theme`; text boxes can carry a `style`. Older boards still open.
- Shown as "coming soon": paper texture, snapping, cleaning up unused images, autosave, backup, export options. Not done: always keep aspect ratio when resizing.
- Updated [[Settings Panel]] (status, answers), [[Codebase Guide]] (new files, where settings are stored, how to add a setting) and README.
#### Changes by "Claude"_ Date[16.10.2026]_time[23:00]:
- Set the app version to 0.9.0 (beta) in package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json, and tagged the commit `v0.9.0`.
- Planned for 1.0: undo/redo; hide or finish the disabled buttons (Link image, Link document, Export, Crop); build and test on Windows and macOS as well as Linux.
#### Changes by "Claude"_ Date[17.10.2026]_time[10:41]:
- Added [[CHANGELOG]] (what changed in each version, Keep a Changelog format, entries for 0.1.0 and 0.9.0) and [[Roadmap]] (the 1.0 plan and later features, as checkboxes).
- Both use standard Markdown links instead of [[wikilinks]], so they work in Obsidian and on GitHub.
- README now has a "Versions" section near the top (current version, what's next, links to both files), and its "Notes for future work" list points to the Roadmap.
#### Changes by "Claude"_ Date[17.10.2026]_time[10:49]:
- Release packaging for 0.9.0: the Linux package now installs the program as `kanvas` (was `the-moodboard`), describes itself as "Mood boards for the desktop" (was "A Tauri App"), lists Khaled Almanla as maintainer, and appears under Graphics in app menus.
- Built `Kanvas_0.9.0_amd64.deb` and moved the local `v0.9.0` tag to the commit containing the changelog and these packaging fixes (the tag had not been pushed yet).
#### Changes by "Claude"_ Date[17.10.2026]_time[12:19]:
- README: added a Download section with a direct link to `Kanvas_0.9.0_amd64.deb` on the v0.9.0 GitHub release, install and uninstall commands, and a link to all releases.
- README: the "Next: 1.0" line now also lists copy/paste and drag-and-drop for images, matching the user's additions to [[Roadmap]].
- The screenshot was left out at the user's request (it showed a private room).
#### Changes by "Claude"_ Date[17.10.2026]_time[12:31]:
- Rewrote README.md for GitHub visitors and made it shorter (about 50 lines instead of about 190). It now covers: what Kanvas is and why (local, no account, boards are plain folders), the new screenshot (`Screenshots/v0.9.0_Linux_01.png`), a clear note that it is a free, vibe-coded app written by AI coding assistants, what you can do, the Linux download, status with links to [[CHANGELOG]] and [[Roadmap]], and how to build it.
- The old technical sections (structure, components, data model, board files, settings location) were removed from the README. [[Codebase Guide]] covers them, and the README links to it.
#### Changes by "Claude"_ Date[20.10.2026]_time[21:25]:
- Added `CLAUDE.md` at the project root. Claude Code reads it at the start of every session. It describes the app and stack, points to [[Codebase Guide]], [[APP design]], [[Roadmap]] and [[CHANGELOG]], lists the build and check commands, and turns the note permissions and the AI output format from [[AI prompt]] into hard rules.
- Added `.claude/settings.json`. Claude may run build, check and read-only git commands without asking, and is blocked from editing `APP design.md`, `AI prompt.md` and `MoodBoard.md`.
- Added the `/log-changes` skill (`.claude/skills/log-changes/`). After a piece of work it adds an entry here, adds user-facing lines to the CHANGELOG's Unreleased section and ticks finished Roadmap items.
- Added the `/release` skill (`.claude/skills/release/`). It checks the project builds, sets the new version in all five files that hold it, turns Unreleased into a dated CHANGELOG section, updates the README download links, then commits, tags and pushes after the user confirms, so GitHub Actions builds the draft release. Only the user can start it.
#### Changes by "Claude"_ Date[21.10.2026]_time[21:29]:
- Removed the greyed-out **Link image** and **Link document** buttons from the floating toolbar (`src/components/C_floatingToolbar.tsx`), with their action types and icons. This follows the user's decision in [[APP design]] to drop both features: importing (plus paste and drag and drop) already covers images, and keeping each board a self-contained folder matters more than linking to outside files. Copying large documents to show one part of them doesn't fit a moodboard; other tools do that better.
- [[Roadmap]]: the 1.0 "No unfinished buttons" item now covers only Export and Crop and stays unticked. The "Link images and documents" item under Later is struck through and marked as dropped.
