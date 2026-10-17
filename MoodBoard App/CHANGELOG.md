---
Permission: AI allowed
---
# Changelog

All notable changes to Kanvas, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

Planned work is in the [Roadmap](Roadmap.md). Detailed notes on each change are in [AI output](AI%20output.md).

## [Unreleased]

Nothing yet.

## [0.9.0] - 2026-10-16

First beta.

### Added
- **Boards saved as files.** Each board is its own folder: `MyBoard/MyBoard.kanvas` plus an `Images/` folder with copies of every imported image. The folder can be moved or shared without breaking anything.
- **New, Open, Save and Save As** in the toolbar, with Ctrl+N, Ctrl+O, Ctrl+S and Ctrl+Shift+S.
- **Unsaved changes are protected.** A • in the window title shows unsaved changes, and New, Open and closing the window ask Save / Don't Save / Cancel.
- **Recent boards.** Clicking Open in the toolbar lists them first.
- **Settings dialog** (gear button or Ctrl+,):
  - Theme: dark, light or follow the system, plus a per-board theme and background.
  - Editable colour schemes for dark and light mode, accent colour and grid spacing.
  - Zoom limits, when the option bar shows, toolbar size and remembered toolbar position.
  - Default font, size, colour and alignment for new text boxes.
  - Reopen the last board on startup, and a default folder for boards.
  - A keyboard shortcuts list and an About section.
- **Delete or Backspace** deletes the selected items.
- **Multi-selection.** Dragging a selected item moves the whole selection, Ctrl+click adds or removes items, and Ctrl+drag adds to the selection.

### Changed
- Text boxes are edited with a double-click (or the pencil button), so dragging a text box no longer starts editing.
- Imported images are copied into the board's Images folder right away (on the first save for a new board).
- Text boxes keep line breaks.
- Faster dragging on boards with many items.

### Fixed
- Moving and resizing now follow the mouse at any zoom level.
- Mouse-wheel zoom no longer scrolls the window.
- The toolbar no longer goes off-screen when moved with a right-click near the window edge.
- The option bar no longer disappears while the mouse moves towards it.

## [0.1.0] - 2026-10-11

First prototype.

### Added
- Canvas with dot grid, middle-mouse panning and mouse-wheel zoom.
- Import images; move and resize images and text boxes.
- Editable text boxes.
- Box selection and Ctrl+click selection.
- Floating toolbar that can be dragged, or moved to the pointer with a right-click.
- Dark and light theme.

[Unreleased]: https://github.com/KhaledAlmanla/Kanvas/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/KhaledAlmanla/Kanvas/releases/tag/v0.9.0
