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
