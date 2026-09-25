import { useEffect, useRef, useState, type ReactNode } from "react";

export interface PickerItem {
  id: string;
  name: string;
  group: string;
  meta: string;
  badge?: string;
  art: ReactNode;
}

interface Props {
  open: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function GearPicker({ open, title, items, selectedId, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const groups = ["All", ...new Set(items.map((i) => i.group))];
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the tab holding the current choice.
      const current = items.find((i) => i.id === selectedId);
      setFilter(current && groups.length > 2 ? current.group : "All");
      requestAnimationFrame(() => dialog.querySelector<HTMLElement>("[aria-pressed='true']")?.scrollIntoView({ block: "center" }));
    }
    if (!open && dialog.open) dialog.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = filter === "All" ? items : items.filter((i) => i.group === filter);

  return (
    <dialog
      ref={ref}
      className="picker"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes the sheet.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="picker-inner">
        <header className="picker-head">
          <h2>{title}</h2>
          <button type="button" className="picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {groups.length > 2 && (
          <div className="picker-tabs" role="tablist" aria-label="Filter">
            {groups.map((g) => (
              <button key={g} type="button" role="tab" aria-selected={filter === g} className={filter === g ? "tab tab-on" : "tab"} onClick={() => setFilter(g)}>
                {g}
              </button>
            ))}
          </div>
        )}
        <div className="picker-grid">
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              className="picker-card"
              aria-pressed={item.id === selectedId}
              onClick={() => {
                onSelect(item.id);
                onClose();
              }}
            >
              <span className="picker-art">{item.art}</span>
              <span className="picker-name">{item.name}</span>
              <span className="picker-meta">{item.meta}</span>
              {item.badge && <span className="picker-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
