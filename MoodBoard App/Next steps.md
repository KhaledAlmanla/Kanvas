---
Permission: AI allowed
---
# Next steps: 1.0 test checklist

Tick each box (`- [x]`) once it works. Write what goes wrong under the item, and the AI fixes it from there. The plan is in the [Roadmap](Roadmap.md), and what changed is in the [CHANGELOG](CHANGELOG.md).

## What's new in this build (24.10.2026)

Image resizing, as agreed on 24.10.2026:
- **Normal mode:** dragging an image's edge or corner resizes the **frame**, and the picture is never stretched. Dragging outwards first shows more of the picture. Once a side is fully shown, the picture zooms in to keep filling the frame. Making the whole frame smaller makes the picture smaller.
- **Shift+drag** keeps the frame's shape (frame and picture scale together).
- **Ctrl+drag** stretches the picture with the frame. The stretch stays until Reset in crop mode.
- **Crop mode** (double-click, or Crop in the option bar): the round handles reshape the frame (crop), dragging inside slides the picture, and the **new square handles** on the faded picture scale it, keeping its shape. Ctrl+drag on them stretches it. The picture can't get smaller than the frame.
- **Reset** in crop mode shows the whole picture again and removes any stretching.

Earlier, on 21.10.2026: undo/redo, backup on save (`.kanvas.bak`), the "Image missing" box, F5 to look for missing images again, pasting files copied in a file manager, Export hidden, and board file format version 4 (crop).

## 1. Image resizing (this build)

- [x] Drag the right edge of a wide picture in a square frame: more of the picture shows, then it zooms in.
- [ ] Drag the bottom edge of the same image: it zooms in at once, nothing is stretched.
      AI comment (24.10.2026): unticked with no note. Did it go wrong, or is it not tested yet?
- [x] Drag a corner inwards: the picture gets smaller with the frame.
- [x] Shift+drag a corner: frame and picture scale together, same shape.
- [x] Ctrl+drag an edge: the picture stretches. A normal drag afterwards keeps the stretch.
- [x] Double-click: the round handles crop, dragging inside slides the picture.
- [x] Square handles scale the picture; Ctrl+square handles stretch it; it never gets smaller than the frame.
- [ ] Reset brings back the whole, unstretched picture.
      AI comment (24.10.2026): unticked with no note. Did it go wrong, or is it not tested yet?
- [x] Enter, Esc, a click outside or another double-click finishes crop mode.
- [x] Each drag is one undo step (Ctrl+Z), in both modes.
- [x] Save, close, reopen: crops and stretches are kept.
- [x] A board saved with 0.9.0 still opens and its images look as before.

## 2. Saving and safety

- [x] New, Open, Save, Save As (Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S).
- [x] Unsaved changes: the • in the title, and Save / Don't Save / Cancel on New, Open and closing.
- [x] `MyBoard.kanvas.bak` appears after the second save.
- [x] Delete or rename an image file outside Kanvas: "Image missing" shows, and the board still saves. Put it back and press F5: it shows again.
- [x] Undo and redo after adding, deleting, moving, pasting and typing.

## 3. Images in and out

- [x] Import with the toolbar button.
- [x] Paste a screenshot or an image copied in a browser (Ctrl+V).
- [x] Paste image files copied in the file manager.
- [x] Drag and drop image files from a folder.
- [x] Copy, cut and paste items within a board and into another board.

## 4. Settings dialog (from 0.9)

- [x] Theme: dark, light, follow system; per-board theme and background.
- [x] Colour schemes, accent colour, grid spacing, reset.
      **Dev comment:** custom gradient start and end not working;
      **AI comment (24.10.2026):** fixed. The gradient was also drawn on the dot-grid layer, which is over 10,000 px wide, so only a thin slice from its middle ever showed. Please test again.
- [ ] Zoom limits, option bar mode, toolbar size, remember toolbar position.
      **Dev comment:** There's a weird thing happening here: moving the  slider minimum zoom, to the right, enlarges the images.
      **AI comment (24.10.2026):** partly intended. If you're zoomed out further than the new minimum, the board zooms in to the minimum. What was wrong is that it zoomed from the top-left corner, so the board jumped. It now zooms around the middle of the window. Please test again.
      **Dev comment:** now I get it, but is still feel weird because the background not zooming in, it feelss like the images are just scaled up.
      **AI comment (24.10.2026):** you were right, that was a bug. The dots sat on a huge layer that zoomed around its own corner, far off-screen, so they slid past the images instead of growing with them. Now the dots are drawn on the window itself from the zoom and pan, so they grow, shrink and move exactly with the images (with the mouse wheel too). The colour gradient stays still on purpose: it's the window's backdrop. Please test again.
- [x] Text box defaults and live preview.
      **Dev comment:** what is that? what should I check?
      **AI comment (24.10.2026):** in Settings, the Text boxes section sets the font, size, colour and alignment for **new** text boxes. Check that the preview changes as you pick them, that a text box added afterwards uses them, and that existing text boxes don't change.
- [ ] Reopen last board, default folder, recent boards (on/off, count, clear).
- [ ] Shortcuts list and About section are correct.

## 5. Windows and macOS

- [ ] Windows: install (SmartScreen "Run anyway"), open, save, import, settings.
- [ ] macOS: install ("Open Anyway"), open, save, import, settings.
- [ ] Paste files copied in File Explorer / Finder.
- [ ] Drag and drop on both.
- [ ] Folders with spaces or special characters in their names.
- [ ] Open a board made on another system.

## 6. Large board

- [ ] 100+ big photos: zooming, panning and saving stay smooth.

## Still to decide or make before 1.0

- [ ] Freeze the file format: decide what layer order will need.
- [ ] App icon (it's still Tauri's default).
- [ ] README: a screenshot for each system and a short "Getting started".
