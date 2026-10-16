import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import FloatingToolbar from "./C_floatingToolbar";
import C_boardItem from "./C_boardItem";
import C_settingsDialog from "./C_settingsDialog";
import {
  DEFAULT_BOARD_SETTINGS,
  askAboutUnsavedChanges,
  copyImageIntoBoard,
  getBoardName,
  getBoardSnapshot,
  getFileName,
  pickBoardSaveLocation,
  pickBoardToOpen,
  pickImagesToImport,
  readBoardFile,
  showError,
  writeBoardFile,
  type BoardSettings,
  type BoardState,
  type BoardView,
} from "../lib/boardFile";
import {
  MIN_ITEM_SIZE,
  createItemId,
  rectsIntersect,
  resizeRect,
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
      clickedId: string;
      isAdditive: boolean;
      hasMoved: boolean;
    }
  | { kind: "resize"; pointer: Point; id: string; start: Rect; mode: ResizeMode; minSize: { width: number; height: number } }
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
  const interactionRef = useRef<Interaction | null>(null);
  const isFileActionRunningRef = useRef(false);

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

  const handleImport = async () => {
    const imagePaths = await pickImagesToImport();

    if (imagePaths.length === 0) {
      return;
    }

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

        return {
          id: createItemId(),
          type: "image",
          path,
          name: getFileName(path),
          x: 64 + index * 28,
          y: 64 + index * 24,
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

    setItems((current) => [...current, ...resolvedImages]);
  };

  const handleAddText = () => {
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
    };
  }, []);

  const handleItemContextMenu = useCallback((id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current : [id]));
    setOptionsItemId(id);
  }, []);

  const handleItemDelete = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
    setOptionsItemId((current) => (current === id ? null : current));
  }, []);

  const handleTextChange = useCallback((id: string, text: string) => {
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
          const { id, start, mode, minSize } = interaction;
          const next = resizeRect(start, mode, deltaX, deltaY, minSize);
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
          setItems((current) => current.filter((item) => !selected.has(item.id)));
          setSelectedIds([]);
        }
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
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
      className={`moodboard-canvas moodboard-canvas--${activeTheme} moodboard-canvas--options-${settings.canvas.optionBar}`}
      style={getCanvasVariables(settings, activeTheme, boardSettings.background === "dots")}
      aria-label="Moodboard canvas"
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={handleCanvasContextMenu}
    >
      <div className="moodboard-grid" style={{ transform: contentTransform }} />

      <div className="moodboard-canvas-content" style={{ transform: contentTransform }}>
        {items.map((item) => (
          <C_boardItem
            key={item.id}
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
