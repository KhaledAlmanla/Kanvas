---
Permission: AI allowed
---
# Changelog

All notable changes to Kanvas, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

Planned work is in the [Roadmap](Roadmap.md). Detailed notes on each change are in [AI output](AI%20output.md).

## [Unreleased]

### Added
- **Copy, cut and paste** (Ctrl+C, Ctrl+X, Ctrl+V). Selected images and text boxes are pasted at the mouse pointer with their layout kept, also into another board.
- **Paste images from other apps.** Ctrl+V adds a copied image, such as a screenshot or an image copied in a browser, or image files copied in the file manager.
- **Drag and drop image files** from a folder onto the board. They land where they are dropped.
- **Undo and redo** (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y), up to 100 steps. A whole drag, resize or text edit is one step.
- **Backup on save.** Each save keeps the previous version next to the board as `MyBoard.kanvas.bak`.
- **Paste image files copied in Windows Explorer or macOS Finder.**
- **Images resize like frames.** Dragging an image's edge or corner resizes its frame, and the picture fills it without stretching: dragging out first shows more of the picture, then zooms in.
- **Crop images,** like a frame in InDesign. Double-click an image (or click Crop in its option bar): the whole picture shows faded around the frame. Drag the frame's edges to crop, drag inside to slide the picture, and drag the square handles to make the picture bigger or smaller. Enter, Esc or a click outside finishes. Reset shows the whole picture again.
- **Shift+drag** an edge or corner to resize an image or text box, keeping its shape.
- **Ctrl+drag** an image's edge or corner to stretch the picture, also on the square handles in crop mode. Reset in crop mode removes the stretch.
- **F5** looks again for missing images, for example after putting a file back.

### Changed
- **Missing images are shown** as an "Image missing" box with the file name, and the board can still be saved.

### Fixed
- **Custom canvas colours.** The gradient start and end colours in Settings now show on the board.
- **Raising the minimum zoom** no longer makes the board jump; it zooms around the middle of the window.
- **The dot grid zooms and pans with the board** at every zoom level, instead of sliding past the images.

### Removed
- **Link image and Link document buttons.** These greyed-out toolbar buttons are gone. The features are dropped: import, paste or drag and drop images instead.
- **Export button** is hidden until it works.

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
