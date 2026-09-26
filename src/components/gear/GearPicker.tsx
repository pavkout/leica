import { useEffect, useRef, useState, type ReactNode } from "react";

export interface PickerItem {
  id: string;
  name: string;
  group: string;
  meta: string;
  badge?: string;
  art: ReactNode;
}

const MY_GEAR = "My Gear";

interface Props {
  open: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Ids pinned to "My Gear" — adds a filter tab, sorts them first, and shows a star toggle per card. */
  saved?: Set<string>;
  onToggleSaved?: (id: string) => void;
}

export default function GearPicker({ open, title, items, selectedId, onSelect, onClose, saved, onToggleSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const groups = ["All", ...(saved && saved.size > 0 ? [MY_GEAR] : []), ...new Set(items.map((i) => i.group))];
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

  const filtered = filter === "All" ? items : filter === MY_GEAR ? items.filter((i) => saved?.has(i.id)) : items.filter((i) => i.group === filter);
  // Within "All", pinned items lead — "every selector offers My Gear first".
  const shown =
    filter === "All" && saved && saved.size > 0 ? [...filtered].sort((a, b) => Number(saved.has(b.id)) - Number(saved.has(a.id))) : filtered;

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
            <div key={item.id} className="picker-card-wrap">
              <button
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
              </button>
              {item.badge && <span className="picker-badge">{item.badge}</span>}
              {onToggleSaved && (
                <button
                  type="button"
                  className="picker-star"
                  aria-pressed={saved?.has(item.id) ?? false}
                  aria-label={saved?.has(item.id) ? `Remove ${item.name} from My Gear` : `Add ${item.name} to My Gear`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSaved(item.id);
                  }}
                >
                  ★
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </dialog>
  );
}
