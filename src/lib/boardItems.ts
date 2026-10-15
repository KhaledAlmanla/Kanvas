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

export type BoardTextItem = Rect & {
  id: string;
  type: "text";
  text: string;
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
