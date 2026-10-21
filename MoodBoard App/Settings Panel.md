---
Permission: AI allowed
---
# Settings panel

Proposal for the Kanvas settings panel. Written by Claude on 15.10.2026, 23:21, and moved here from [[AI output]]. **First version built on 16.10.2026, 21:28** (see Status below).

Related: [[APP design]] · [[Codebase Guide]] (section 8, Recipe D, shows where in the code to start)

## Status (16.10.2026, 21:28)
**Built:**
- Centered dialog: gear button at the end of the toolbar, or Ctrl+, . Esc, the ✕ button or clicking outside closes it.
- General: reopen last board, default folder for boards, recent boards (on/off, 5 / 10 / 20, clear list). Clicking Open in the toolbar now shows recent boards first, with "Browse…" for the file dialog. Ctrl+O still goes straight to the file dialog.
- Appearance: theme Dark / Light / Follow system; per-board theme override and background (Dot grid / Plain) marked "This board"; grid spacing; accent colour; a colour scheme for each of dark and light mode (7 colours + grid dot strength, with reset).
- Canvas and mouse: minimum and maximum zoom, option bar mode, remember toolbar position, toolbar size.
- Text boxes: default font, size, colour (or follow theme) and alignment for new text boxes, with a preview.
- Keyboard shortcuts list and About (version, file format, GitHub link).
- Images are now copied into the board's Images folder on import (on first save for a never-saved board). Not a setting.

**Shown as "coming soon" in the dialog:** paper texture, snapping, clean up unused images, autosave, export options.

**Done since:** images always keep their aspect ratio when resized (your note in section 4), and each save keeps a backup (`.kanvas.bak`). Neither is a setting; the Images & saving section mentions both.

## Opening and closing
- A gear button at the end of the floating toolbar, plus Ctrl+, (Cmd+, on macOS).
- Opens as a panel sliding in from the right edge of the window, over the canvas, using the same glass style as the toolbar. Escape or clicking the canvas closes it.
- Changes apply immediately; there is no OK/Apply button.

## Two kinds of settings
- *App settings* apply to every board. Saved by Rust in the app's config folder (Linux `~/.config/com.krr.kanvas/settings.json`, Windows `%APPDATA%\com.krr.kanvas\`, macOS `~/Library/Application Support/com.krr.kanvas/`).
- *Board settings* belong to one board. Saved inside its `.kanvas` file, so changing them marks the board unsaved. Each board-level option is labelled "This board".

## Sections
1. General
   - Reopen last board on startup (default: off).
   - Default folder for new boards (Save As starts there).
   - Recent boards: show list in Open, number of entries (5 / 10 / 20), "Clear list".
2. Appearance
   - Theme: Dark / Light / Follow system (app). Per-board theme override (This board).
   - Color scheme, defines the RGB values for both light and dark modes.
   - Canvas background: Dot grid / Plain / Paper texture (This board; paper texture is from the ideas in MoodBoard.md).
   - Grid spacing (default 18px) and dot strength.
   - Accent colour for selection outlines and handles.
3. Canvas and mouse
   - Minimum and maximum zoom (now fixed at 50% to 500%).
   - Snap: off / to grid / to other items, with snap distance.
   - Option bar: on hover and selection (now) / only on selection / only on right-click.
   - Toolbar: remember its position between sessions.
   - Toolbar size.
4. Images
   - ~~Default size of imported images (now 220px on the long side).~~ no need for that.
   - ~~Keep aspect ratio when resizing (Shift does the opposite).~~ Always keep aspect ratio.
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

## Suggested build order
1. Settings storage: Rust commands `load_settings` / `save_settings`, a typed settings object with defaults, and a React context so any component can read settings.
2. The panel shell (gear button, Ctrl+, , sections, Escape to close).
3. Wire up the cheap, high-value options first: reopen last board, theme incl. Follow system, default image size, option bar mode, autosave.
4. Add the rest as the related features land (snapping, export, text styling, cleanup).

## Questions (answered 16.10.2026)
- Side panel, centered dialog, or a separate window? → **Centered dialog.**
- Should the board-level options live in this panel, or in a separate "Board settings" panel? → **Same panel**, marked "This board".
- Copy images on import or on save? → **On import.**
- Which sections matter for the first version, and which can wait? → **Core settings, recent boards and text defaults.** The rest waits.
