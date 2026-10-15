# Moodboard Project Guide

## Overview

The Moodboard app is a desktop workspace for assembling visual ideas into a single board. Users can place images, type notes, rearrange objects, and change the overall look of the board using a floating toolbar.

## Intent of the project

This project is meant to feel like a lightweight creative board tool, similar to a simplified moodboard workspace. It focuses on fast visual composition rather than heavy editing features.

## UI architecture

The interface is built with React components and CSS styling.

### Frontend layers

- App root: handles the app shell and canvas rendering
- Canvas: manages board-level state
- Toolbar: handles board actions and dragging
- Board items: handles movement, resizing, and optional controls

### Important rule

Tauri is the desktop runtime, but not the source of the buttons and controls. The actual UI is custom code written in the frontend files.

## Key components

### 1. App entry

The app entry in [src/App.tsx](src/App.tsx) is intentionally minimal. It renders the full-screen canvas and imports the app styling.

This is where the project begins and where the root layout is assembled.

### 2. Canvas board

The canvas component in [src/components/C_canvas.tsx](src/components/C_canvas.tsx) is the core state manager. It keeps track of:

- image items
- text items
- theme mode

It passes callbacks to child components for updates and actions.

### 3. Floating toolbar

The floating toolbar in [src/components/C_floatingToolbar.tsx](src/components/C_floatingToolbar.tsx) is responsible for user actions. It supports:

- import image files
- add text boxes
- switch theme
- drag itself around the board

This is one of the most important UI elements in the app and it was designed to feel lightweight and floating.

### 4. Board items

The board item component in [src/components/C_boardItem.tsx](src/components/C_boardItem.tsx) renders both imported images and text boxes. It is memoized, so dragging one item only re-renders that item.

Features include:

- resize handles on selected items
- hover option bar beside the item, with delete (and edit for text boxes)
- double-click a text box to edit its text

Dragging, resizing, panning and box selection are handled once in the canvas, not per item. Pointer movement is divided by the zoom level, so items follow the cursor at any zoom, and dragging a selected item moves the whole selection.

## Styling approach

The styling is centralized in [src/App.css](src/App.css). It defines:

- background gradients
- floating toolbar visuals
- board item frames
- drag handles
- option buttons
- dark/light theme colors using CSS variables

This makes the board feel polished without requiring component libraries.

## State flow

The app uses local component state in React instead of a global state manager. That keeps the project simple and easy to follow.

Typical flow:

1. Toolbar action triggers a callback.
2. Parent canvas state updates.
3. Child board items re-render from the current state.
4. Drag or resize logic updates the matching item by ID.

## Suggested future enhancements

Possible improvements for the next iteration include:

- export board to image
- save and reopen board files
- support for reordering layers
- crop tools for imported images
- richer font controls
- undo/redo behavior
- smart object snapping

## Development notes

Use Vite for frontend development and Tauri for the desktop shell.

Recommended commands:

```bash
npm install
npm run dev
npm run build
npm run tauri
```

## Summary

The Moodboard is a custom-built React app wrapped in Tauri. The interface is not a library-provided set of widgets; it is fully designed by the project itself using HTML, CSS, and React interactions.
