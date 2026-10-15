use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const BOARD_EXTENSION: &str = "kanvas";
const IMAGES_DIR: &str = "Images";

fn to_message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn board_dir(board_path: &Path) -> Result<&Path, String> {
    board_path
        .parent()
        .ok_or_else(|| "Invalid board location".to_string())
}

/// Lets the webview display images stored inside a board folder.
fn allow_board_dir(app: &AppHandle, dir: &Path) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(dir, true)
        .map_err(to_message)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparedBoardPath {
    path: String,
    already_exists: bool,
}

/// Every board lives in its own folder, next to its Images folder:
/// "~/Boards/MyBoard.kanvas" becomes "~/Boards/MyBoard/MyBoard.kanvas".
/// When the chosen file is already inside a folder named after the board, that folder is used as is.
fn resolve_board_path(chosen: &Path) -> Result<PathBuf, String> {
    let name = chosen
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.trim().is_empty())
        .ok_or_else(|| "Invalid board name".to_string())?;
    let parent = board_dir(chosen)?;
    let is_own_folder = parent.file_name().is_some_and(|folder| folder == name);
    let dir = if is_own_folder { parent.to_path_buf() } else { parent.join(name) };
    Ok(dir.join(format!("{name}.{BOARD_EXTENSION}")))
}

#[tauri::command]
fn prepare_board_path(app: AppHandle, chosen_path: String) -> Result<PreparedBoardPath, String> {
    let path = resolve_board_path(Path::new(&chosen_path))?;
    let dir = board_dir(&path)?;
    let already_exists = path.exists();

    fs::create_dir_all(dir.join(IMAGES_DIR)).map_err(to_message)?;
    allow_board_dir(&app, dir)?;

    Ok(PreparedBoardPath {
        path: path_string(&path),
        already_exists,
    })
}

#[tauri::command]
fn read_board(app: AppHandle, board_path: String) -> Result<String, String> {
    let path = PathBuf::from(board_path);
    let contents = fs::read_to_string(&path).map_err(to_message)?;
    allow_board_dir(&app, board_dir(&path)?)?;
    Ok(contents)
}

/// Writes to a temporary file first so a failed save never leaves a half-written board behind.
#[tauri::command]
fn write_board(board_path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(board_path);
    let temp_path = path.with_extension(format!("{BOARD_EXTENSION}.tmp"));
    fs::write(&temp_path, contents).map_err(to_message)?;
    fs::rename(&temp_path, &path).map_err(to_message)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BoardImageFile {
    /// Path relative to the board folder, always with forward slashes.
    file: String,
    /// Absolute path on disk, used for display.
    path: String,
}

fn unique_file_path(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let original = Path::new(file_name);
    let stem = original.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let extension = original.extension().and_then(|e| e.to_str());

    (2..)
        .map(|index| {
            let name = match extension {
                Some(extension) => format!("{stem} ({index}).{extension}"),
                None => format!("{stem} ({index})"),
            };
            dir.join(name)
        })
        .find(|path| !path.exists())
        .expect("an unused file name always exists")
}

/// Copies an image into the board's Images folder, unless it already lives there.
#[tauri::command]
fn copy_image_to_board(board_path: String, source_path: String) -> Result<BoardImageFile, String> {
    let images_dir = board_dir(Path::new(&board_path))?.join(IMAGES_DIR);
    fs::create_dir_all(&images_dir).map_err(to_message)?;

    let source = PathBuf::from(&source_path);
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid image file name: {source_path}"))?
        .to_string();

    // Compare canonical paths, but never hand them back: on Windows they carry a "\\?\" prefix.
    let canonical_images_dir = images_dir.canonicalize().map_err(to_message)?;
    let canonical_source = source
        .canonicalize()
        .map_err(|error| format!("{source_path}: {error}"))?;

    let target = if canonical_source.parent() == Some(canonical_images_dir.as_path()) {
        images_dir.join(&file_name)
    } else {
        let target = unique_file_path(&images_dir, &file_name);
        fs::copy(&source, &target).map_err(|error| format!("{source_path}: {error}"))?;
        target
    };

    let stored_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&file_name)
        .to_string();

    Ok(BoardImageFile {
        file: format!("{IMAGES_DIR}/{stored_name}"),
        path: path_string(&target),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            prepare_board_path,
            read_board,
            write_board,
            copy_image_to_board
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("kanvas-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn board_gets_its_own_folder() {
        let resolved = resolve_board_path(Path::new("/boards/MyBoard.kanvas")).unwrap();
        assert_eq!(resolved, Path::new("/boards/MyBoard/MyBoard.kanvas"));
    }

    #[test]
    fn existing_board_folder_is_not_nested_again() {
        let resolved = resolve_board_path(Path::new("/boards/MyBoard/MyBoard.kanvas")).unwrap();
        assert_eq!(resolved, Path::new("/boards/MyBoard/MyBoard.kanvas"));
    }

    #[test]
    fn missing_extension_is_added() {
        let resolved = resolve_board_path(Path::new("/boards/MyBoard")).unwrap();
        assert_eq!(resolved, Path::new("/boards/MyBoard/MyBoard.kanvas"));
    }

    #[test]
    fn images_are_copied_once_with_unique_names() {
        let root = temp_dir("copy");
        let board_path = root.join("Board").join("Board.kanvas");
        fs::create_dir_all(board_path.parent().unwrap()).unwrap();

        let first_source = root.join("photo.png");
        let second_source_dir = root.join("other");
        fs::create_dir_all(&second_source_dir).unwrap();
        let second_source = second_source_dir.join("photo.png");
        fs::write(&first_source, b"first").unwrap();
        fs::write(&second_source, b"second").unwrap();

        let board = path_string(&board_path);
        let first = copy_image_to_board(board.clone(), path_string(&first_source)).unwrap();
        let second = copy_image_to_board(board.clone(), path_string(&second_source)).unwrap();
        assert_eq!(first.file, "Images/photo.png");
        assert_eq!(second.file, "Images/photo (2).png");
        assert_eq!(fs::read(&second.path).unwrap(), b"second");

        // Saving again must not duplicate an image that already lives in the board.
        let again = copy_image_to_board(board, first.path.clone()).unwrap();
        assert_eq!(again.file, "Images/photo.png");
        assert_eq!(fs::read_dir(root.join("Board").join(IMAGES_DIR)).unwrap().count(), 2);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn board_file_round_trips() {
        let root = temp_dir("write");
        let board_path = path_string(&root.join("Board.kanvas"));
        write_board(board_path.clone(), "{\"app\":\"kanvas\"}".into()).unwrap();
        write_board(board_path.clone(), "{\"app\":\"kanvas\",\"version\":1}".into()).unwrap();
        assert_eq!(fs::read_to_string(&board_path).unwrap(), "{\"app\":\"kanvas\",\"version\":1}");
        assert!(!root.join("Board.kanvas.tmp").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
