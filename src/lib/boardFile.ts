import { invoke } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";
import type { BoardImageItem } from "../components/C_Images";
import type { BoardTextBoxItem } from "../components/C_textBoxes";

export const BOARD_EXTENSION = "kanvas";
const BOARD_FILE_VERSION = 1;
const LAST_BOARD_KEY = "kanvas-last-board";
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

export type Theme = "dark" | "light";

export type BoardView = {
  x: number;
  y: number;
  zoom: number;
};

export type BoardState = {
  theme: Theme;
  view: BoardView;
  images: BoardImageItem[];
  textBoxes: BoardTextBoxItem[];
};

// On disk, images point at a file relative to the board folder instead of an absolute path,
// so the whole board folder can be moved or shared.
type BoardFileImage = Omit<BoardImageItem, "path"> & { file: string };

type BoardFile = {
  app: "kanvas";
  version: number;
  theme: Theme;
  view: BoardView;
  images: BoardFileImage[];
  textBoxes: BoardTextBoxItem[];
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
export const getBoardSnapshot = ({ theme, images, textBoxes }: Pick<BoardState, "theme" | "images" | "textBoxes">) =>
  JSON.stringify({ theme, images, textBoxes });

export const getLastBoardPath = () => {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
};

export const setLastBoardPath = (boardPath: string | null) => {
  try {
    if (boardPath) {
      localStorage.setItem(LAST_BOARD_KEY, boardPath);
    } else {
      localStorage.removeItem(LAST_BOARD_KEY);
    }
  } catch {
    // Remembering the last board is only a convenience.
  }
};

/** Copies every image into the board's Images folder, then writes the board file. Returns the images with their new paths. */
export async function writeBoardFile(boardPath: string, board: BoardState): Promise<BoardImageItem[]> {
  const storedBySource = new Map<string, StoredImageFile>();
  const fileImages: BoardFileImage[] = [];
  const savedImages: BoardImageItem[] = [];

  // Sequential on purpose: parallel copies of files with the same name could pick the same target name.
  for (const image of board.images) {
    let stored = storedBySource.get(image.path);
    if (!stored) {
      stored = await invoke<StoredImageFile>("copy_image_to_board", { boardPath, sourcePath: image.path });
      storedBySource.set(image.path, stored);
    }

    const { path: _path, ...rest } = image;
    fileImages.push({ ...rest, file: stored.file });
    savedImages.push({ ...image, path: stored.path });
  }

  const contents: BoardFile = {
    app: "kanvas",
    version: BOARD_FILE_VERSION,
    theme: board.theme,
    view: board.view,
    images: fileImages,
    textBoxes: board.textBoxes,
  };

  await invoke("write_board", { boardPath, contents: JSON.stringify(contents, null, 2) });
  return savedImages;
}

export async function readBoardFile(boardPath: string): Promise<BoardState> {
  const contents = await invoke<string>("read_board", { boardPath });
  const parsed = JSON.parse(contents) as Partial<BoardFile>;

  if (parsed.app !== "kanvas" || !Array.isArray(parsed.images) || !Array.isArray(parsed.textBoxes)) {
    throw new Error("This file is not a Kanvas board.");
  }

  if (typeof parsed.version === "number" && parsed.version > BOARD_FILE_VERSION) {
    throw new Error("This board was saved by a newer version of Kanvas.");
  }

  const boardDir = await dirname(boardPath);
  const images = await Promise.all(
    parsed.images.map(async ({ file, ...rest }) => ({
      ...rest,
      path: await join(boardDir, ...file.split("/")),
    })),
  );

  return {
    theme: parsed.theme === "light" ? "light" : "dark",
    view: parsed.view ?? { x: 0, y: 0, zoom: 1 },
    images,
    textBoxes: parsed.textBoxes,
  };
}

export async function pickBoardToOpen(): Promise<string | null> {
  const selected = await open({ title: "Open board", multiple: false, directory: false, filters: boardFilters });
  return typeof selected === "string" ? selected : null;
}

/** Asks where to save, and returns the final board file path inside its own folder. */
export async function pickBoardSaveLocation(suggestedName: string): Promise<string | null> {
  const chosenPath = await save({
    title: "Save board",
    defaultPath: `${suggestedName}.${BOARD_EXTENSION}`,
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

export async function pickImagesToImport(): Promise<string[]> {
  const selected = await open({
    title: "Import images",
    multiple: true,
    directory: false,
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  });

  return selected ?? [];
}

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
