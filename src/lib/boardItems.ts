export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

/** The part of a picture shown in its frame, as fractions (0 to 1) of the picture's width and height. */
export type ImageCrop = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const FULL_CROP: ImageCrop = { left: 0, top: 0, right: 1, bottom: 1 };

export type BoardImageItem = Rect & {
  id: string;
  type: "image";
  /** Absolute path of the image file on disk. */
  path: string;
  name: string;
  /**
   * Images saved before cropping existed have none: they show the middle of the picture,
   * filling the frame without stretching (see getCoverCrop).
   */
  crop?: ImageCrop;
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
 * Scales a rect like resizeRect, but keeps its width-to-height ratio (Shift+drag). Corners keep the opposite
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The crop that fills a frame with the middle of a picture without stretching it. */
export function getCoverCrop(frame: Size, picture: Size): ImageCrop {
  const frameRatio = frame.width / frame.height;
  const pictureRatio = picture.width / picture.height;

  if (pictureRatio > frameRatio) {
    const shown = frameRatio / pictureRatio;
    const left = (1 - shown) / 2;
    return { left, top: 0, right: left + shown, bottom: 1 };
  }

  const shown = pictureRatio / frameRatio;
  const top = (1 - shown) / 2;
  return { left: 0, top, right: 1, bottom: top + shown };
}

/** Where the whole picture sits, given its frame and crop: it can reach past the frame on every side. */
export function getPictureRect(frame: Rect, crop: ImageCrop): Rect {
  const width = frame.width / (crop.right - crop.left);
  const height = frame.height / (crop.bottom - crop.top);
  return { x: frame.x - crop.left * width, y: frame.y - crop.top * height, width, height };
}

function getCropInPicture(frame: Rect, picture: Rect): ImageCrop {
  return {
    left: clamp((frame.x - picture.x) / picture.width, 0, 1),
    top: clamp((frame.y - picture.y) / picture.height, 0, 1),
    right: clamp((frame.x + frame.width - picture.x) / picture.width, 0, 1),
    bottom: clamp((frame.y + frame.height - picture.y) / picture.height, 0, 1),
  };
}

/**
 * Drags an image frame's edge or corner like an InDesign frame: the picture stays where it is,
 * and the frame shows more or less of it, never reaching past the picture's edges.
 */
export function cropFrame(
  start: Rect,
  crop: ImageCrop,
  mode: ResizeMode,
  deltaX: number,
  deltaY: number,
  minSize: Size,
): Rect & { crop: ImageCrop } {
  const picture = getPictureRect(start, crop);
  // A frame already smaller than the minimum may stay that small.
  const minWidth = Math.min(minSize.width, start.width);
  const minHeight = Math.min(minSize.height, start.height);
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (mode.includes("e")) {
    right = clamp(right + deltaX, left + minWidth, picture.x + picture.width);
  }

  if (mode.includes("w")) {
    left = clamp(left + deltaX, picture.x, right - minWidth);
  }

  if (mode.includes("s")) {
    bottom = clamp(bottom + deltaY, top + minHeight, picture.y + picture.height);
  }

  if (mode.includes("n")) {
    top = clamp(top + deltaY, picture.y, bottom - minHeight);
  }

  const frame = { x: left, y: top, width: right - left, height: bottom - top };
  return { ...frame, crop: getCropInPicture(frame, picture) };
}

/** Slides the picture inside its frame (crop mode), keeping the frame covered. */
export function slidePicture(frame: Rect, crop: ImageCrop, deltaX: number, deltaY: number): ImageCrop {
  const picture = getPictureRect(frame, crop);
  const x = clamp(picture.x + deltaX, frame.x + frame.width - picture.width, frame.x);
  const y = clamp(picture.y + deltaY, frame.y + frame.height - picture.height, frame.y);
  return getCropInPicture(frame, { ...picture, x, y });
}

/**
 * Which point stays put while dragging an edge or corner, as fractions of the width and height:
 * the opposite side, or the middle along an edge.
 */
function getResizeAnchor(mode: ResizeMode) {
  return {
    x: mode.includes("e") ? 0 : mode.includes("w") ? 1 : 0.5,
    y: mode.includes("s") ? 0 : mode.includes("n") ? 1 : 0.5,
  };
}

/**
 * The crop for an image frame resized in normal mode: the picture keeps its shape and fills the new frame.
 * Dragging outwards shows more of the picture, and once a side is fully shown, the picture zooms in.
 * It only gets smaller when the whole frame does.
 */
export function fillFrame(start: Rect, crop: ImageCrop, frame: Rect, mode: ResizeMode): ImageCrop {
  const picture = getPictureRect(start, crop);
  const coverScale = Math.max(frame.width / picture.width, frame.height / picture.height);
  const frameScale = Math.max(frame.width / start.width, frame.height / start.height);
  const scale = Math.max(coverScale, Math.min(1, frameScale));
  const width = picture.width * scale;
  const height = picture.height * scale;

  // The picture point under the frame's fixed point stays under it.
  const anchor = getResizeAnchor(mode);
  const startAnchorX = start.x + anchor.x * start.width;
  const startAnchorY = start.y + anchor.y * start.height;
  const anchorX = frame.x + anchor.x * frame.width;
  const anchorY = frame.y + anchor.y * frame.height;
  const x = anchorX - ((startAnchorX - picture.x) / picture.width) * width;
  const y = anchorY - ((startAnchorY - picture.y) / picture.height) * height;

  return getCropInPicture(frame, {
    x: clamp(x, frame.x + frame.width - width, frame.x),
    y: clamp(y, frame.y + frame.height - height, frame.y),
    width,
    height,
  });
}

/**
 * Drags the picture's own edge or corner in crop mode: it scales keeping its shape, or stretches with Ctrl.
 * The frame stays put, and the picture never gets smaller than it.
 */
export function scalePicture(
  frame: Rect,
  crop: ImageCrop,
  mode: ResizeMode,
  deltaX: number,
  deltaY: number,
  isStretching: boolean,
): ImageCrop {
  const start = getPictureRect(frame, crop);

  if (isStretching) {
    const picture = resizeRect(start, mode, deltaX, deltaY, { width: 0, height: 0 });
    const left = Math.min(picture.x, frame.x);
    const top = Math.min(picture.y, frame.y);
    const right = Math.max(picture.x + picture.width, frame.x + frame.width);
    const bottom = Math.max(picture.y + picture.height, frame.y + frame.height);
    return getCropInPicture(frame, { x: left, y: top, width: right - left, height: bottom - top });
  }

  const wanted = resizeRectKeepingRatio(start, mode, deltaX, deltaY, { width: 0, height: 0 });
  const anchor = getResizeAnchor(mode);
  const anchorX = start.x + anchor.x * start.width;
  const anchorY = start.y + anchor.y * start.height;

  // The smallest scale at which the picture, growing from its fixed point, still covers the frame.
  const minScales = [0];
  if (anchor.x > 0) minScales.push((anchorX - frame.x) / (anchor.x * start.width));
  if (anchor.x < 1) minScales.push((frame.x + frame.width - anchorX) / ((1 - anchor.x) * start.width));
  if (anchor.y > 0) minScales.push((anchorY - frame.y) / (anchor.y * start.height));
  if (anchor.y < 1) minScales.push((frame.y + frame.height - anchorY) / ((1 - anchor.y) * start.height));
  const scale = Math.max(wanted.width / start.width, ...minScales);

  const width = start.width * scale;
  const height = start.height * scale;
  return getCropInPicture(frame, {
    x: anchorX - anchor.x * width,
    y: anchorY - anchor.y * height,
    width,
    height,
  });
}

/** Keeps a crop read from a board file only if it makes sense. */
export function isValidCrop(crop: unknown): crop is ImageCrop {
  if (typeof crop !== "object" || crop === null) {
    return false;
  }

  const { left, top, right, bottom } = crop as Record<string, unknown>;
  const values = [left, top, right, bottom];
  return (
    values.every((value) => typeof value === "number" && value >= 0 && value <= 1) &&
    (left as number) < (right as number) &&
    (top as number) < (bottom as number)
  );
}
