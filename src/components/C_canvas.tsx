import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import FloatingToolbar from "./C_floatingToolbar";
import C_Images, { type BoardImageItem } from "./C_Images";
import C_textBoxes, { type BoardTextBoxItem } from "./C_textBoxes";
import {
  askAboutUnsavedChanges,
  getBoardName,
  getBoardSnapshot,
  getFileName,
  getLastBoardPath,
  pickBoardSaveLocation,
  pickBoardToOpen,
  pickImagesToImport,
  readBoardFile,
  setLastBoardPath,
  showError,
  writeBoardFile,
  type BoardState,
  type Theme,
} from "../lib/boardFile";

const UNTITLED_BOARD_NAME = "Untitled board";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function C_canvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [images, setImages] = useState<BoardImageItem[]>([]);
  const [textBoxes, setTextBoxes] = useState<BoardTextBoxItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 24, y: 24 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [boardPath, setBoardPath] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    getBoardSnapshot({ theme: "dark", images: [], textBoxes: [] }),
  );
  const isFileActionRunningRef = useRef(false);

  const boardName = boardPath ? getBoardName(boardPath) : UNTITLED_BOARD_NAME;
  const isDirty = getBoardSnapshot({ theme, images, textBoxes }) !== savedSnapshot;

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;

  const getBoardPoint = (clientX: number, clientY: number) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) {
      return null;
    }

    return {
      x: (clientX - canvasRect.left - viewOffset.x) / zoom,
      y: (clientY - canvasRect.top - viewOffset.y) / zoom,
    };
  };

  const applyZoom = (nextZoom: number, clientX: number, clientY: number) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) {
      return;
    }

    const worldX = (clientX - canvasRect.left - viewOffset.x) / zoom;
    const worldY = (clientY - canvasRect.top - viewOffset.y) / zoom;
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

    setZoom(clampedZoom);
    setViewOffset({
      x: clientX - canvasRect.left - worldX * clampedZoom,
      y: clientY - canvasRect.top - worldY * clampedZoom,
    });
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
          id: Date.now() + index + Math.random(),
          path,
          name: getFileName(path),
          x: 64 + index * 28,
          y: 64 + index * 24,
          width,
          height,
        } satisfies BoardImageItem;
      });
    });

    Promise.all(nextImages).then((resolvedImages) => {
      setImages((current) => [...current, ...resolvedImages]);
    });
  };

  const handleImageUpdate = (id: number, next: Partial<BoardImageItem>) => {
    setImages((current) =>
      current.map((image) => (image.id === id ? { ...image, ...next } : image)),
    );
  };

  const handleImageDelete = (id: number) => {
    setImages((current) => current.filter((image) => image.id !== id));
  };

  const handleTextUpdate = (id: number, next: Partial<BoardTextBoxItem>) => {
    setTextBoxes((current) =>
      current.map((box) => (box.id === id ? { ...box, ...next } : box)),
    );
  };

  const handleTextDelete = (id: number) => {
    setTextBoxes((current) => current.filter((box) => box.id !== id));
  };

  const handleAddText = () => {
    setTextBoxes((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        x: 180,
        y: 110,
        width: 220,
        height: 110,
        text: "New text box",
      },
    ]);
  };

  const handleSelect = (id: number, multi = false) => {
    setSelectedIds((current) => {
      if (multi) {
        if (current.includes(id)) {
          return current.filter((selectedId) => selectedId !== id);
        }

        return [...current, id];
      }

      return [id];
    });
  };

  const intersects = (a: { x: number; y: number; width: number; height: number }, b: SelectionBox) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  const getSelectionIds = (box: SelectionBox) => {
    const matches = [...images, ...textBoxes]
      .filter((item) => intersects(item, box))
      .map((item) => item.id);

    return matches;
  };

  const applyBoard = (board: BoardState, nextBoardPath: string | null) => {
    setTheme(board.theme);
    setImages(board.images);
    setTextBoxes(board.textBoxes);
    setSelectedIds([]);
    setSelectionBox(null);
    setViewOffset({ x: board.view.x || 0, y: board.view.y || 0 });
    setZoom(Number.isFinite(board.view.zoom) ? clamp(board.view.zoom, MIN_ZOOM, MAX_ZOOM) : 1);
    setBoardPath(nextBoardPath);
    setSavedSnapshot(getBoardSnapshot(board));
    setLastBoardPath(nextBoardPath);
  };

  const writeBoardTo = async (targetPath: string) => {
    const board: BoardState = { theme, images, textBoxes, view: { ...viewOffset, zoom } };

    try {
      const savedImages = await writeBoardFile(targetPath, board);
      const savedPathById = new Map(savedImages.map((image) => [image.id, image.path]));

      // Only swap in the copied image paths, so edits made while saving are kept (and stay unsaved).
      setImages((current) =>
        current.map((image) => {
          const savedPath = savedPathById.get(image.id);
          return savedPath ? { ...image, path: savedPath } : image;
        }),
      );
      setBoardPath(targetPath);
      setSavedSnapshot(getBoardSnapshot({ ...board, images: savedImages }));
      setLastBoardPath(targetPath);
      return true;
    } catch (error) {
      await showError("Could not save the board", error);
      return false;
    }
  };

  const saveBoardAs = async () => {
    const targetPath = await pickBoardSaveLocation(boardName);
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
      applyBoard({ theme, view: { x: 0, y: 0, zoom: 1 }, images: [], textBoxes: [] }, null);
    }
  };

  const openBoard = async () => {
    const targetPath = await pickBoardToOpen();
    if (!targetPath || !(await resolveUnsavedChanges())) {
      return;
    }

    try {
      applyBoard(await readBoardFile(targetPath), targetPath);
    } catch (error) {
      await showError("Could not open the board", error);
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
  useEffect(() => {
    fileActionsRef.current = { saveBoard, saveBoardAs, newBoard, openBoard, resolveUnsavedChanges, runFileAction };
  });

  useEffect(() => {
    const lastBoardPath = getLastBoardPath();
    if (!lastBoardPath) {
      return;
    }

    let isCancelled = false;
    readBoardFile(lastBoardPath)
      .then((board) => {
        if (!isCancelled) {
          applyBoard(board, lastBoardPath);
        }
      })
      .catch(() => {
        // The board was moved or deleted since the last session; start with an empty one.
        if (!isCancelled) {
          setLastBoardPath(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isItemTarget = !!target.closest(".board-item");
    const isHandleTarget = !!target.closest("[data-role='resize-handle']");
    const isToolbarTarget = !!target.closest(".floating-toolbar, .floating-toolbar-shell, .toolbar-handle");

    if (event.button === 1) {
      event.preventDefault();
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: viewOffset.x,
        startOffsetY: viewOffset.y,
      };
      return;
    }

    if (event.button !== 0 || isItemTarget || isHandleTarget || isToolbarTarget) {
      return;
    }

    event.preventDefault();

    const point = getBoardPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    setSelectedIds([]);

    selectionDragStartRef.current = { x: event.clientX, y: event.clientY };
    selectionStartRef.current = { x: Math.round(point.x), y: Math.round(point.y) };
    setSelectionBox({ x: Math.round(point.x), y: Math.round(point.y), width: 0, height: 0 });
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const toolbarWidth = 220;
    const toolbarHeight = 72;

    const nextX = pointerX < bounds.width - toolbarWidth - 20 ? pointerX + 18 : pointerX - toolbarWidth - 18;
    const nextY = pointerY < bounds.height - toolbarHeight - 20 ? pointerY + 18 : pointerY - toolbarHeight - 18;

    setToolbarPosition({
      x: clamp(nextX, 16, Math.max(bounds.width - toolbarWidth - 16, 16)),
      y: clamp(nextY, 16, Math.max(bounds.height - toolbarHeight - 16, 16)),
    });
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (panRef.current) {
        setViewOffset({
          x: panRef.current.startOffsetX + (event.clientX - panRef.current.startX),
          y: panRef.current.startOffsetY + (event.clientY - panRef.current.startY),
        });
      }

      if (!selectionStartRef.current || !canvasRef.current) {
        return;
      }

      const dragStart = selectionDragStartRef.current;
      if (dragStart) {
        const movedX = Math.abs(event.clientX - dragStart.x);
        const movedY = Math.abs(event.clientY - dragStart.y);
        if (movedX < 4 && movedY < 4) {
          return;
        }
      }

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentX = (event.clientX - canvasRect.left - viewOffset.x) / zoom;
      const currentY = (event.clientY - canvasRect.top - viewOffset.y) / zoom;
      const startX = selectionStartRef.current.x;
      const startY = selectionStartRef.current.y;

      const nextSelection: SelectionBox = {
        x: Math.round(Math.min(startX, currentX)),
        y: Math.round(Math.min(startY, currentY)),
        width: Math.round(Math.abs(currentX - startX)),
        height: Math.round(Math.abs(currentY - startY)),
      };

      setSelectionBox(nextSelection);

      const selected = getSelectionIds(nextSelection);

      if (event.ctrlKey) {
        setSelectedIds((current) => Array.from(new Set([...current, ...selected])));
      } else {
        setSelectedIds(selected);
      }
    };

    const handlePointerUp = () => {
      panRef.current = null;
      selectionStartRef.current = null;
      selectionDragStartRef.current = null;
      setSelectionBox(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [images, textBoxes, viewOffset, zoom]);

  return (
    <div
      ref={canvasRef}
      className={`moodboard-canvas moodboard-canvas--${theme}`}
      aria-label="Moodboard canvas"
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={handleCanvasContextMenu}
      onWheel={(event) => {
        event.preventDefault();
        const scaleStep = event.deltaY < 0 ? 1.12 : 0.88;
        applyZoom(zoom * scaleStep, event.clientX, event.clientY);
      }}
    >
      <div
        className="moodboard-grid"
        style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${zoom})` }}
      />

      <div
        className="moodboard-canvas-content"
        style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${zoom})` }}
      >
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

        {images.map((image) => (
          <C_Images
            key={image.id}
            item={image}
            isSelected={selectedIds.includes(image.id)}
            onSelect={handleSelect}
            onUpdate={handleImageUpdate}
            onDelete={handleImageDelete}
          />
        ))}

        {textBoxes.map((box) => (
          <C_textBoxes
            key={box.id}
            item={box}
            isSelected={selectedIds.includes(box.id)}
            onSelect={handleSelect}
            onUpdate={handleTextUpdate}
            onDelete={handleTextDelete}
          />
        ))}
      </div>

      <FloatingToolbar
        position={toolbarPosition}
        onPositionChange={setToolbarPosition}
        onImport={() => {
          handleImport().catch((error) => showError("Could not import images", error));
        }}
        onAddText={handleAddText}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onNewBoard={() => void runFileAction(newBoard)}
        onOpenBoard={() => void runFileAction(openBoard)}
        onSave={() => void runFileAction(saveBoard)}
        onSaveAs={() => void runFileAction(saveBoardAs)}
      />
    </div>
  );
}
