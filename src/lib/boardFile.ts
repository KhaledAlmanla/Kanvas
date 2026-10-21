import { invoke } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";
import { isValidCrop, type BoardImageItem, type BoardItem, type BoardTextItem, type Rect } from "./boardItems";
import type { ThemeMode } from "./settings";

export const BOARD_EXTENSION = "kanvas";
export const BOARD_FILE_VERSION = 4;
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

export type BoardView = {
  x: number;
  y: number;
  zoom: number;
};

/** Settings that belong to one board (marked "This board" in the settings panel). */
export type BoardSettings = {
  /** "app" follows the app's theme setting. */
  theme: "app" | ThemeMode;
  background: "dots" | "plain" | "paper";
};

export const DEFAULT_BOARD_SETTINGS: BoardSettings = { theme: "app", background: "dots" };

export type BoardState = {
  settings: BoardSettings;
  view: BoardView;
  items: BoardItem[];
};

// On disk, images point at a file relative to the board folder instead of an absolute path,
// so the whole board folder can be moved or shared.
type BoardFileImage = Omit<BoardImageItem, "path"> & { file: string };
type BoardFileItem = BoardFileImage | BoardTextItem;

type BoardFile = {
  app: "kanvas";
  version: number;
  settings: BoardSettings;
  view: BoardView;
  items: BoardFileItem[];
};

/**
 * Version 4 added `crop` to images; older images have none.
 * Version 1 kept images and text boxes in separate lists, with numeric ids.
 * Versions 1 and 2 also stored a theme; it is dropped on load so old boards follow the app theme.
 */
type BoardFileV1 = {
  app: "kanvas";
  version: 1;
  view: BoardView;
  images: (Rect & { id: number; name: string; file: string })[];
  textBoxes: (Rect & { id: number; text: string })[];
};

type StoredImageFile = {
  file: string;
  path: string;
};

type PreparedBoardPath = {
  path: string;
  alreadyExists: boolean;
};

const boardFilters = [{ name: "Kanvas board", extensions: [BOARD_EXTENSION] }];

export const getBoardName = (boardPath: string) =>
  (boardPath.split(/[\\/]/).pop() ?? boardPath).replace(new RegExp(`\\.${BOARD_EXTENSION}$`, "i"), "");

export const getFileName = (filePath: string) => filePath.split(/[\\/]/).pop() ?? filePath;

/** Serializes the parts of a board that count as unsaved changes (panning and zooming don't). */
export const getBoardSnapshot = ({ settings, items }: Pick<BoardState, "settings" | "items">) =>
  JSON.stringify({ settings, items });

/** Copies every image into the board's Images folder, then writes the board file. Returns the items with their new image paths. */
export async function writeBoardFile(boardPath: string, board: BoardState): Promise<BoardItem[]> {
  const storedBySource = new Map<string, StoredImageFile>();
  const fileItems: BoardFileItem[] = [];
  const savedItems: BoardItem[] = [];

  // Sequential on purpose: parallel copies of files with the same name could pick the same target name.
  for (const item of board.items) {
    if (item.type !== "image") {
      fileItems.push(item);
      savedItems.push(item);
      continue;
    }

    let stored = storedBySource.get(item.path);
    if (!stored) {
      stored = await invoke<StoredImageFile>("copy_image_to_board", { boardPath, sourcePath: item.path });
      storedBySource.set(item.path, stored);
    }

    const { path: _path, ...rest } = item;
    fileItems.push({ ...rest, file: stored.file });
    savedItems.push({ ...item, path: stored.path });
  }

  const contents: BoardFile = {
    app: "kanvas",
    version: BOARD_FILE_VERSION,
    settings: board.settings,
    view: board.view,
    items: fileItems,
  };

  await invoke("write_board", { boardPath, contents: JSON.stringify(contents, null, 2) });
  return savedItems;
}

const upgradeV1Items = (file: BoardFileV1): BoardFileItem[] => [
  ...file.images.map(({ id, ...rest }) => ({ ...rest, id: String(id), type: "image" as const })),
  ...file.textBoxes.map(({ id, ...rest }) => ({ ...rest, id: String(id), type: "text" as const })),
];

