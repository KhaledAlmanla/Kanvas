import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import FloatingToolbar from "./C_floatingToolbar";
import C_boardItem from "./C_boardItem";
import C_settingsDialog from "./C_settingsDialog";
import {
  DEFAULT_BOARD_SETTINGS,
  allowImageFiles,
  askAboutUnsavedChanges,
  copyImageIntoBoard,
  getBoardName,
  getBoardSnapshot,
  getFileName,
  isImagePath,
  pickBoardSaveLocation,
  pickBoardToOpen,
  pickImagesToImport,
  readBoardFile,
  readClipboard,
  showError,
  writeBoardFile,
  writeClipboardText,
  type BoardSettings,
  type BoardState,
  type BoardView,
  type ClipboardContents,
} from "../lib/boardFile";
import {
  MIN_ITEM_SIZE,
  createItemId,
  rectsIntersect,
  resizeRect,
  resizeRectKeepingRatio,
  type BoardImageItem,
  type BoardItem,
  type Rect,
  type ResizeMode,
} from "../lib/boardItems";
import { getCanvasVariables, updateRecentBoards, type Settings, type ThemeMode } from "../lib/settings";
import { useSettings, useSystemTheme } from "../lib/useSettings";

const UNTITLED_BOARD_NAME = "Untitled board";
const DEFAULT_VIEW: BoardView = { x: 0, y: 0, zoom: 1 };
/** Screen pixels the pointer must travel before a press turns into a drag. */
const DRAG_THRESHOLD = 4;
/** Written to the system clipboard when board items are copied, so a paste can tell they are still the latest copy. */
const CLIPBOARD_MARKER_PREFIX = "kanvas-items:";
/** How many steps Ctrl+Z can go back. */
const UNDO_LIMIT = 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const clampZoom = (zoom: number, settings: Settings) =>
  clamp(zoom, settings.canvas.minZoomPercent / 100, settings.canvas.maxZoomPercent / 100);

/** True for dialogs and menus drawn over the board, which handle their own mouse and wheel. */
const isOverlayTarget = (target: EventTarget | null) =>
  target instanceof Element && target.closest("[data-ui-overlay]") !== null;

type Point = {
  x: number;
  y: number;
};

/** What the pointer is currently doing. Lives in a ref because it changes on every pointer move. */
type Interaction =
  | { kind: "pan"; pointer: Point; startView: BoardView }
  | {
      kind: "move";
      pointer: Point;
      startPositions: Map<string, Point>;
      /** The board before the drag, for undo. */
      startItems: BoardItem[];
      clickedId: string;
      isAdditive: boolean;
      hasMoved: boolean;
    }
  | {
      kind: "resize";
      pointer: Point;
      id: string;
      start: Rect;
      mode: ResizeMode;
      minSize: { width: number; height: number };
      /** Images always keep their shape. */
      keepRatio: boolean;
      startItems: BoardItem[];
    }
  | { kind: "marquee"; pointer: Point; origin: Point; baseSelection: string[]; hasMoved: boolean };

