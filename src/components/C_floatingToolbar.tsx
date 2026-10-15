import { Fragment, useRef, useState } from "react";
import {
  Download,
  FileImage,
  FilePlus,
  FileText,
  FolderOpen,
  FolderPlus,
  Image,
  Save,
  SaveAll,
  SunMoon,
  type LucideIcon,
} from "lucide-react";

type Position = {
  x: number;
  y: number;
};

type DragState = {
  pointerStart: Position;
  positionStart: Position;
};

type ToolbarAction = {
  label: string;
  type: "new" | "open" | "save" | "save-as" | "import" | "link-image" | "link-doc" | "text" | "theme" | "export";
  disabled?: boolean;
  dividerAfter?: boolean;
};

type FloatingToolbarProps = {
  onNewBoard: () => void;
  onOpenBoard: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onImport: () => void;
  onAddText: () => void;
  onToggleTheme: () => void;
  position?: Position;
  onPositionChange?: (next: Position) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function ToolbarIcon({ type }: { type: ToolbarAction["type"] }) {
  const iconMap: Record<ToolbarAction["type"], LucideIcon> = {
    new: FolderPlus,
    open: FolderOpen,
    save: Save,
    "save-as": SaveAll,
    import: Image,
    "link-image": FileImage,
    "link-doc": FilePlus,
    text: FileText,
    theme: SunMoon,
    export: Download,
  };

  const Icon = iconMap[type];

  return <Icon size={18} strokeWidth={2} aria-hidden="true" />;
}

export default function FloatingToolbar({
  onNewBoard,
  onOpenBoard,
  onSave,
  onSaveAs,
  onImport,
  onAddText,
  onToggleTheme,
  position,
  onPositionChange,
}: FloatingToolbarProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [internalPosition, setInternalPosition] = useState<Position>({ x: 24, y: 24 });
  const resolvedPosition = position ?? internalPosition;

  const updatePosition = (next: Position) => {
    if (onPositionChange) {
      onPositionChange(next);
      return;
    }

    setInternalPosition(next);
  };

  const toolbarItems: ToolbarAction[] = [
    { label: "New board (Ctrl+N)", type: "new" },
    { label: "Open board (Ctrl+O)", type: "open" },
    { label: "Save board (Ctrl+S)", type: "save" },
    { label: "Save board as (Ctrl+Shift+S)", type: "save-as", dividerAfter: true },
    { label: "Import image", type: "import" },
    { label: "Link image", type: "link-image", disabled: true },
    { label: "Link document", type: "link-doc", disabled: true },
    { label: "Add text box", type: "text" },
    { label: "Theme", type: "theme" },
    { label: "Export board", type: "export", disabled: true },
  ];

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) {
      return;
    }

    const panel = panelRef.current;
    const canvas = panel?.closest(".moodboard-canvas") as HTMLDivElement | null;

    if (!panel || !canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const deltaX = event.clientX - dragStateRef.current.pointerStart.x;
    const deltaY = event.clientY - dragStateRef.current.pointerStart.y;

    const nextX = clamp(
      dragStateRef.current.positionStart.x + deltaX,
      16,
      bounds.width - panel.offsetWidth - 16,
    );
    const nextY = clamp(
      dragStateRef.current.positionStart.y + deltaY,
      16,
      bounds.height - panel.offsetHeight - 16,
    );

    updatePosition({ x: nextX, y: nextY });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (!target.closest("[data-drag-handle='true']")) {
      return;
    }

    const panel = panelRef.current;
    const canvas = panel?.closest(".moodboard-canvas") as HTMLDivElement | null;

    if (!panel || !canvas) {
      return;
    }

    dragStateRef.current = {
      pointerStart: { x: event.clientX, y: event.clientY },
      positionStart: resolvedPosition,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleButtonClick = (item: ToolbarAction) => {
    if (item.disabled) {
      return;
    }

    const actions: Partial<Record<ToolbarAction["type"], () => void>> = {
      new: onNewBoard,
      open: onOpenBoard,
      save: onSave,
      "save-as": onSaveAs,
      import: onImport,
      text: onAddText,
      theme: onToggleTheme,
    };

    actions[item.type]?.();
  };

  return (
    <div className="floating-toolbar-shell" style={{ left: resolvedPosition.x, top: resolvedPosition.y }}>
      <div
        ref={panelRef}
        className="floating-toolbar"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-label="Floating toolbar"
      >
        <div
          className="toolbar-handle"
          data-drag-handle="true"
          onPointerDown={handlePointerDown}
          aria-label="Drag toolbar"
          title="Drag toolbar"
        >
          <span className="toolbar-grip" aria-hidden="true" />
        </div>

        {toolbarItems.map((item) => (
          <Fragment key={item.type}>
            <button
              type="button"
              className={`toolbar-button${item.disabled ? " is-disabled" : ""}`}
              aria-label={item.label}
              title={item.label}
              disabled={item.disabled}
              onClick={() => handleButtonClick(item)}
            >
              <ToolbarIcon type={item.type} />
            </button>
            {item.dividerAfter && <span className="toolbar-divider" aria-hidden="true" />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
