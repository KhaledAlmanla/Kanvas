import { useEffect, useRef, useState } from "react";
import FloatingToolbar from "./C_floatingToolbar";
import C_Images, { type BoardImageItem } from "./C_Images";
import C_textBoxes, { type BoardTextBoxItem } from "./C_textBoxes";

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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
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

  const handleImport = (files: FileList) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      return;
    }

    const nextImages = imageFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      const naturalSize = new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = url;
      });

      return naturalSize.then((size) => {
        const maxSize = 220;
        const aspectRatio = size.width / size.height;
        const width = aspectRatio >= 1 ? maxSize : maxSize * aspectRatio;
        const height = aspectRatio >= 1 ? maxSize / aspectRatio : maxSize;

        return {
          id: Date.now() + index + Math.random(),
          src: url,
          name: file.name,
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

  const saveBoard = () => {
    const payload = {
      theme,
      images,
      textBoxes,
      viewOffset,
      zoom,
      toolbarPosition,
      selectedIds,
    };

    localStorage.setItem("moodboard-board-v1", JSON.stringify(payload));
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("moodboard-board-v1");
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as {
        theme?: "dark" | "light";
        images?: BoardImageItem[];
        textBoxes?: BoardTextBoxItem[];
        viewOffset?: { x: number; y: number };
        zoom?: number;
        toolbarPosition?: { x: number; y: number };
      };

      if (parsed.theme) {
        setTheme(parsed.theme);
      }
      if (Array.isArray(parsed.images)) {
        setImages(parsed.images);
      }
      if (Array.isArray(parsed.textBoxes)) {
        setTextBoxes(parsed.textBoxes);
      }
      if (parsed.viewOffset) {
        setViewOffset(parsed.viewOffset);
      }
      if (typeof parsed.zoom === "number") {
        setZoom(clamp(parsed.zoom, MIN_ZOOM, MAX_ZOOM));
      }
      if (parsed.toolbarPosition) {
        setToolbarPosition(parsed.toolbarPosition);
      }
    } catch {
      // Ignore malformed saved content.
    }
  }, []);

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
        onImport={handleImport}
        onAddText={handleAddText}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onSave={saveBoard}
      />
    </div>
  );
}
