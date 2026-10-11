import { useRef, useState } from "react";
import {
  Download,
  FileImage,
  FilePlus,
  FileText,
  Image,
  Save,
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
  type: "import" | "link-image" | "link-doc" | "text" | "theme" | "save" | "export";
  disabled?: boolean;
};

type FloatingToolbarProps = {
  onImport: (files: FileList) => void;
  onAddText: () => void;
  onToggleTheme: () => void;
  onSave: () => void;
  position?: Position;
  onPositionChange?: (next: Position) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function ToolbarIcon({ type }: { type: ToolbarAction["type"] }) {
  const iconMap: Record<ToolbarAction["type"], LucideIcon> = {
    import: Image,
    "link-image": FileImage,
    "link-doc": FilePlus,
    text: FileText,
    theme: SunMoon,
    save: Save,
    export: Download,
  };

  const Icon = iconMap[type];

  return <Icon size={18} strokeWidth={2} aria-hidden="true" />;
}

export default function FloatingToolbar({
  onImport,
  onAddText,
  onToggleTheme,
  onSave,
  position,
  onPositionChange,
}: FloatingToolbarProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    { label: "Import image", type: "import" },
    { label: "Link image", type: "link-image", disabled: true },
    { label: "Link document", type: "link-doc", disabled: true },
    { label: "Add text box", type: "text" },
    { label: "Theme", type: "theme" },
    { label: "Save board", type: "save" },
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

    if (item.type === "import") {
      fileInputRef.current?.click();
      return;
    }

    if (item.type === "text") {
      onAddText();
      return;
    }

    if (item.type === "theme") {
      onToggleTheme();
      return;
    }

    if (item.type === "save") {
      onSave();
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      onImport(files);
    }

    event.target.value = "";
  };

  return (
    <div className="floating-toolbar-shell" style={{ left: resolvedPosition.x, top: resolvedPosition.y }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden-file-input"
        onChange={handleFileSelection}
      />

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
          <button
            key={item.label}
            type="button"
            className={`toolbar-button${item.disabled ? " is-disabled" : ""}`}
            aria-label={item.label}
            title={item.label}
            disabled={item.disabled}
            onClick={() => handleButtonClick(item)}
          >
            <ToolbarIcon type={item.type} />
          </button>
        ))}
      </div>
    </div>
  );
}
