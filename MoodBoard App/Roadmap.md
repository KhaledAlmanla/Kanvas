---
Permission: AI allowed
---
# Roadmap

What's planned for Kanvas. Plans can change; what actually shipped is in the [Changelog](CHANGELOG.md).

Tick a box (`- [x]`) when something is done, and move it to the Changelog's **Unreleased** section.

## 1.0: stable release

The goal: safe to use for real work, nothing in the toolbar that doesn't work, and it runs on all three systems.

- [x] **Undo and redo** (Ctrl+Z, Ctrl+Shift+Z), so a stray Delete can't lose work.
- [x] **No unfinished buttons.** For Export and Crop, either build it or hide it until it's ready. (Link image and Link document were dropped and removed from the toolbar. Export and Crop are hidden; they stay on the list below.)
- [x] **Always keep the aspect ratio** when resizing images (from the [Settings Panel](Settings%20Panel.md) notes).
- [ ] **Windows and macOS builds,** each tested at least once (open, save, import, settings). GitHub Actions now builds all three; they still need testing.
- [ ] Test the 0.9 settings dialog in the running app and fix what turns up.
- [x] **Missing images are shown,** as an "Image missing" box with the file name, instead of an empty frame. The board still saves.
- [x] **Backup on save:** each save keeps the previous one as `MyBoard.kanvas.bak`.
- [x] **Install help for unsigned builds** in the README (Windows SmartScreen, macOS "Open Anyway").
- [ ] **Test on Windows and macOS:** pasting image files copied in File Explorer / Finder, drag and drop, folders with spaces or special characters in their names, and opening a board made on another system.
- [ ] **Freeze the file format.** Decide what crop and layer order will need, so boards made with 1.0 open in every later version.
- [ ] **Large-board test:** 100+ big photos; zooming, panning and saving should stay smooth.
- [ ] **App icon:** replace Tauri's default icon with a Kanvas one.
- [ ] README: a screenshot for each system and a short "Getting started".

## Later

Features from [APP design](APP%20design.md) and [Settings Panel](Settings%20Panel.md), in no particular order.

### Board and editing
- [ ] Export the board as an image (PNG/JPG, 1x/2x/4x, into the board's Export folder).
- [ ] Crop images.
- [x] ~~Link images and documents.~~ Dropped: importing already covers images, and copying large documents to show one part of them doesn't fit a moodboard.
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
- [x] Keep a backup (`.kanvas.bak`) of the previous save.
- [ ] Clean up images in the Images folder that no item uses.

### Ideas
- [ ] The ideas in [MoodBoard](MoodBoard.md): freehand cutting, merging images, a music version.
