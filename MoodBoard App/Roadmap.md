---
Permission: AI allowed
---
# Roadmap

What's planned for Kanvas. Plans can change; what actually shipped is in the [Changelog](CHANGELOG.md).

Tick a box (`- [x]`) when something is done, and move it to the Changelog's **Unreleased** section.

## 1.0: stable release

The goal: safe to use for real work, nothing in the toolbar that doesn't work, and it runs on all three systems.

- [ ] **Undo and redo** (Ctrl+Z, Ctrl+Shift+Z), so a stray Delete can't lose work.
- [ ] **No unfinished buttons.** For each of Export, Crop, Link image and Link document, either build it or hide it until it's ready.
- [ ] **Always keep the aspect ratio** when resizing images (from the [Settings Panel](Settings%20Panel.md) notes).
- [ ] **Windows and macOS builds,** each tested at least once (open, save, import, settings). Today only a Linux `.deb` is built.
- [ ] Test the 0.9 settings dialog in the running app and fix what turns up.
- [ ] Copy paste images into the board, and with in the board.
- [ ] Drag and drop images  into the board.

## Later

Features from [APP design](APP%20design.md) and [Settings Panel](Settings%20Panel.md), in no particular order.

### Board and editing
- [ ] Export the board as an image (PNG/JPG, 1x/2x/4x, into the board's Export folder).
- [ ] Crop images.
- [ ] Link images and documents.
- [ ] Layer ordering (bring forward, send backward).
- [ ] Change the style of an existing text box (font, size, colour, alignment).
- [ ] Snap to grid or to other items.
- [ ] Using ctrl or other modifiers  will lock the aspect ratio while doing scale transform.
- [ ] Remember the last folder the user opened.
- [ ] When importing an image, it is to be loaded in the middle of the visible part of the canvas.

### Canvas look
- [ ] Paper texture background.

### Saving and files
- [ ] Autosave every 1, 5 or 10 minutes.
- [ ] Keep a backup (`.kanvas.bak`) of the previous save.
- [ ] Clean up images in the Images folder that no item uses.

### Ideas
- [ ] The ideas in [MoodBoard](MoodBoard.md): freehand cutting, merging images, a music version.