export async function readBoardFile(boardPath: string): Promise<BoardState> {
  const contents = await invoke<string>("read_board", { boardPath });
  const parsed = JSON.parse(contents) as Partial<BoardFile> | BoardFileV1;

  if (parsed.app !== "kanvas") {
    throw new Error("This file is not a Kanvas board.");
  }

  if (typeof parsed.version === "number" && parsed.version > BOARD_FILE_VERSION) {
    throw new Error("This board was saved by a newer version of Kanvas.");
  }

  const fileItems = parsed.version === 1 ? upgradeV1Items(parsed as BoardFileV1) : (parsed as Partial<BoardFile>).items;
  if (!Array.isArray(fileItems)) {
    throw new Error("This board file is damaged: it has no item list.");
  }

  const boardDir = await dirname(boardPath);
  const items = await Promise.all(
    fileItems.map(async (item): Promise<BoardItem> => {
      if (item.type !== "image") {
        return item;
      }

      const { file, crop, ...rest } = item;
      const path = await join(boardDir, ...file.split("/"));
      return isValidCrop(crop) ? { ...rest, path, crop } : { ...rest, path };
    }),
  );

  const savedSettings = (parsed as Partial<BoardFile>).settings;
  const settings: BoardSettings = {
    theme: savedSettings?.theme === "dark" || savedSettings?.theme === "light" ? savedSettings.theme : "app",
    background: savedSettings?.background === "plain" ? "plain" : "dots",
  };

  return {
    settings,
    view: parsed.view ?? { x: 0, y: 0, zoom: 1 },
    items,
  };
}

export async function pickBoardToOpen(defaultFolder: string | null): Promise<string | null> {
  const selected = await open({
    title: "Open board",
    multiple: false,
    directory: false,
    defaultPath: defaultFolder ?? undefined,
    filters: boardFilters,
  });
  return typeof selected === "string" ? selected : null;
}

export async function pickFolder(title: string): Promise<string | null> {
  const selected = await open({ title, multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}

/** Asks where to save, and returns the final board file path inside its own folder. */
export async function pickBoardSaveLocation(suggestedName: string, defaultFolder: string | null): Promise<string | null> {
  const fileName = `${suggestedName}.${BOARD_EXTENSION}`;
  const chosenPath = await save({
    title: "Save board",
    defaultPath: defaultFolder ? await join(defaultFolder, fileName) : fileName,
    filters: boardFilters,
  });

  if (!chosenPath) {
    return null;
  }

  const prepared = await invoke<PreparedBoardPath>("prepare_board_path", { chosenPath });

  // The save dialog only asked about the path the user typed, not the one inside the board folder.
  if (prepared.alreadyExists && prepared.path !== chosenPath) {
    const replace = await ask(`A board already exists at:\n${prepared.path}\n\nReplace it?`, {
      title: "Replace board?",
      kind: "warning",
      okLabel: "Replace",
      cancelLabel: "Cancel",
    });

    if (!replace) {
      return null;
    }
  }

  return prepared.path;
}

/** Copies one image into a saved board's Images folder and returns the copy's path. */
export async function copyImageIntoBoard(boardPath: string, sourcePath: string): Promise<string> {
  const stored = await invoke<StoredImageFile>("copy_image_to_board", { boardPath, sourcePath });
  return stored.path;
}

export async function pickImagesToImport(): Promise<string[]> {
  const selected = await open({
    title: "Import images",
    multiple: true,
    directory: false,
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  });

  return selected ?? [];
}

/** Keeps only the image files among the given paths (e.g. files dropped on the window), ready to display. */
export const allowImageFiles = (paths: string[]) => invoke<string[]>("allow_image_files", { paths });

export const isImagePath = (path: string) =>
  IMAGE_EXTENSIONS.includes(path.split(".").pop()?.toLowerCase() ?? "");

export type ClipboardContents = {
  text: string | null;
  /** Copied image files, or the file a copied image (such as a screenshot) was saved to. */
  imagePaths: string[];
};

/** Reads the system clipboard. A copied image is saved into the board (or a cache folder until the first save). */
export const readClipboard = (boardPath: string | null) =>
  invoke<ClipboardContents>("read_clipboard", { boardPath });

export const writeClipboardText = (text: string) => invoke<void>("write_clipboard_text", { text });

export type UnsavedChangesChoice = "save" | "discard" | "cancel";

export async function askAboutUnsavedChanges(boardName: string): Promise<UnsavedChangesChoice> {
  const saveLabel = "Save";
  const discardLabel = "Don't Save";
  const result = await message(`Do you want to save the changes to "${boardName}"?`, {
    title: "Unsaved changes",
    kind: "warning",
    buttons: { yes: saveLabel, no: discardLabel, cancel: "Cancel" },
  });

  // Some platforms report custom buttons by their label, others as Yes / No / Cancel.
  if (result === saveLabel || result === "Yes") {
    return "save";
  }

  if (result === discardLabel || result === "No") {
    return "discard";
  }

  return "cancel";
}

export async function showError(title: string, error: unknown) {
  await message(String(error instanceof Error ? error.message : error), { title, kind: "error" });
}
