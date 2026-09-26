import { useEffect, useState } from "react";
import { parseDistanceInput, scaleLabel, type Units } from "../utils/format";

interface Props {
  mm: number;
  units: Units;
  minMm: number;
  onChange: (mm: number) => void;
}

/**
 * A typed distance, bidirectionally in sync with whatever else sets the same
 * focus distance (the lens barrel's ring, zone-focus presets, Live View...).
 * Local text state while focused so reformatting doesn't fight the user's
 * typing; re-syncs from `mm` once the field is blurred.
 */
export default function DistanceInput({ mm, units, minMm, onChange }: Props) {
  const [text, setText] = useState(() => (Number.isFinite(mm) ? scaleLabel(mm, units) : ""));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(Number.isFinite(mm) ? scaleLabel(mm, units) : "");
  }, [mm, units, editing]);

  return (
    <label className="field field-narrow">
      <span>Focus distance ({units === "metric" ? "m" : "ft"})</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={Number.isFinite(mm) ? undefined : "∞"}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const parsed = parseDistanceInput(next, units);
          if (parsed !== null) onChange(Math.max(parsed, minMm));
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
