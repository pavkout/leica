import { SAMPLE_SCENES } from "../preview/photoScene";
import { formatDistance, type Units } from "../utils/format";
import Segmented from "./Segmented";

export const LIGHT_LEVELS = [
  { ev100: 4, label: "Night" },
  { ev100: 8, label: "Indoors" },
  { ev100: 12, label: "Overcast" },
  { ev100: 15, label: "Sun" },
];

interface Props {
  sceneId: string;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
  status: { message: string; fraction: number | null; error?: boolean } | null;
  hasUpload: boolean;
  /** Controls for an uploaded photo. */
  upload?: { distanceM: number; ev100: number; onDistance: (m: number) => void; onLight: (ev: number) => void };
  units: Units;
}

// Log-scale slider positions for the calibration distance, 0.5–30 m.
const toSlider = (m: number) => Math.log(m / 0.5) / Math.log(60);
const fromSlider = (t: number) => 0.5 * 60 ** t;

export default function ScenePicker({ sceneId, onSelect, onUpload, status, hasUpload, upload, units }: Props) {
  return (
    <div className="scenes">
      <div className="scene-strip" role="radiogroup" aria-label="Scene">
        <button type="button" role="radio" aria-checked={sceneId === "street"} className="scene-chip" onClick={() => onSelect("street")}>
          <span className="scene-thumb scene-thumb-street" aria-hidden="true" />
          <span>Night street (illustrated)</span>
        </button>
        {SAMPLE_SCENES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={sceneId === s.id} className="scene-chip" onClick={() => onSelect(s.id)}>
            <img className="scene-thumb" src={s.image} alt="" loading="lazy" />
            <span>{s.name}</span>
          </button>
        ))}
        {hasUpload && (
          <button type="button" role="radio" aria-checked={sceneId === "upload"} className="scene-chip" onClick={() => onSelect("upload")}>
            <span className="scene-thumb scene-thumb-upload" aria-hidden="true">✓</span>
            <span>Your photo</span>
          </button>
        )}
        <label className="scene-chip scene-upload">
          <span className="scene-thumb scene-thumb-upload" aria-hidden="true">+</span>
          <span>Use your photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {status && (
        <div className={status.error ? "scene-status warn-text" : "scene-status"} role="status">
          <span>{status.message}</span>
          {status.fraction !== null && (
            <span className="progress" aria-hidden="true">
              <i style={{ width: `${Math.round(status.fraction * 100)}%` }} />
            </span>
          )}
        </div>
      )}

      {upload && sceneId === "upload" && (
        <div className="upload-controls">
          <label className="field">
            <span>Distance to the point you tapped: {formatDistance(upload.distanceM * 1000, units)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={toSlider(upload.distanceM)}
              onChange={(e) => upload.onDistance(Math.round(fromSlider(Number(e.target.value)) * 10) / 10)}
            />
          </label>
          <div className="field">
            <span>Light when you took it</span>
            <Segmented
              label="Light level"
              value={upload.ev100}
              onChange={upload.onLight}
              options={LIGHT_LEVELS.map((l) => ({ value: l.ev100, label: l.label }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
