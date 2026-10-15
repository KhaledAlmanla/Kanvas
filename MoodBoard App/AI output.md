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
- Removed "reopen the last board on startup". The app now always starts with an empty Untitled board. It is listed below as an optional setting instead.

#### Changes by "Claude"_ Date[15.10.2026]_time[23:21]: Settings panel outline (proposal, not implemented)

**Opening and closing**
- A gear button at the end of the floating toolbar, plus Ctrl+, (Cmd+, on macOS).
- Opens as a panel sliding in from the right edge of the window, over the canvas, using the same glass style as the toolbar. Escape or clicking the canvas closes it.
- Changes apply immediately; there is no OK/Apply button.

**Two kinds of settings**
- *App settings* apply to every board. Saved by Rust in the app's config folder (Linux `~/.config/com.krr.kanvas/settings.json`, Windows `%APPDATA%\com.krr.kanvas\`, macOS `~/Library/Application Support/com.krr.kanvas/`).
- *Board settings* belong to one board. Saved inside its `.kanvas` file, so changing them marks the board unsaved. Each board-level option is labelled "This board".

**Sections**
1. General
   - Reopen last board on startup (default: off).
   - Default folder for new boards (Save As starts there).
   - Recent boards: show list in Open, number of entries (5 / 10 / 20), "Clear list".
2. Appearance
   - Theme: Dark / Light / Follow system (app). Per-board theme override (This board).
   - Canvas background: Dot grid / Plain / Paper texture (This board; paper texture is from the ideas in MoodBoard.md).
   - Grid spacing (default 18px) and dot strength.
   - Accent colour for selection outlines and handles.
3. Canvas and mouse
   - Zoom speed, minimum and maximum zoom (now fixed at 50% to 500%).
   - Snap: off / to grid / to other items, with snap distance.
   - Option bar: on hover and selection (now) / only on selection / only on right-click.
   - Toolbar: remember its position between sessions.
4. Images
   - Default size of imported images (now 220px on the long side).
   - Keep aspect ratio when resizing (Shift does the opposite).
   - When to copy images into the board's Images folder: on import (as APP design.md describes) / on save (now).
   - "Clean up unused images" button: lists files in Images/ that no item uses and offers to delete them.
5. Text boxes
   - Default font, size, colour and alignment for new text boxes.
6. Saving
   - Autosave: off / every 1 / 5 / 10 minutes (only for boards that already have a file).
   - Keep a backup (`MyBoard.kanvas.bak`) of the previous save.
7. Export (once Export is built)
   - Format PNG / JPG, scale 1x / 2x / 4x, transparent or canvas background.
   - Destination: the board's Export folder (as APP design.md describes) or ask each time.
8. Keyboard shortcuts
   - Read-only list for now: Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Delete, Ctrl+click, middle-drag, wheel zoom.
9. About
   - App version, board file format version, link to the GitHub repo.

**Suggested build order**
1. Settings storage: Rust commands `load_settings` / `save_settings`, a typed settings object with defaults, and a React context so any component can read settings.
2. The panel shell (gear button, Ctrl+, , sections, Escape to close).
3. Wire up the cheap, high-value options first: reopen last board, theme incl. Follow system, default image size, option bar mode, autosave.
4. Add the rest as the related features land (snapping, export, text styling, cleanup).

**Questions for the user**
- Side panel, centered dialog, or a separate window?
- Should the board-level options live in this panel, or in a separate "Board settings" panel?
- Copy images on import or on save?
- Which sections matter for the first version, and which can wait?
