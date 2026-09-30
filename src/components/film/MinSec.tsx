import { useEffect, useRef, useState } from "react";
import { clock, parseMinSec } from "../../physics/devTimer";

/** A time field in minutes and seconds ("8:30"), kept as seconds. */
export function MinSec({ label, value, onChange }: { label: string; value: number; onChange: (sec: number) => void }) {
  const [text, setText] = useState(clock(value));
  const editing = useRef(false);
  // Follow outside changes, but never rewrite what's being typed.
  useEffect(() => {
    if (!editing.current) setText(clock(value));
  }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder="8:30"
        onChange={(e) => {
          setText(e.target.value);
          const v = parseMinSec(e.target.value);
          if (v !== null) onChange(v);
        }}
        onFocus={() => (editing.current = true)}
        onBlur={() => {
          editing.current = false;
          setText(clock(value));
        }}
      />
    </label>
  );
}
