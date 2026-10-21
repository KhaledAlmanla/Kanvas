export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BoardImageItem = Rect & {
  id: string;
  type: "image";
  /** Absolute path of the image file on disk. */
  path: string;
  name: string;
};

export type FontChoice = "sans" | "serif" | "mono" | "handwritten";
export type TextAlign = "left" | "center" | "right";

export type TextStyle = {
  font: FontChoice;
  /** In board pixels. */
  size: number;
  /** A hex colour, or null to follow the theme's text colour. */
  color: string | null;
  align: TextAlign;
};

export const FONT_STACKS: Record<FontChoice, string> = {
  sans: 'Inter, Avenir, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
  handwritten: '"Segoe Print", "Bradley Hand", "Comic Neue", "Comic Sans MS", cursive',
};

export type BoardTextItem = Rect & {
  id: string;
  type: "text";
  text: string;
  /** Text boxes made before text styles existed have none and use the original look. */
  style?: TextStyle;
};

/** Everything placed on the board. The order of the items list is the stacking order: last is on top. */
export type BoardItem = BoardImageItem | BoardTextItem;

export type ResizeMode = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_MODES: ResizeMode[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];

export const MIN_ITEM_SIZE: Record<BoardItem["type"], { width: number; height: number }> = {
  image: { width: 80, height: 80 },
  text: { width: 140, height: 90 },
};

export const createItemId = () => crypto.randomUUID();

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/** Resizes a rect by dragging one of its edges or corners, keeping the opposite side in place. */
export function resizeRect(
  start: Rect,
  mode: ResizeMode,
  deltaX: number,
  deltaY: number,
  minSize: { width: number; height: number },
): Rect {
  let { x, y, width, height } = start;

  if (mode.includes("e")) {
    width = Math.max(minSize.width, start.width + deltaX);
  }

  if (mode.includes("s")) {
    height = Math.max(minSize.height, start.height + deltaY);
  }

  if (mode.includes("w")) {
    width = Math.max(minSize.width, start.width - deltaX);
    x = start.x + (start.width - width);
  }

  if (mode.includes("n")) {
    height = Math.max(minSize.height, start.height - deltaY);
    y = start.y + (start.height - height);
  }

  return { x, y, width, height };
}

/**
 * Resizes a rect like resizeRect, but keeps its width-to-height ratio. Corners keep the opposite
 * corner in place; edges keep the opposite edge in place and grow evenly on both sides.
 */
export function resizeRectKeepingRatio(
  start: Rect,
  mode: ResizeMode,
  deltaX: number,
  deltaY: number,
  minSize: { width: number; height: number },
): Rect {
  const widthScale = (start.width + (mode.includes("e") ? deltaX : mode.includes("w") ? -deltaX : 0)) / start.width;
  const heightScale = (start.height + (mode.includes("s") ? deltaY : mode.includes("n") ? -deltaY : 0)) / start.height;
  const isHorizontal = mode === "e" || mode === "w";
  const isVertical = mode === "n" || mode === "s";
  // On a corner, follow whichever direction the pointer moved further.
  const wantedScale = isHorizontal ? widthScale : isVertical ? heightScale : Math.max(widthScale, heightScale);
  // Only the long side has to reach the minimum, so very wide or tall images can still shrink.
  const minScale = Math.min(minSize.width / start.width, minSize.height / start.height);
  const scale = Math.max(wantedScale, minScale);

  const width = start.width * scale;
  const height = start.height * scale;
  const x = mode.includes("w")
    ? start.x + start.width - width
    : mode.includes("e")
      ? start.x
      : start.x + (start.width - width) / 2;
  const y = mode.includes("n")
    ? start.y + start.height - height
    : mode.includes("s")
      ? start.y
      : start.y + (start.height - height) / 2;

  return { x, y, width, height };
}
