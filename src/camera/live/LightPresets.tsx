/** Light levels (EV at ISO 100) from the standard exposure guide, as used by the Sunny 16 trainer. */
const PRESETS: { ev: number; label: string }[] = [
  { ev: 15, label: "Bright sun" },
  { ev: 14, label: "Hazy sun" },
  { ev: 13, label: "Cloudy bright" },
  { ev: 12, label: "Overcast or open shade" },
  { ev: 10, label: "Heavy overcast, sunset" },
  { ev: 8, label: "Bright interior" },
  { ev: 6, label: "Home interior" },
  { ev: 5, label: "Night street" },
];

/**
 * FN on the live camera: the scene's light, for when the browser doesn't report the phone's exposure (the
 * meter then assumes it). Clearly an estimate.
 */
export default function LightPresets({ value, onChange }: { value: number; onChange: (ev: number) => void }) {
  return (
    <div className="light-presets">
      <p className="muted small">When your phone doesn&apos;t report its exposure, the meter assumes this light. It&apos;s an estimate.</p>
      <div className="light-list" role="radiogroup" aria-label="Scene light">
        {PRESETS.map((p) => (
          <button key={p.ev} type="button" role="radio" aria-checked={p.ev === value} className={`light-item${p.ev === value ? " light-item-on" : ""}`} onClick={() => onChange(p.ev)}>
            <span>{p.label}</span>
            <span className="light-ev">EV {p.ev}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