export default function C_canvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const { settings, setSettings, isLoaded: areSettingsLoaded } = useSettings();
  const systemTheme = useSystemTheme();
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 24, y: 24 });
  const [view, setView] = useState<BoardView>(DEFAULT_VIEW);
  const [selectionBox, setSelectionBox] = useState<Rect | null>(null);
  const [boardPath, setBoardPath] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    getBoardSnapshot({ settings: DEFAULT_BOARD_SETTINGS, items: [] }),
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  /** The item whose option bar was opened by right-clicking it. */
  const [optionsItemId, setOptionsItemId] = useState<string | null>(null);
  /** True while files are dragged over the window. */
  const [isDropTarget, setIsDropTarget] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);
  /** Last pointer position in client coordinates, used to place pasted items. */
  const lastPointerRef = useRef<Point | null>(null);
  /** Board items copied with Ctrl+C, and the marker written to the system clipboard with them. */
  const boardClipboardRef = useRef<{ marker: string; items: BoardItem[] } | null>(null);
  const isFileActionRunningRef = useRef(false);
  /** Earlier and undone versions of the board's items, for Ctrl+Z and Ctrl+Shift+Z. */
  const historyRef = useRef<{ past: BoardItem[][]; future: BoardItem[][] }>({ past: [], future: [] });
  /** The text box being typed in since the last undo step, so one editing session is one step. */
  const textEditIdRef = useRef<string | null>(null);
  /** Changes whenever a board is opened or created, so items (and their image files) load afresh. */
  const [boardLoadId, setBoardLoadId] = useState(0);

  // Pointer handlers are registered once and read the latest state through these refs.
  const itemsRef = useRef(items);
  const selectedIdsRef = useRef(selectedIds);
  const viewRef = useRef(view);
  const settingsRef = useRef(settings);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  isSettingsOpenRef.current = isSettingsOpen;
  itemsRef.current = items;
  selectedIdsRef.current = selectedIds;
  viewRef.current = view;
  settingsRef.current = settings;

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const boardName = boardPath ? getBoardName(boardPath) : UNTITLED_BOARD_NAME;
  const isDirty = useMemo(
    () => getBoardSnapshot({ settings: boardSettings, items }) !== savedSnapshot,
    [boardSettings, items, savedSnapshot],
  );

  // The board's own theme wins; otherwise the app setting, where "system" follows the operating system.
  const appTheme: ThemeMode = settings.appearance.theme === "system" ? systemTheme : settings.appearance.theme;
  const activeTheme: ThemeMode = boardSettings.theme === "app" ? appTheme : boardSettings.theme;

  const toggleTheme = () => {
    const nextTheme: ThemeMode = activeTheme === "dark" ? "light" : "dark";

    // Flip whichever setting is in control, so the button always has a visible effect.
    if (boardSettings.theme !== "app") {
      setBoardSettings((current) => ({ ...current, theme: nextTheme }));
    } else {
      setSettings((current) => ({ ...current, appearance: { ...current.appearance, theme: nextTheme } }));
    }
  };

  const rememberBoard = (nextBoardPath: string | null) => {
    setSettings((current) => {
      const withLastBoard = { ...current, memory: { ...current.memory, lastBoardPath: nextBoardPath } };
      return nextBoardPath ? updateRecentBoards(withLastBoard, nextBoardPath) : withLastBoard;
    });
  };

  // History helpers only touch refs and state setters, so callbacks registered once can use them.
  /** Call before changing the items: saves the board as it is now (or as given) as one undo step. */
  const recordUndoStep = useCallback((before: BoardItem[] = itemsRef.current) => {
    const history = historyRef.current;
    history.past.push(before);
    if (history.past.length > UNDO_LIMIT) {
      history.past.shift();
    }
    history.future = [];
    textEditIdRef.current = null;
  }, []);

  const restoreItems = useCallback((next: BoardItem[]) => {
    textEditIdRef.current = null;
    // Updated right away so a quick second Ctrl+Z steps from here, not from the last render.
    itemsRef.current = next;
    setItems(next);
    const ids = new Set(next.map((item) => item.id));
    setSelectedIds((current) => current.filter((id) => ids.has(id)));
    setOptionsItemId((current) => (current && ids.has(current) ? current : null));
  }, []);

  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (previous) {
      history.future.push(itemsRef.current);
      restoreItems(previous);
    }
  }, [restoreItems]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (next) {
      history.past.push(itemsRef.current);
      restoreItems(next);
    }
  }, [restoreItems]);

  const getBoardPoint = (clientX: number, clientY: number): Point | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) {
      return null;
    }

    const { x, y, zoom } = viewRef.current;
    return {
      x: (clientX - canvasRect.left - x) / zoom,
      y: (clientY - canvasRect.top - y) / zoom,
    };
  };

  /** Where pasted items go: under the pointer when it's over the board, otherwise the middle of the view. */
  const getPasteCenter = (): Point | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const pointer = lastPointerRef.current;

    if (!canvasRect) {
      return null;
    }

    const isPointerOverBoard =
      pointer !== null &&
      pointer.x >= canvasRect.left &&
      pointer.x <= canvasRect.right &&
      pointer.y >= canvasRect.top &&
      pointer.y <= canvasRect.bottom;

    return isPointerOverBoard
      ? getBoardPoint(pointer.x, pointer.y)
      : getBoardPoint(canvasRect.left + canvasRect.width / 2, canvasRect.top + canvasRect.height / 2);
  };

  /**
   * Adds image files to the board, cascading them slightly. With a center, the first image is centered
   * on that board point; otherwise they start near the board's origin. Returns the new items' ids.
   */
  const addImages = async (imagePaths: string[], center: Point | null = null) => {
    const nextImages = imagePaths.map((path, index) => {
      const naturalSize = new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        // Unreadable files still get a square placeholder instead of being dropped silently.
        img.onerror = () => resolve({ width: 1, height: 1 });
        img.src = convertFileSrc(path);
      });

      return naturalSize.then((size) => {
        const maxSize = 220;
        const aspectRatio = size.width / size.height;
        const width = aspectRatio >= 1 ? maxSize : maxSize * aspectRatio;
        const height = aspectRatio >= 1 ? maxSize / aspectRatio : maxSize;

        const origin = center ? { x: center.x - width / 2, y: center.y - height / 2 } : { x: 64, y: 64 };

        return {
          id: createItemId(),
          type: "image",
          path,
          name: getFileName(path),
          x: origin.x + index * 28,
          y: origin.y + index * 24,
          width,
          height,
        } satisfies BoardImageItem;
      });
    });

    const resolvedImages: BoardImageItem[] = await Promise.all(nextImages);

    // A saved board gets its copies right away; a new board copies them on its first save.
    // One at a time, so two files with the same name can't claim the same target name.
    if (boardPath) {
      for (const image of resolvedImages) {
        try {
          image.path = await copyImageIntoBoard(boardPath, image.path);
        } catch (error) {
          console.error(`Could not copy ${image.path} into the board; it will be copied on save.`, error);
        }
      }
    }

    recordUndoStep();
    setItems((current) => [...current, ...resolvedImages]);
    return resolvedImages.map((image) => image.id);
  };

  const handleImport = async () => {
    const imagePaths = await pickImagesToImport();

    if (imagePaths.length > 0) {
      await addImages(imagePaths);
    }
  };

  /** Copies the selected items to Kanvas' own clipboard, and marks the system clipboard so a later copy elsewhere wins. */
  const copySelection = () => {
    const selected = new Set(selectedIdsRef.current);
    const copiedItems = itemsRef.current.filter((item) => selected.has(item.id));

    if (copiedItems.length === 0) {
      return false;
    }

    const marker = `${CLIPBOARD_MARKER_PREFIX}${createItemId()}`;
    boardClipboardRef.current = { marker, items: copiedItems };
    writeClipboardText(marker).catch((error) => console.error("Could not write to the clipboard.", error));
    return true;
  };

  const cutSelection = () => {
    if (copySelection()) {
      const selected = new Set(selectedIdsRef.current);
      recordUndoStep();
      setItems((current) => current.filter((item) => !selected.has(item.id)));
      setSelectedIds([]);
    }
  };

  /** Pastes copies of board items, keeping their layout, centered on a board point. */
  const pasteBoardItems = (copiedItems: BoardItem[], center: Point | null) => {
    const left = Math.min(...copiedItems.map((item) => item.x));
    const top = Math.min(...copiedItems.map((item) => item.y));
    const right = Math.max(...copiedItems.map((item) => item.x + item.width));
    const bottom = Math.max(...copiedItems.map((item) => item.y + item.height));
    // Without a center, paste slightly offset so the copies don't hide the originals.
    const offsetX = center ? center.x - (left + right) / 2 : 24;
    const offsetY = center ? center.y - (top + bottom) / 2 : 24;

    const pasted = copiedItems.map((item) => ({ ...item, id: createItemId(), x: item.x + offsetX, y: item.y + offsetY }));
    recordUndoStep();
    setItems((current) => [...current, ...pasted]);
    setSelectedIds(pasted.map((item) => item.id));
  };

  /** Pastes Kanvas items copied on the board, or images and image files copied in other apps. */
  const paste = async () => {
    const center = getPasteCenter();
    const boardClipboard = boardClipboardRef.current;
    let contents: ClipboardContents;

    try {
      contents = await readClipboard(boardPath);
    } catch (error) {
      // Kanvas' own clipboard still works when the system clipboard can't be read.
      console.error("Could not read the clipboard.", error);
      if (boardClipboard) {
        pasteBoardItems(boardClipboard.items, center);
      }
      return;
    }

    if (boardClipboard && contents.text?.trim() === boardClipboard.marker) {
      pasteBoardItems(boardClipboard.items, center);
    } else if (contents.imagePaths.length > 0) {
      setSelectedIds(await addImages(contents.imagePaths, center));
    }
  };

  /** Adds image files dropped on the window at the drop point; other files are ignored. */
  const dropFiles = async (paths: string[], clientPoint: Point) => {
    const imagePaths = await allowImageFiles(paths);

    if (imagePaths.length === 0) {
      await showError("Nothing to add", "Only image files can be dropped on the board.");
      return;
    }

    setSelectedIds(await addImages(imagePaths, getBoardPoint(clientPoint.x, clientPoint.y)));
  };

  const handleAddText = () => {
    recordUndoStep();
    setItems((current) => [
      ...current,
      {
        id: createItemId(),
        type: "text",
        x: 180,
        y: 110,
        width: 220,
        height: 110,
        text: "New text box",
        style: { ...settings.text },
      },
    ]);
  };

  // Item callbacks only touch refs and state setters, so they keep their identity and memoized items skip re-rendering.
  const handleItemPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setOptionsItemId((current) => (current === id ? current : null));
    textEditIdRef.current = null;

    const isAdditive = event.ctrlKey || event.metaKey;
    const current = selectedIdsRef.current;
    const isSelected = current.includes(id);
    let nextSelection = current;

    if (isAdditive) {
      nextSelection = isSelected ? current.filter((selectedId) => selectedId !== id) : [...current, id];
    } else if (!isSelected) {
      nextSelection = [id];
    }

    setSelectedIds(nextSelection);

    // Ctrl-clicking a selected item only deselects it.
    if (!nextSelection.includes(id)) {
      return;
    }

    const startPositions = new Map<string, Point>();
    for (const item of itemsRef.current) {
      if (nextSelection.includes(item.id)) {
        startPositions.set(item.id, { x: item.x, y: item.y });
      }
    }

    interactionRef.current = {
      kind: "move",
      pointer: { x: event.clientX, y: event.clientY },
      startPositions,
      startItems: itemsRef.current,
      clickedId: id,
      isAdditive,
      hasMoved: false,
    };
  }, []);

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>, id: string, mode: ResizeMode) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) {
      return;
    }

    setSelectedIds([id]);
    interactionRef.current = {
      kind: "resize",
      pointer: { x: event.clientX, y: event.clientY },
      id,
      start: { x: item.x, y: item.y, width: item.width, height: item.height },
      mode,
      minSize: MIN_ITEM_SIZE[item.type],
      keepRatio: item.type === "image",
      startItems: itemsRef.current,
    };
  }, []);

  const handleItemContextMenu = useCallback((id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current : [id]));
    setOptionsItemId(id);
  }, []);

  const handleItemDelete = useCallback((id: string) => {
    recordUndoStep();
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
    setOptionsItemId((current) => (current === id ? null : current));
  }, []);

  const handleTextChange = useCallback((id: string, text: string) => {
    // The first keystroke in a text box starts an undo step; the rest of that editing joins it.
    if (textEditIdRef.current !== id) {
      recordUndoStep();
      textEditIdRef.current = id;
    }
    setItems((current) => current.map((item) => (item.id === id && item.type === "text" ? { ...item, text } : item)));
  }, []);

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (isOverlayTarget(target)) {
      return;
    }

    if (event.button === 1) {
      event.preventDefault();
      interactionRef.current = {
        kind: "pan",
        pointer: { x: event.clientX, y: event.clientY },
        startView: viewRef.current,
      };
      return;
    }

    if (event.button !== 0 || target.closest(".board-item, .floating-toolbar-shell")) {
      return;
    }

    event.preventDefault();
    setOptionsItemId(null);
    textEditIdRef.current = null;

    const origin = getBoardPoint(event.clientX, event.clientY);
    if (!origin) {
      return;
    }

    const isAdditive = event.ctrlKey || event.metaKey;
    const baseSelection = isAdditive ? selectedIdsRef.current : [];
    setSelectedIds(baseSelection);

    interactionRef.current = {
      kind: "marquee",
      pointer: { x: event.clientX, y: event.clientY },
      origin,
      baseSelection,
      hasMoved: false,
    };
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    // Keep the normal menu (copy, paste) inside the settings dialog.
    if (isOverlayTarget(event.target)) {
      return;
    }

    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const toolbar = canvas.querySelector<HTMLElement>(".floating-toolbar");
    const toolbarWidth = toolbar?.offsetWidth ?? 0;
    const toolbarHeight = toolbar?.offsetHeight ?? 0;
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;

    // Open to the right of and below the pointer, flipping sides near the window edges.
    const nextX = pointerX < bounds.width - toolbarWidth - 20 ? pointerX + 18 : pointerX - toolbarWidth - 18;
    const nextY = pointerY < bounds.height - toolbarHeight - 20 ? pointerY + 18 : pointerY - toolbarHeight - 18;

    setToolbarPosition({
      x: clamp(nextX, 16, Math.max(bounds.width - toolbarWidth - 16, 16)),
      y: clamp(nextY, 16, Math.max(bounds.height - toolbarHeight - 16, 16)),
    });
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      const screenDeltaX = event.clientX - interaction.pointer.x;
      const screenDeltaY = event.clientY - interaction.pointer.y;
      const isPastThreshold = Math.hypot(screenDeltaX, screenDeltaY) >= DRAG_THRESHOLD;
      // Items live in board space, so pointer movement has to be scaled by the zoom level.
      const zoom = viewRef.current.zoom;
      const deltaX = screenDeltaX / zoom;
      const deltaY = screenDeltaY / zoom;

      switch (interaction.kind) {
        case "pan":
          setView({
            ...interaction.startView,
            x: interaction.startView.x + screenDeltaX,
            y: interaction.startView.y + screenDeltaY,
          });
          break;

        case "move": {
          if (!interaction.hasMoved && !isPastThreshold) {
            return;
          }

          interaction.hasMoved = true;
          const { startPositions } = interaction;
          setItems((current) =>
            current.map((item) => {
              const start = startPositions.get(item.id);
              return start ? { ...item, x: start.x + deltaX, y: start.y + deltaY } : item;
            }),
          );
          break;
        }

        case "resize": {
          const { id, start, mode, minSize, keepRatio } = interaction;
          const next = (keepRatio ? resizeRectKeepingRatio : resizeRect)(start, mode, deltaX, deltaY, minSize);
          setItems((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
          break;
        }

        case "marquee": {
          if (!interaction.hasMoved && !isPastThreshold) {
            return;
          }

          interaction.hasMoved = true;
          const current = getBoardPoint(event.clientX, event.clientY);
          if (!current) {
            return;
          }

          const { origin, baseSelection } = interaction;
          const box: Rect = {
            x: Math.min(origin.x, current.x),
            y: Math.min(origin.y, current.y),
            width: Math.abs(current.x - origin.x),
            height: Math.abs(current.y - origin.y),
          };
          const hits = itemsRef.current.filter((item) => rectsIntersect(item, box)).map((item) => item.id);

          setSelectionBox(box);
          setSelectedIds(Array.from(new Set([...baseSelection, ...hits])));
          break;
        }
      }
    };

    const handlePointerUp = () => {
      const interaction = interactionRef.current;

      // A plain click on an item of a multi-selection selects just that item.
      if (interaction?.kind === "move" && !interaction.hasMoved && !interaction.isAdditive) {
        setSelectedIds([interaction.clickedId]);
      }

      // A finished drag or resize is one undo step.
      if ((interaction?.kind === "move" || interaction?.kind === "resize") && itemsRef.current !== interaction.startItems) {
        recordUndoStep(interaction.startItems);
      }

      interactionRef.current = null;
      setSelectionBox(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  // React registers wheel listeners as passive, which ignores preventDefault, so this one is added by hand.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      // Let a text box being edited, and the settings dialog, scroll normally.
      if ((event.target as HTMLElement).closest(".board-textarea") || isOverlayTarget(event.target)) {
        return;
      }

      event.preventDefault();

      const canvasRect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - canvasRect.left;
      const pointerY = event.clientY - canvasRect.top;
      const scaleStep = event.deltaY < 0 ? 1.12 : 0.88;

      // Zoom around the pointer: the board point under it stays put.
      setView((current) => {
        const zoom = clampZoom(current.zoom * scaleStep, settingsRef.current);
        const boardX = (pointerX - current.x) / current.zoom;
        const boardY = (pointerY - current.y) / current.zoom;
        return { x: pointerX - boardX * zoom, y: pointerY - boardY * zoom, zoom };
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  const applyBoard = (board: BoardState, nextBoardPath: string | null) => {
    setBoardSettings(board.settings);
    setItems(board.items);
    setSelectedIds([]);
    setSelectionBox(null);
    setOptionsItemId(null);
    setView({
      x: board.view.x || 0,
      y: board.view.y || 0,
      zoom: Number.isFinite(board.view.zoom) ? clampZoom(board.view.zoom, settingsRef.current) : 1,
    });
    setBoardPath(nextBoardPath);
    setSavedSnapshot(getBoardSnapshot(board));
    rememberBoard(nextBoardPath);
    historyRef.current = { past: [], future: [] };
    textEditIdRef.current = null;
    setBoardLoadId((current) => current + 1);
  };

  const writeBoardTo = async (targetPath: string) => {
    const board: BoardState = { settings: boardSettings, items, view };

    try {
      const savedItems = await writeBoardFile(targetPath, board);
      const savedPathById = new Map<string, string>();
      for (const item of savedItems) {
        if (item.type === "image") {
          savedPathById.set(item.id, item.path);
        }
      }

      // Only swap in the copied image paths, so edits made while saving are kept (and stay unsaved).
      setItems((current) =>
        current.map((item) => {
          const savedPath = item.type === "image" ? savedPathById.get(item.id) : undefined;
          return savedPath ? { ...item, path: savedPath } : item;
        }),
      );

      // Undo steps also point at the copies, so undoing after a save doesn't bring back paths outside the board.
      const savedPathBySource = new Map<string, string>();
      board.items.forEach((item, index) => {
        const saved = savedItems[index];
        if (item.type === "image" && saved?.type === "image") {
          savedPathBySource.set(item.path, saved.path);
        }
      });
      const toSavedPaths = (steps: BoardItem[][]) =>
        steps.map((stepItems) =>
          stepItems.map((item) => {
            const savedPath = item.type === "image" ? savedPathBySource.get(item.path) : undefined;
            return savedPath ? { ...item, path: savedPath } : item;
          }),
        );
      const history = historyRef.current;
      historyRef.current = { past: toSavedPaths(history.past), future: toSavedPaths(history.future) };
      setBoardPath(targetPath);
      setSavedSnapshot(getBoardSnapshot({ settings: boardSettings, items: savedItems }));
      rememberBoard(targetPath);
      return true;
    } catch (error) {
      await showError("Could not save the board", error);
      return false;
    }
  };

  const saveBoardAs = async () => {
    const targetPath = await pickBoardSaveLocation(boardName, settings.general.defaultBoardFolder);
    return targetPath ? writeBoardTo(targetPath) : false;
  };

  const saveBoard = async () => (boardPath ? writeBoardTo(boardPath) : saveBoardAs());

  /** Returns true when the current board may be replaced or closed. */
  const resolveUnsavedChanges = async () => {
    if (!isDirty) {
      return true;
    }

    const choice = await askAboutUnsavedChanges(boardName);
    if (choice === "save") {
      return saveBoard();
    }

    return choice === "discard";
  };

  const newBoard = async () => {
    if (await resolveUnsavedChanges()) {
      applyBoard({ settings: DEFAULT_BOARD_SETTINGS, view: DEFAULT_VIEW, items: [] }, null);
    }
  };

  const openBoardAt = async (targetPath: string) => {
    if (!(await resolveUnsavedChanges())) {
      return;
    }

    try {
      applyBoard(await readBoardFile(targetPath), targetPath);
    } catch (error) {
      // A board that can't be read (moved, deleted) is dropped from the recent list.
      setSettings((current) => updateRecentBoards(current, targetPath, true));
      await showError("Could not open the board", error);
    }
  };

  const openBoard = async () => {
    const targetPath = await pickBoardToOpen(settings.general.defaultBoardFolder);
    if (targetPath) {
      await openBoardAt(targetPath);
    }
  };

  // Keeps dialogs from stacking up, e.g. when Ctrl+S is pressed while a save is still running.
  const runFileAction = async (action: () => Promise<unknown>) => {
    if (isFileActionRunningRef.current) {
      return;
    }

    isFileActionRunningRef.current = true;
    try {
      await action();
    } catch (error) {
      await showError("Something went wrong", error);
    } finally {
      isFileActionRunningRef.current = false;
    }
  };

  // Window-level listeners are registered once, so they read the latest actions through this ref.
  const fileActionsRef = useRef({ saveBoard, saveBoardAs, newBoard, openBoard, resolveUnsavedChanges, runFileAction });
  fileActionsRef.current = { saveBoard, saveBoardAs, newBoard, openBoard, resolveUnsavedChanges, runFileAction };
  const editActionsRef = useRef({ copySelection, cutSelection, paste, dropFiles, undo, redo });
  editActionsRef.current = { copySelection, cutSelection, paste, dropFiles, undo, redo };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = target.closest("textarea, input, [contenteditable='true']") !== null;

      if (event.key === "," && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setIsSettingsOpen((current) => !current);
        return;
      }

      // While the settings dialog is open, Delete must not remove board items behind it.
      if ((event.key === "Delete" || event.key === "Backspace") && !isTyping && !isSettingsOpenRef.current) {
        const selected = new Set(selectedIdsRef.current);
        if (selected.size > 0) {
          event.preventDefault();
          recordUndoStep();
          setItems((current) => current.filter((item) => !selected.has(item.id)));
          setSelectedIds([]);
        }
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      // Copy, cut, paste, undo and redo of board items; inside text boxes and the settings dialog they edit text as usual.
      const editKey = event.key.toLowerCase();
      if ((editKey === "z" || editKey === "y") && !isTyping && !isSettingsOpenRef.current) {
        event.preventDefault();
        const { undo, redo } = editActionsRef.current;
        if (editKey === "y" || event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((editKey === "c" || editKey === "x" || editKey === "v") && !isTyping && !isSettingsOpenRef.current) {
        event.preventDefault();
        const { copySelection, cutSelection, paste } = editActionsRef.current;

        if (editKey === "c") {
          copySelection();
        } else if (editKey === "x") {
          cutSelection();
        } else {
          paste().catch((error) => showError("Could not paste", error));
        }
        return;
      }

      const { saveBoard, saveBoardAs, newBoard, openBoard, runFileAction } = fileActionsRef.current;
      const shortcuts: Record<string, (() => Promise<unknown>) | undefined> = {
        s: event.shiftKey ? saveBoardAs : saveBoard,
        o: openBoard,
        n: newBoard,
      };
      const action = shortcuts[event.key.toLowerCase()];

      if (action) {
        event.preventDefault();
        void runFileAction(action);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      const { resolveUnsavedChanges, runFileAction } = fileActionsRef.current;
      let canClose = false;

      await runFileAction(async () => {
        canClose = await resolveUnsavedChanges();
      });

      if (!canClose) {
        event.preventDefault();
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Files dragged in from other apps. Tauri reports them with their paths, which web drop events can't.
  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter") {
        setIsDropTarget(payload.paths.some(isImagePath));
      } else if (payload.type === "leave") {
        setIsDropTarget(false);
      } else if (payload.type === "drop") {
        setIsDropTarget(false);
        // Positions arrive in physical pixels.
        const clientPoint = {
          x: payload.position.x / window.devicePixelRatio,
          y: payload.position.y / window.devicePixelRatio,
        };
        editActionsRef.current
          .dropFiles(payload.paths, clientPoint)
          .catch((error) => showError("Could not add the dropped images", error));
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    getCurrentWindow()
      .setTitle(`${isDirty ? "• " : ""}${boardName} — Kanvas`)
      .catch(() => {
        // The title is cosmetic; ignore failures.
      });
  }, [boardName, isDirty]);

  // Runs once, when settings.json has been read.
  const hasAppliedStartupSettingsRef = useRef(false);
  useEffect(() => {
    if (!areSettingsLoaded || hasAppliedStartupSettingsRef.current) {
      return;
    }

    hasAppliedStartupSettingsRef.current = true;
    const { general, canvas, memory } = settingsRef.current;

    if (canvas.rememberToolbarPosition && memory.toolbarPosition) {
      // The window may be smaller than last time; keep the toolbar reachable.
      setToolbarPosition({
        x: clamp(memory.toolbarPosition.x, 16, Math.max(window.innerWidth - 160, 16)),
        y: clamp(memory.toolbarPosition.y, 16, Math.max(window.innerHeight - 80, 16)),
      });
    }

    const lastBoardPath = memory.lastBoardPath;
    if (general.reopenLastBoard && lastBoardPath) {
      readBoardFile(lastBoardPath)
        .then((board) => applyBoard(board, lastBoardPath))
        .catch((error) => {
          // The board was moved or deleted since the last session; start with an empty one.
          console.error("Could not reopen the last board.", error);
          rememberBoard(null);
        });
    }
  }, [areSettingsLoaded]);

  // Changing the zoom limits pulls the current zoom back inside them.
  useEffect(() => {
    setView((current) => {
      const zoom = clampZoom(current.zoom, settings);
      return zoom === current.zoom ? current : { ...current, zoom };
    });
  }, [settings.canvas.minZoomPercent, settings.canvas.maxZoomPercent]);

  const handleToolbarMove = (next: { x: number; y: number }) => {
    setToolbarPosition(next);

    if (settings.canvas.rememberToolbarPosition) {
      setSettings((current) => ({ ...current, memory: { ...current.memory, toolbarPosition: next } }));
    }
  };

  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const contentTransform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  const recentBoards = settings.general.showRecentBoards
    ? settings.memory.recentBoards.slice(0, settings.general.recentBoardsLimit)
    : [];

  return (
    <div
      ref={canvasRef}
      className={`moodboard-canvas moodboard-canvas--${activeTheme} moodboard-canvas--options-${settings.canvas.optionBar}${isDropTarget ? " is-drop-target" : ""}`}
      style={getCanvasVariables(settings, activeTheme, boardSettings.background === "dots")}
      aria-label="Moodboard canvas"
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={handleCanvasContextMenu}
    >
      <div className="moodboard-grid" style={{ transform: contentTransform }} />

      <div className="moodboard-canvas-content" style={{ transform: contentTransform }}>
        {items.map((item) => (
          <C_boardItem
            key={`${boardLoadId}:${item.id}`}
            item={item}
            isSelected={selectedIdSet.has(item.id)}
            isOptionsOpen={optionsItemId === item.id}
            onPointerDown={handleItemPointerDown}
            onResizeStart={handleResizeStart}
            onContextMenu={handleItemContextMenu}
            onDelete={handleItemDelete}
            onTextChange={handleTextChange}
          />
        ))}

        {selectionBox && (
          <div
            className="selection-box"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}
      </div>

      <FloatingToolbar
        position={toolbarPosition}
        onPositionChange={handleToolbarMove}
        size={settings.canvas.toolbarSize}
        onImport={() => {
          handleImport().catch((error) => showError("Could not import images", error));
        }}
        onAddText={handleAddText}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        recentBoards={recentBoards}
        onOpenRecent={(path) => void runFileAction(() => openBoardAt(path))}
        onNewBoard={() => void runFileAction(newBoard)}
        onOpenBoard={() => void runFileAction(openBoard)}
        onSave={() => void runFileAction(saveBoard)}
        onSaveAs={() => void runFileAction(saveBoardAs)}
      />

      {isSettingsOpen && (
        <C_settingsDialog
          settings={settings}
          onSettingsChange={setSettings}
          boardSettings={boardSettings}
          onBoardSettingsChange={setBoardSettings}
          boardName={boardName}
          activeTheme={activeTheme}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}
