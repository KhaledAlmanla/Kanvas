import { memo, useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Crop, ImageOff, PencilLine, RotateCcw, Trash } from "lucide-react";
import {
  FONT_STACKS,
  FULL_CROP,
  RESIZE_MODES,
  getCoverCrop,
  getPictureRect,
  type BoardItem,
  type ResizeMode,
  type Size,
  type TextStyle,
} from "../lib/boardItems";

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
  /** In crop mode the whole picture shows faded around the frame, and dragging inside slides it. */
  isCropping: boolean;
  /** Goes up when F5 is pressed, so missing images are looked for again. */
  refreshId: number;
  // These callbacks must keep the same identity across renders, or memo stops helping.
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>, id: string, mode: ResizeMode) => void;
  onContextMenu: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onToggleCrop: (id: string) => void;
  onResetCrop: (id: string) => void;
  /** Crop mode: dragging one of the picture's own handles scales the picture inside the frame. */
  onPictureResizeStart: (event: React.PointerEvent<HTMLDivElement>, id: string, mode: ResizeMode) => void;
  /** Reports a picture's own size once loaded; the canvas needs it to crop images saved before crops existed. */
  onImageLoad: (path: string, size: Size) => void;
};

function C_boardItem({
  item,
  isSelected,
  isOptionsOpen,
  isCropping,
  refreshId,
  onPointerDown,
  onResizeStart,
  onContextMenu,
  onDelete,
  onTextChange,
  onToggleCrop,
  onResetCrop,
  onPictureResizeStart,
  onImageLoad,
}: C_boardItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const imagePath = item.type === "image" ? item.path : null;
  /** The image file that failed to load, e.g. because it was deleted or renamed outside Kanvas. */
  const [missingPath, setMissingPath] = useState<string | null>(null);
  const isImageMissing = imagePath !== null && missingPath === imagePath;
  const [naturalSize, setNaturalSize] = useState<Size | null>(null);

  // F5 looks for missing images again.
  useEffect(() => {
    setMissingPath(null);
  }, [refreshId]);
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
      className={`board-item board-${item.type}-item${isSelected ? " is-selected" : ""}${isOptionsOpen ? " is-options-open" : ""}${isCropping ? " is-cropping" : ""}`}
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
          isImageMissing ? (
            <div className="board-image-missing" title={item.path}>
              <ImageOff size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>Image missing</span>
              <span className="board-image-missing-name">{item.name}</span>
            </div>
          ) : (
            (() => {
              const crop = item.crop ?? (naturalSize ? getCoverCrop(item, naturalSize) : FULL_CROP);
              const picture = getPictureRect({ x: 0, y: 0, width: item.width, height: item.height }, crop);
              const pictureStyle = { left: picture.x, top: picture.y, width: picture.width, height: picture.height };
              // The asset protocol ignores the query, but the changed address makes the webview load the file again.
              const src = convertFileSrc(item.path) + (refreshId > 0 ? `?r=${refreshId}` : "");

              return (
                <>
                  {isCropping && (
                    <img src={src} alt="" className="board-image-ghost" style={pictureStyle} draggable={false} />
                  )}
                  {isCropping && (
                    <div className="picture-handles" style={pictureStyle}>
                      {RESIZE_MODES.map((mode) => (
                        <div
                          key={mode}
                          className={`picture-handle picture-handle--${mode}`}
                          title="Scale the picture (Ctrl: stretch)"
                          onPointerDown={(event) => onPictureResizeStart(event, item.id, mode)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="board-image-clip" onDoubleClick={() => onToggleCrop(item.id)}>
                    <img
                      src={src}
                      alt={item.name}
                      className="board-image-element"
                      style={pictureStyle}
                      draggable={false}
                      onLoad={(event) => {
                        const size = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
                        setNaturalSize(size);
                        onImageLoad(item.path, size);
                      }}
                      onError={() => setMissingPath(item.path)}
                    />
                  </div>
                </>
              );
            })()
          )
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
          {item.type === "image" && !isImageMissing && (
            <button
              type="button"
              className={`option-button crop${isCropping ? " is-active" : ""}`}
              aria-label={isCropping ? "Finish cropping" : "Crop image"}
              title={isCropping ? "Finish cropping (Enter)" : "Crop (or double-click the image)"}
              onClick={() => onToggleCrop(item.id)}
            >
              <Crop size={14} strokeWidth={2} />
            </button>
          )}
          {item.type === "image" && isCropping && (
            <button
              type="button"
              className="option-button crop"
              aria-label="Show the whole picture"
              title="Reset crop: show the whole picture"
              onClick={() => onResetCrop(item.id)}
            >
              <RotateCcw size={14} strokeWidth={2} />
            </button>
          )}
          {item.type === "text" && (
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
