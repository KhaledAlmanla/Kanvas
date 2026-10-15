import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Crop, Trash } from "lucide-react";

export type BoardImageItem = {
  id: number;
  /** Absolute path of the image file on disk. */
  path: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type C_ImagesProps = {
  item: BoardImageItem;
  isSelected?: boolean;
  onSelect?: (id: number, multi?: boolean) => void;
  onUpdate: (id: number, next: Partial<BoardImageItem>) => void;
  onDelete: (id: number) => void;
};

type MoveDragState = {
  pointerStartX: number;
  pointerStartY: number;
  startX: number;
  startY: number;
};

type ResizeDragState = {
  pointerStartX: number;
  pointerStartY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  mode: "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
};

export default function C_Images({ item, isSelected = false, onSelect, onUpdate, onDelete }: C_ImagesProps) {
  const [isHovered, setIsHovered] = useState(false);
  const moveDragRef = useRef<MoveDragState | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (moveDragRef.current) {
        const deltaX = event.clientX - moveDragRef.current.pointerStartX;
        const deltaY = event.clientY - moveDragRef.current.pointerStartY;

        onUpdate(item.id, {
          x: moveDragRef.current.startX + deltaX,
          y: moveDragRef.current.startY + deltaY,
        });
      }

      if (resizeDragRef.current) {
        const deltaX = event.clientX - resizeDragRef.current.pointerStartX;
        const deltaY = event.clientY - resizeDragRef.current.pointerStartY;
        const { mode, startX, startY, startWidth, startHeight } = resizeDragRef.current;

        let nextWidth = startWidth;
        let nextHeight = startHeight;
        let nextX = startX;
        let nextY = startY;

        if (mode.includes("e")) {
          nextWidth = Math.max(80, startWidth + deltaX);
        }

        if (mode.includes("s")) {
          nextHeight = Math.max(80, startHeight + deltaY);
        }

        if (mode.includes("w")) {
          nextWidth = Math.max(80, startWidth - deltaX);
          nextX = startX + (startWidth - nextWidth);
        }

        if (mode.includes("n")) {
          nextHeight = Math.max(80, startHeight - deltaY);
          nextY = startY + (startHeight - nextHeight);
        }

        onUpdate(item.id, {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        });
      }
    };

    const handlePointerUp = () => {
      moveDragRef.current = null;
      resizeDragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [item.id, onUpdate]);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>, mode: ResizeDragState["mode"]) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(item.id, event.ctrlKey);
    resizeDragRef.current = {
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      startX: item.x,
      startY: item.y,
      startWidth: item.width,
      startHeight: item.height,
      mode,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleItemPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest("[data-role='move-handle'], [data-role='resize-handle']")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelect?.(item.id, event.ctrlKey);
    moveDragRef.current = {
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      startX: item.x,
      startY: item.y,
    };
  };

  const shouldShowOptions = isHovered || isSelected;

  return (
    <div
      className={`board-item board-image-item${isSelected ? " is-selected" : ""}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
      }}
      draggable={false}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handleItemPointerDown}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(item.id, false);
        setIsHovered(true);
      }}
    >
      <div className="board-image-frame">
        <img
          src={convertFileSrc(item.path)}
          alt={item.name}
          className="board-image-element"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />

        {isSelected && [
          { key: "n", className: "resize-handle resize-handle--n" },
          { key: "e", className: "resize-handle resize-handle--e" },
          { key: "s", className: "resize-handle resize-handle--s" },
          { key: "w", className: "resize-handle resize-handle--w" },
          { key: "ne", className: "resize-handle resize-handle--ne" },
          { key: "nw", className: "resize-handle resize-handle--nw" },
          { key: "se", className: "resize-handle resize-handle--se" },
          { key: "sw", className: "resize-handle resize-handle--sw" },
        ].map((handle) => (
          <div
            key={handle.key}
            className={handle.className}
            data-role="resize-handle"
            onPointerDown={(event) => handleResizeStart(event, handle.key as ResizeDragState["mode"])}
          />
        ))}
      </div>

      {shouldShowOptions && (
        <div className="board-item-option-bar">
          <button type="button" className="option-button delete" onClick={() => onDelete(item.id)} aria-label="Delete image">
            <Trash size={14} strokeWidth={2} />
          </button>
          <button type="button" className="option-button crop" aria-label="Crop image">
            <Crop size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
