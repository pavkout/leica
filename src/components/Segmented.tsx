interface Props<T extends string | number> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Keeps a figure with its unit ("4 s", "60 MP", "± 1 stop") on one line when a label wraps. */
const bindUnits = (label: string) => label.replace(/(\d|±) (?=\S)/g, "$1\u00a0");

export default function Segmented<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "seg seg-on" : "seg"}
          onClick={() => onChange(o.value)}
        >
          {bindUnits(o.label)}
        </button>
      ))}
    </div>
  );
}
