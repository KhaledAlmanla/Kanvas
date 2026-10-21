use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

const BOARD_EXTENSION: &str = "kanvas";
const IMAGES_DIR: &str = "Images";
const SETTINGS_FILE: &str = "settings.json";
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
/// Pasted images on a board that was never saved wait here until its first save copies them.
const PASTED_IMAGES_DIR: &str = "Pasted images";
const PASTED_IMAGE_NAME: &str = "Pasted image.png";
/// Added to the board file's name for the copy of the previous save.
const BACKUP_SUFFIX: &str = ".bak";

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

/// Writes to a temporary file first so a failed save never leaves a half-written file behind.
fn write_atomically(path: &Path, contents: &str) -> Result<(), String> {
    let mut temp_name = path.file_name().ok_or("Invalid file path")?.to_os_string();
    temp_name.push(".tmp");
    let temp_path = path.with_file_name(temp_name);
    fs::write(&temp_path, contents).map_err(to_message)?;
    fs::rename(&temp_path, path).map_err(to_message)
}

/// Keeps the previous save as `Board.kanvas.bak` next to the board, then writes the new one.
#[tauri::command]
fn write_board(board_path: String, contents: String) -> Result<(), String> {
    let path = Path::new(&board_path);
    if path.is_file() {
        let mut backup_name = path.file_name().ok_or("Invalid file path")?.to_os_string();
        backup_name.push(BACKUP_SUFFIX);
        fs::copy(path, path.with_file_name(backup_name)).map_err(to_message)?;
    }

    write_atomically(path, &contents)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(to_message)?.join(SETTINGS_FILE))
}

/// Returns the saved app settings, or nothing on first launch.
#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(path).map(Some).map_err(to_message)
}

#[tauri::command]
fn save_settings(app: AppHandle, contents: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    fs::create_dir_all(path.parent().ok_or("Invalid settings folder")?).map_err(to_message)?;
    write_atomically(&path, &contents)
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

    // A missing file that belonged to this board keeps its place, so the board still saves
    // and the image comes back if the file is put back.
    if !source.exists() {
        if source.parent() == Some(images_dir.as_path()) {
            return Ok(BoardImageFile {
                file: format!("{IMAGES_DIR}/{file_name}"),
                path: source_path,
            });
        }
        return Err(format!("The image file is missing: {source_path}"));
    }

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

fn is_image_file(path: &Path) -> bool {
    let has_image_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| IMAGE_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()));
    has_image_extension && path.is_file()
}

/// Lets the webview display these files.
fn allow_files(app: &AppHandle, paths: &[String]) -> Result<(), String> {
    let scope = app.asset_protocol_scope();
    paths
        .iter()
        .try_for_each(|path| scope.allow_file(Path::new(path)).map_err(to_message))
}

/// Keeps only the image files among the given paths (e.g. files dropped on the window) and lets the webview display them.
#[tauri::command]
fn allow_image_files(app: AppHandle, paths: Vec<String>) -> Result<Vec<String>, String> {
    let images: Vec<String> = paths.into_iter().filter(|path| is_image_file(Path::new(path))).collect();
    allow_files(&app, &images)?;
    Ok(images)
}

