# Kanvas

Kanvas is a desktop app for creating visual inspiration boards. It combines a draggable canvas, image imports, editable text boxes, and light/dark theme switching in a simple desktop workspace.

## What this app does

The app lets users:

- import one or more images into a board
- drag images around the canvas
- resize images with resize handles
- add editable text boxes
- drag and reposition text boxes
- switch between dark and light themes
- work in a floating control panel that can be moved around the board

This project is built with React for the UI and Tauri for the desktop shell.

## Tech stack

- React 19
- TypeScript
- Vite
- Tauri 2
- CSS for styling and layout

## Architecture

The UI is custom code in the frontend, not drawn from a Tauri widget library. Tauri is used to package the app as a desktop application, while the interface itself is created using React components and CSS.

### Main structure

- [src/App.tsx](src/App.tsx) — app entry point, renders the main canvas
- [src/components/C_canvas.tsx](src/components/C_canvas.tsx) — holds board state and renders images/text boxes
- [src/components/C_floatingToolbar.tsx](src/components/C_floatingToolbar.tsx) — draggable floating action toolbar
- [src/components/C_Images.tsx](src/components/C_Images.tsx) — image item behavior, dragging, resizing, delete actions
- [src/components/C_textBoxes.tsx](src/components/C_textBoxes.tsx) — editable text box behavior
- [src/App.css](src/App.css) — all styling for layout, toolbar, board items, and interactions

## Component overview

### App shell

The root app simply renders the moodboard canvas inside a full-screen container.

### Moodboard canvas

The canvas component manages the collection of board elements:

- images state
- text boxes state
- theme state
- add image handler
- add text handler
- theme toggle handler

The state is kept locally in React, which makes the app simple and fast for a single-board workflow.

### Floating toolbar

The floating toolbar provides the main actions:

- import image files
- add a new text box
- toggle theme
- drag the toolbar around the canvas

It includes a special drag handle and a file input hidden behind the import button.

### Image cards

Each imported image is represented as a draggable, resizable block. The item supports:

- move by dragging
- resize by dragging a resize handle
- hover actions for delete or crop controls
- rendering inside an absolute-positioned board layer

### Text boxes

Text boxes support:

- drag to reposition
- resize the box dimensions
- inline editing with a textarea
- delete actions
- hover option bar

## Data model

The board items are simple TypeScript objects.

### Image item

- id: unique numeric ID
- src: image source URL
- name: file name
- x, y: position on the board
- width, height: item size

### Text box item

- id: unique numeric ID
- x, y: position on the board
- width, height: box size
- text: text content

## How the app works

1. User clicks the import button in the floating toolbar.
2. The file picker opens and accepts images.
3. Each selected file is turned into an object with position and dimensions.
4. The image is added to the canvas state and rendered as a draggable block.
5. When the user adds text, a new text box item is added to state.
6. Movement and resizing are handled by pointer events and state updates.
7. Theme switching changes CSS variables so the board can swap between dark and light modes.

## Development commands

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Run the Tauri desktop app:

```bash
npm run tauri
```

## Notes for future work

This app is a solid foundation for adding:

- export to PNG or PDF
- layer ordering and selection
- drag-and-drop reordering
- richer text formatting
- undo/redo history
- saving/loading boards
- AI-assisted moodboard generation

## Summary

The Moodboard project is a custom React + CSS desktop app wrapped in Tauri. The interface is not coming from Tauri widgets; it is designed and implemented directly in the application code, giving full control over layout, interaction, and visual design.
