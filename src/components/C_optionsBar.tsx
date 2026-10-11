type C_OptionsBarProps = {
  onDelete?: () => void;
  onCrop?: () => void;
};

export default function C_optionsBar({ onDelete, onCrop }: C_OptionsBarProps) {
  return (
    <div className="board-item-option-bar">
      <button
        type="button"
        className="option-button delete"
        aria-label="Delete item"
        onClick={onDelete}
      >
        ×
      </button>
      <button
        type="button"
        className="option-button crop"
        aria-label="Crop item"
        onClick={onCrop}
      >
        ✂
      </button>
    </div>
  );
}