fn decode_percent_escapes(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        let escaped = (bytes[index] == b'%')
            .then(|| text.get(index + 1..index + 3))
            .flatten()
            .and_then(|hex| u8::from_str_radix(hex, 16).ok());

        match escaped {
            Some(byte) => {
                decoded.push(byte);
                index += 3;
            }
            None => {
                decoded.push(bytes[index]);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&decoded).into_owned()
}

/// Turns one line of copied text into a file path: file managers copy plain paths or file:// URLs.
fn path_from_clipboard_line(line: &str) -> Option<PathBuf> {
    let line = line.trim();
    let Some(url_path) = line.strip_prefix("file://") else {
        return (!line.is_empty()).then(|| PathBuf::from(line));
    };

    // Skip a host name, as in file://localhost/home/...
    let url_path = &url_path[url_path.find('/')?..];
    let decoded = decode_percent_escapes(url_path);
    // Windows URLs look like file:///C:/Users/...
    let is_windows_drive = decoded.as_bytes().get(2) == Some(&b':');
    Some(PathBuf::from(if is_windows_drive { &decoded[1..] } else { &decoded[..] }))
}

/// The image files named in copied text, one per line; anything else in the text is ignored.
fn image_paths_in_text(text: &str) -> Vec<String> {
    // Long text is a document, not a list of copied files.
    if text.len() > 64 * 1024 {
        return Vec::new();
    }

    text.lines()
        .filter_map(path_from_clipboard_line)
        .filter(|path| is_image_file(path))
        .map(|path| path_string(&path))
        .collect()
}

fn write_png(path: &Path, width: u32, height: u32, rgba: &[u8]) -> Result<(), String> {
    let file = fs::File::create(path).map_err(to_message)?;
    let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(to_message)?;
    writer.write_image_data(rgba).map_err(to_message)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ClipboardContents {
    text: Option<String>,
    /// Copied image files, or the file a copied image (such as a screenshot) was saved to.
    image_paths: Vec<String>,
}

/// Image files copied in the file manager, read in the system's own file-list format.
fn copied_image_files() -> Vec<String> {
    arboard::Clipboard::new()
        .and_then(|mut clipboard| clipboard.get().file_list())
        .unwrap_or_default()
        .into_iter()
        .filter(|path| is_image_file(path))
        .map(|path| path_string(&path))
        .collect()
}

/// Reads the system clipboard for pasting. A copied image is saved as a PNG: into the board's
/// Images folder when the board has been saved, otherwise into the app's cache until the first save.
#[tauri::command]
fn read_clipboard(app: AppHandle, board_path: Option<String>) -> Result<ClipboardContents, String> {
    let clipboard = app.clipboard();
    let text = clipboard.read_text().ok();
    let mut image_paths = text.as_deref().map(image_paths_in_text).unwrap_or_default();

    // Files copied in Windows Explorer or macOS Finder aren't on the clipboard as text.
    if image_paths.is_empty() {
        image_paths = copied_image_files();
    }

    if image_paths.is_empty() {
        if let Ok(image) = clipboard.read_image() {
            let dir = match &board_path {
                Some(board_path) => board_dir(Path::new(board_path))?.join(IMAGES_DIR),
                None => app.path().app_cache_dir().map_err(to_message)?.join(PASTED_IMAGES_DIR),
            };
            fs::create_dir_all(&dir).map_err(to_message)?;

            let path = unique_file_path(&dir, PASTED_IMAGE_NAME);
            write_png(&path, image.width(), image.height(), image.rgba())?;
            image_paths.push(path_string(&path));
        }
    }

    allow_files(&app, &image_paths)?;
    Ok(ClipboardContents { text, image_paths })
}

#[tauri::command]
fn write_clipboard_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(to_message)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            prepare_board_path,
            read_board,
            write_board,
            copy_image_to_board,
            allow_image_files,
            read_clipboard,
            write_clipboard_text,
            load_settings,
            save_settings
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
    fn copied_text_yields_image_files() {
        let root = temp_dir("clipboard");
        let photo = root.join("my photo.png");
        let notes = root.join("notes.txt");
        fs::write(&photo, b"png").unwrap();
        fs::write(&notes, b"text").unwrap();

        let photo_path = path_string(&photo);
        let photo_url = format!("file://{}", photo_path.replace(' ', "%20"));

        // Plain paths, as GNOME Files copies them.
        assert_eq!(image_paths_in_text(&format!("{photo_path}\n{}", path_string(&notes))), vec![photo_path.clone()]);
        // A URL list with a "copy" header, as other file managers copy them.
        assert_eq!(image_paths_in_text(&format!("copy\n{photo_url}\n")), vec![photo_path.clone()]);
        // Ordinary text is not a file list.
        assert!(image_paths_in_text("just some words").is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_urls_are_decoded() {
        assert_eq!(path_from_clipboard_line("file:///home/me/a%20b.png"), Some(PathBuf::from("/home/me/a b.png")));
        assert_eq!(path_from_clipboard_line("file://localhost/tmp/x.png"), Some(PathBuf::from("/tmp/x.png")));
        assert_eq!(path_from_clipboard_line("file:///C:/Users/me/x.png"), Some(PathBuf::from("C:/Users/me/x.png")));
        assert_eq!(path_from_clipboard_line("   "), None);
    }

    #[test]
    fn board_file_round_trips() {
        let root = temp_dir("write");
        let board_path = path_string(&root.join("Board.kanvas"));
        write_board(board_path.clone(), "{\"app\":\"kanvas\"}".into()).unwrap();
        write_board(board_path.clone(), "{\"app\":\"kanvas\",\"version\":1}".into()).unwrap();
        assert_eq!(fs::read_to_string(&board_path).unwrap(), "{\"app\":\"kanvas\",\"version\":1}");
        assert!(!root.join("Board.kanvas.tmp").exists());
        assert_eq!(fs::read_to_string(root.join("Board.kanvas.bak")).unwrap(), "{\"app\":\"kanvas\"}");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_board_image_keeps_its_place() {
        let root = temp_dir("missing");
        let board_path = path_string(&root.join("Board.kanvas"));
        let gone = path_string(&root.join(IMAGES_DIR).join("gone.png"));
        let stored = copy_image_to_board(board_path.clone(), gone.clone()).unwrap();
        assert_eq!(stored.file, "Images/gone.png");
        assert_eq!(stored.path, gone);

        let outside = path_string(&root.join("elsewhere.png"));
        assert!(copy_image_to_board(board_path, outside).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
