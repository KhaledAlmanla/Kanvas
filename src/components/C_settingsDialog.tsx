import { useEffect, useState, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { X } from "lucide-react";
import { FONT_STACKS, type FontChoice, type TextAlign } from "../lib/boardItems";
import { BOARD_FILE_VERSION, pickFolder, showError, type BoardSettings } from "../lib/boardFile";
import {
  DEFAULT_COLORS,
  RECENT_BOARDS_LIMITS,
  type ColorScheme,
  type OptionBarMode,
  type Settings,
  type ThemeMode,
  type ThemePreference,
  type ToolbarSize,
} from "../lib/settings";

const REPOSITORY_URL = "https://github.com/KhaledAlmanla/Kanvas";

type SectionId = "general" | "appearance" | "canvas" | "text" | "images" | "export" | "shortcuts" | "about";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "canvas", label: "Canvas & mouse" },
  { id: "text", label: "Text boxes" },
  { id: "images", label: "Images & saving" },
  { id: "export", label: "Export" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
  { id: "about", label: "About" },
];

const COLOR_FIELDS: { key: Exclude<keyof ColorScheme, "gridStrength">; label: string }[] = [
  { key: "canvasStart", label: "Canvas gradient start" },
  { key: "canvasEnd", label: "Canvas gradient end" },
  { key: "gridDots", label: "Grid dots" },
  { key: "panel", label: "Panels and toolbar" },
  { key: "panelText", label: "Panel text and icons" },
  { key: "textBox", label: "Text box background" },
  { key: "text", label: "Text" },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+N", "New board"],
  ["Ctrl+O", "Open board"],
  ["Ctrl+S", "Save board"],
  ["Ctrl+Shift+S", "Save board as"],
  ["Ctrl+,", "Open or close settings"],
  ["Delete / Backspace", "Delete selected items"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z / Ctrl+Y", "Redo"],
  ["Ctrl+C / Ctrl+X", "Copy or cut selected items"],
  ["Ctrl+V", "Paste items, or images and image files copied in other apps"],
  ["Drop image files", "Add them where they are dropped"],
  ["Esc", "Close settings"],
  ["Click", "Select an item"],
  ["Ctrl+click", "Add or remove an item from the selection"],
  ["Drag on empty canvas", "Box-select (hold Ctrl to add to the selection)"],
  ["Double-click a text box", "Edit its text"],
  ["Right-click an item", "Show its option bar"],
  ["Right-click the canvas", "Move the toolbar to the pointer"],
  ["Middle-drag", "Pan the board"],
  ["Mouse wheel", "Zoom around the pointer"],
];

type C_settingsDialogProps = {
  settings: Settings;
  onSettingsChange: (update: (current: Settings) => Settings) => void;
  boardSettings: BoardSettings;
  onBoardSettingsChange: (next: BoardSettings) => void;
  boardName: string;
  activeTheme: ThemeMode;
  onClose: () => void;
};

function Row({ label, hint, isBoardSetting = false, children }: {
  label: string;
  hint?: string;
  isBoardSetting?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <span>
          {label}
          {isBoardSetting && <span className="settings-badge">This board</span>}
        </span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="settings-soon">
      <span className="settings-badge settings-badge--soon">Coming soon</span>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="settings-segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "is-active" : ""}
          disabled={option.disabled}
          title={option.disabled ? "Coming soon" : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
      <span aria-hidden="true" />
    </label>
  );
}

export default function C_settingsDialog({
  settings,
  onSettingsChange,
  boardSettings,
  onBoardSettingsChange,
  boardName,
  activeTheme,
  onClose,
}: C_settingsDialogProps) {
  const [section, setSection] = useState<SectionId>("general");
  const [colorMode, setColorMode] = useState<ThemeMode>(activeTheme);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("unknown"));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const update = <K extends keyof Settings>(group: K, patch: Partial<Settings[K]>) =>
    onSettingsChange((current) => ({ ...current, [group]: { ...current[group], ...patch } }));

  const updateColor = (mode: ThemeMode, patch: Partial<ColorScheme>) =>
    onSettingsChange((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        colors: { ...current.appearance.colors, [mode]: { ...current.appearance.colors[mode], ...patch } },
      },
    }));

  const chooseDefaultFolder = async () => {
    try {
      const folder = await pickFolder("Default folder for boards");
      if (folder) {
        update("general", { defaultBoardFolder: folder });
      }
    } catch (error) {
      await showError("Could not choose a folder", error);
    }
  };

  const { general, appearance, canvas, text, memory } = settings;
  const scheme = appearance.colors[colorMode];

  const renderSection = () => {
    switch (section) {
      case "general":
        return (
          <>
            <Row label="Reopen last board on startup" hint="Opens the board you had open when you last closed Kanvas.">
              <Toggle
                label="Reopen last board on startup"
                checked={general.reopenLastBoard}
                onChange={(reopenLastBoard) => update("general", { reopenLastBoard })}
              />
            </Row>
            <Row label="Default folder for boards" hint="Where Open and Save As start.">
              <div className="settings-folder">
                <span className="settings-path" title={general.defaultBoardFolder ?? undefined}>
                  {general.defaultBoardFolder ?? "System default"}
                </span>
                <button type="button" className="settings-button" onClick={() => void chooseDefaultFolder()}>
                  Choose…
                </button>
                {general.defaultBoardFolder && (
                  <button type="button" className="settings-button" onClick={() => update("general", { defaultBoardFolder: null })}>
                    Reset
                  </button>
                )}
              </div>
            </Row>
            <Row label="Show recent boards" hint="Clicking Open in the toolbar lists recent boards first.">
              <Toggle
                label="Show recent boards"
                checked={general.showRecentBoards}
                onChange={(showRecentBoards) => update("general", { showRecentBoards })}
              />
            </Row>
            <Row label="Number of recent boards">
              <Segmented
                value={String(general.recentBoardsLimit)}
                options={RECENT_BOARDS_LIMITS.map((limit) => ({ value: String(limit), label: String(limit) }))}
                onChange={(limit) => update("general", { recentBoardsLimit: Number(limit) })}
              />
            </Row>
            <Row label="Recent boards list" hint={`${memory.recentBoards.length} remembered`}>
              <button
                type="button"
                className="settings-button"
                disabled={memory.recentBoards.length === 0}
                onClick={() => update("memory", { recentBoards: [] })}
              >
                Clear list
              </button>
            </Row>
          </>
        );

      case "appearance":
        return (
          <>
            <Row label="Theme" hint="Follow system matches your operating system's light or dark mode.">
              <Segmented<ThemePreference>
                value={appearance.theme}
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "Follow system" },
                ]}
                onChange={(theme) => update("appearance", { theme })}
              />
            </Row>
            <Row label="Theme" hint={`Overrides the app theme for "${boardName}".`} isBoardSetting>
              <Segmented<BoardSettings["theme"]>
                value={boardSettings.theme}
                options={[
                  { value: "app", label: "App setting" },
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
                onChange={(theme) => onBoardSettingsChange({ ...boardSettings, theme })}
              />
            </Row>
            <Row label="Canvas background" isBoardSetting>
              <Segmented<BoardSettings["background"]>
                value={boardSettings.background}
                options={[
                  { value: "dots", label: "Dot grid" },
                  { value: "plain", label: "Plain" },
                  { value: "paper", label: "Paper", disabled: true },
                ]}
                onChange={(background) => onBoardSettingsChange({ ...boardSettings, background })}
              />
            </Row>
            <Row label="Grid spacing" hint={`${appearance.gridSpacing}px between dots`}>
              <input
                type="range"
                min={8}
                max={64}
                step={2}
                value={appearance.gridSpacing}
                onChange={(event) => update("appearance", { gridSpacing: Number(event.target.value) })}
              />
            </Row>
            <Row label="Accent colour" hint="Selection outlines, selection box and resize handles.">
              <div className="settings-color">
                <input type="color" value={appearance.accent} onChange={(event) => update("appearance", { accent: event.target.value })} />
                <button type="button" className="settings-button" onClick={() => update("appearance", { accent: "#60a5fa" })}>
                  Reset
                </button>
              </div>
            </Row>

            <div className="settings-subheading">
              <h3>Colour scheme</h3>
              <Segmented<ThemeMode>
                value={colorMode}
                options={[
                  { value: "dark", label: "Dark mode" },
                  { value: "light", label: "Light mode" },
                ]}
                onChange={setColorMode}
              />
            </div>
            {COLOR_FIELDS.map((field) => (
              <Row key={field.key} label={field.label}>
                <div className="settings-color">
                  <input
                    type="color"
                    value={scheme[field.key]}
                    onChange={(event) => updateColor(colorMode, { [field.key]: event.target.value })}
                  />
                  <code>{scheme[field.key]}</code>
                </div>
              </Row>
            ))}
            <Row label="Grid dot strength" hint={`${scheme.gridStrength}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={scheme.gridStrength}
                onChange={(event) => updateColor(colorMode, { gridStrength: Number(event.target.value) })}
              />
            </Row>
            <Row label={`Reset ${colorMode} mode colours`}>
              <button type="button" className="settings-button" onClick={() => updateColor(colorMode, DEFAULT_COLORS[colorMode])}>
                Reset colours
              </button>
            </Row>
          </>
        );

      case "canvas":
        return (
          <>
            <Row label="Minimum zoom" hint={`${canvas.minZoomPercent}%`}>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={canvas.minZoomPercent}
                onChange={(event) => update("canvas", { minZoomPercent: Number(event.target.value) })}
              />
            </Row>
            <Row label="Maximum zoom" hint={`${canvas.maxZoomPercent}%`}>
              <input
                type="range"
                min={100}
                max={1000}
                step={50}
                value={canvas.maxZoomPercent}
                onChange={(event) => update("canvas", { maxZoomPercent: Number(event.target.value) })}
              />
            </Row>
            <Row label="Show option bar" hint="The delete / edit buttons beside an item.">
              <Segmented<OptionBarMode>
                value={canvas.optionBar}
                options={[
                  { value: "hover", label: "Hover + selected" },
                  { value: "selection", label: "Selected only" },
                  { value: "right-click", label: "Right-click only" },
                ]}
                onChange={(optionBar) => update("canvas", { optionBar })}
              />
            </Row>
            <Row label="Remember toolbar position" hint="Puts the toolbar back where you left it next time.">
              <Toggle
                label="Remember toolbar position"
                checked={canvas.rememberToolbarPosition}
                onChange={(rememberToolbarPosition) => update("canvas", { rememberToolbarPosition })}
              />
            </Row>
            <Row label="Toolbar size">
              <Segmented<ToolbarSize>
                value={canvas.toolbarSize}
                options={[
                  { value: "small", label: "Small" },
                  { value: "medium", label: "Medium" },
                  { value: "large", label: "Large" },
                ]}
                onChange={(toolbarSize) => update("canvas", { toolbarSize })}
              />
            </Row>
            <ComingSoon items={["Snap to grid or to other items, with snap distance"]} />
          </>
        );

      case "text":
        return (
          <>
            <p className="settings-note">These apply to new text boxes. Existing text boxes keep their look.</p>
            <Row label="Font">
              <select value={text.font} onChange={(event) => update("text", { font: event.target.value as FontChoice })}>
                <option value="sans">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
                <option value="handwritten">Handwritten</option>
              </select>
            </Row>
            <Row label="Size" hint={`${text.size}px`}>
              <input
                type="range"
                min={8}
                max={96}
                value={text.size}
                onChange={(event) => update("text", { size: Number(event.target.value) })}
              />
            </Row>
            <Row label="Colour" hint="Follow theme uses the text colour of the current colour scheme.">
              <div className="settings-color">
                <Toggle
                  label="Follow theme"
                  checked={text.color === null}
                  onChange={(followTheme) => update("text", { color: followTheme ? null : appearance.colors[activeTheme].text })}
                />
                <span>Follow theme</span>
                {text.color !== null && (
                  <input type="color" value={text.color} onChange={(event) => update("text", { color: event.target.value })} />
                )}
              </div>
            </Row>
            <Row label="Alignment">
              <Segmented<TextAlign>
                value={text.align}
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Center" },
                  { value: "right", label: "Right" },
                ]}
                onChange={(align) => update("text", { align })}
              />
            </Row>
            <div
              className="settings-text-preview"
              style={{
                fontFamily: FONT_STACKS[text.font],
                fontSize: text.size,
                color: text.color ?? "var(--item-text)",
                textAlign: text.align,
              }}
            >
              The quick brown fox jumps over the lazy dog
            </div>
          </>
        );

      case "images":
        return (
          <>
            <p className="settings-note">
              Imported images are copied into the board's Images folder straight away. For a board that has never been
              saved, they are copied on its first save.
            </p>
            <p className="settings-note">
              Each save keeps the previous version next to the board as a backup (MyBoard.kanvas.bak). To go back to
              it, rename it to MyBoard.kanvas.
            </p>
            <p className="settings-note">Images always keep their shape when resized.</p>
            <ComingSoon
              items={[
                "Clean up unused images in the Images folder",
                "Autosave every 1, 5 or 10 minutes",
              ]}
            />
          </>
        );

      case "export":
        return (
          <ComingSoon
            items={[
              "Format: PNG or JPG",
              "Scale: 1x, 2x or 4x",
              "Transparent or canvas background",
              "Destination: the board's Export folder, or ask each time",
            ]}
          />
        );

      case "shortcuts":
        return (
          <table className="settings-shortcuts">
            <tbody>
              {SHORTCUTS.map(([keys, action]) => (
                <tr key={keys}>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case "about":
        return (
          <>
            <Row label="Kanvas version">
              <code>{appVersion}</code>
            </Row>
            <Row label="Board file format">
              <code>version {BOARD_FILE_VERSION}</code>
            </Row>
            <Row label="Source code" hint={REPOSITORY_URL}>
              <button
                type="button"
                className="settings-button"
                onClick={() => openUrl(REPOSITORY_URL).catch((error) => showError("Could not open the link", error))}
              >
                Open on GitHub
              </button>
            </Row>
          </>
        );
    }
  };

  return (
    <div
      className="settings-backdrop"
      data-ui-overlay="true"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
        <nav className="settings-nav">
          <h2>Settings</h2>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? "is-active" : ""}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <header className="settings-header">
            <h2>{SECTIONS.find((item) => item.id === section)?.label}</h2>
            <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings" autoFocus>
              <X size={18} />
            </button>
          </header>
          <div className="settings-body">{renderSection()}</div>
        </div>
      </div>
    </div>
  );
}
