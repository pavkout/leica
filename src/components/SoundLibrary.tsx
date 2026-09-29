import { useState } from "react";
import { isMuted, playAdvance, playApertureClick, playDialClick, playMountClick, playRewind, playShutter, setMuted } from "../audio/sounds";
import { M_MECHANICAL_FASTEST_SEC, SHUTTER_VOICE_PROVENANCE, shutterMechanism, shutterVoiceFor, type ShutterMechanism } from "../audio/voices";
import { BODIES, formatShutter } from "../data/gear";

interface Props {
  /** Tell the app the sound setting changed (it shows it in MENU › Setup). */
  onMutedChange?: (muted: boolean) => void;
}

const SPEEDS = [1 / 1000, 1 / 60, 1 / 8, 1];

const MECHANISMS: { id: ShutterMechanism; title: string; how: string }[] = [
  { id: "cloth-focal-plane", title: "Cloth focal-plane shutter", how: "Two rubberised cloth curtains run sideways across the film: the first opens, the second follows after the exposure time. Soft and low." },
  { id: "metal-focal-plane", title: "Metal focal-plane shutter", how: "Metal blades run vertically across the sensor, then a motor recocks them: a crisper strike and a short whirr." },
  { id: "leaf", title: "Leaf shutter", how: "Thin blades in the lens itself open and close like an iris: almost silent, a small tick." },
  { id: "electronic", title: "Electronic shutter", how: "No curtain moves: the sensor starts and stops reading. Silent; a faint tick stands in so the press still registers." },
];

/** A small drawing of each mechanism, in the house line style. */
function Drawing({ id }: { id: ShutterMechanism }) {
  return (
    <svg viewBox="0 0 120 80" className="snd-draw" aria-hidden="true">
      <rect x="10" y="10" width="100" height="60" className="snd-gate" />
      {id === "cloth-focal-plane" && (
        <>
          <rect x="10" y="10" width="42" height="60" className="snd-curtain" />
          <rect x="68" y="10" width="42" height="60" className="snd-curtain snd-curtain-2" />
          <path d="M56 40h8" className="snd-arrow" />
        </>
      )}
      {id === "metal-focal-plane" &&
        [0, 1, 2, 3].map((i) => <rect key={i} x="10" y={10 + i * 8} width="100" height="7" className="snd-blade" />)}
      {id === "leaf" &&
        Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return <path key={i} d={`M60 40 L${60 + 26 * Math.cos(a)} ${40 + 26 * Math.sin(a)} A26 26 0 0 1 ${60 + 26 * Math.cos(a + 1.3)} ${40 + 26 * Math.sin(a + 1.3)} Z`} className="snd-leaf" />;
        })}
      {id === "electronic" && Array.from({ length: 6 }, (_, i) => <line key={i} x1="14" x2="106" y1={16 + i * 10} y2={16 + i * 10} className="snd-row" />)}
    </svg>
  );
}

/**
 * The camera's sounds, one by one: each shutter mechanism with the bodies that
 * use it, at several speeds, and the other mechanical sounds. All synthesised
 * (no recordings), and labelled so.
 */
export default function SoundLibrary({ onMutedChange }: Props) {
  const [muted, setMutedState] = useState(isMuted);
  const [playing, setPlaying] = useState<string | null>(null);

  function play(key: string, fn: () => void, ms = 400) {
    fn();
    setPlaying(key);
    window.setTimeout(() => setPlaying((p) => (p === key ? null : p)), ms);
  }

  const others: { key: string; label: string; what: string; fn: () => void }[] = [
    { key: "aperture", label: "Aperture ring", what: "One detent of the ring", fn: playApertureClick },
    { key: "dial", label: "Shutter-speed dial", what: "One detent of the top-plate dial", fn: playDialClick },
    { key: "mount", label: "Lens mount", what: "A bayonet turning home and locking", fn: playMountClick },
    { key: "advance", label: "Film advance", what: "The lever's ratchet, then its spring return", fn: playAdvance },
    { key: "rewind", label: "Rewind", what: "The crank winding the film back into the cassette", fn: playRewind },
  ];

  return (
    <section className="panel stage-sounds" aria-label="Sound library">
      {muted && (
        <div className="snd-muted">
          <p>Sounds are off.</p>
          <button
            type="button"
            className="btn btn-small btn-red"
            onClick={() => {
              setMuted(false);
              setMutedState(false);
              onMutedChange?.(false);
            }}
          >
            Turn sounds on
          </button>
        </div>
      )}

      <ul className="snd-mechs">
        {MECHANISMS.map((m) => {
          const bodies =
            m.id === "electronic"
              ? BODIES.filter((b) => b.family === "M digital" && b.shutter.fastest < M_MECHANICAL_FASTEST_SEC * 0.999)
              : BODIES.filter((b) => shutterMechanism(b) === m.id);
          const voiceFor = (t: number) => (m.id === "electronic" ? shutterVoiceFor({ family: "M digital" }, 1 / 8000) : shutterVoiceFor(bodies[0] ?? { family: "M film" }, t));
          const speeds = m.id === "electronic" ? [1 / 8000, 1 / 16000] : SPEEDS;
          return (
            <li key={m.id} className="snd-mech">
              <Drawing id={m.id} />
              <div className="snd-body">
                <h3>{m.title}</h3>
                <p className="muted">{m.how}</p>
                <p className="snd-bodies">
                  {m.id === "electronic" ? "Past 1/4000 s on " : ""}
                  {bodies.map((b) => b.name).join(", ") || "No body in the catalogue"}
                </p>
                <div className="snd-play">
                  {speeds.map((t) => {
                    const key = `${m.id}-${t}`;
                    return (
                      <button key={key} type="button" className={`btn btn-small${playing === key ? " snd-on" : ""}`} disabled={muted} onClick={() => play(key, () => playShutter(t, voiceFor(t)), Math.min(t, 2) * 1000 + 400)}>
                        ▶ {formatShutter(t)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="snd-h">Around the camera</h3>
      <ul className="snd-others">
        {others.map((o) => (
          <li key={o.key}>
            <button type="button" className={`snd-other${playing === o.key ? " snd-on" : ""}`} disabled={muted} onClick={() => play(o.key, o.fn, o.key === "rewind" ? 2000 : 700)}>
              <span className="snd-other-label">▶ {o.label}</span>
              <span className="muted small">{o.what}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">Synthesised in this browser, not recorded from real cameras. {SHUTTER_VOICE_PROVENANCE.notes}</p>
    </section>
  );
}
