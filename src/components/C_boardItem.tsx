import { memo, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Crop, PencilLine, Trash } from "lucide-react";
import { FONT_STACKS, RESIZE_MODES, type BoardItem, type ResizeMode, type TextStyle } from "../lib/boardItems";

const JUSTIFY_BY_ALIGN: Record<TextStyle["align"], string> = { left: "flex-start", center: "center", right: "flex-end" };

/** Inline styles for a styled text box; unstyled (older) text boxes keep the look from App.css. */
const getTextStyle = (style: TextStyle | undefined): React.CSSProperties | undefined =>
  style && {
    fontFamily: FONT_STACKS[style.font],
    fontSize: style.size,
    fontWeight: 400,
    color: style.color ?? undefined,
    textAlign: style.align,
    justifyContent: JUSTIFY_BY_ALIGN[style.align],
  };

type C_boardItemProps = {
  item: BoardItem;
  isSelected: boolean;
  /** Set when the option bar was opened by right-clicking, for the "Right-click only" setting. */
  isOptionsOpen: boolean;
  // These callbacks must keep the same identity across renders, or memo stops helping.
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>, id: string, mode: ResizeMode) => void;
  onContextMenu: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
};

function C_boardItem({
  item,
  isSelected,
  isOptionsOpen,
  onPointerDown,
  onResizeStart,
  onContextMenu,
  onDelete,
  onTextChange,
}: C_boardItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const label = item.type === "image" ? "image" : "text box";

  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    }
  }, [isSelected]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // Typing, and clicking the option buttons, should not start a drag.
    if (target.closest(".board-textarea, .board-item-options")) {
      return;
    }

    onPointerDown(event, item.id);
  };

  return (
    <div
      className={`board-item board-${item.type}-item${isSelected ? " is-selected" : ""}${isOptionsOpen ? " is-options-open" : ""}`}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
      onPointerDown={handlePointerDown}
      onDragStart={(event) => event.preventDefault()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(item.id);
      }}
    >
      <div className={`board-${item.type}-frame`}>
        {item.type === "image" ? (
          <img
            src={convertFileSrc(item.path)}
            alt={item.name}
            className="board-image-element"
            draggable={false}
          />
        ) : isEditing ? (
          <textarea
            className="board-textarea"
            style={getTextStyle(item.style)}
            value={item.text}
            onChange={(event) => onTextChange(item.id, event.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
          />
        ) : (
          <div className="board-text-content" style={getTextStyle(item.style)} onDoubleClick={() => setIsEditing(true)}>
            {item.text || "Double-click to edit"}
          </div>
        )}

        {isSelected &&
          !isEditing &&
          RESIZE_MODES.map((mode) => (
            <div
              key={mode}
              className={`resize-handle resize-handle--${mode}`}
              data-role="resize-handle"
              onPointerDown={(event) => onResizeStart(event, item.id, mode)}
            />
          ))}
      </div>

      <div className="board-item-options">
        <div className="board-item-option-bar">
          <button
            type="button"
            className="option-button delete"
            onClick={() => onDelete(item.id)}
            aria-label={`Delete ${label}`}
            title={`Delete ${label}`}
          >
            <Trash size={14} strokeWidth={2} />
          </button>
          {item.type === "image" ? (
            <button type="button" className="option-button crop" aria-label="Crop image" title="Crop (coming soon)" disabled>
              <Crop size={14} strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              className="option-button crop"
              aria-label="Edit text box"
              title="Edit text"
              onClick={() => setIsEditing(true)}
            >
              <PencilLine size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(C_boardItem);
