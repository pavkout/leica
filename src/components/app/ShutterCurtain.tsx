import { useCurtainPhase } from "./useRoute";

/**
 * The tool transition, drawn as a focal-plane shutter: the second curtain
 * runs across to cover the old tool, then the first curtain runs on to
 * uncover the new one. Decorative only; never intercepts input.
 */
export default function ShutterCurtain() {
  const phase = useCurtainPhase();
  if (phase === "idle") return null;
  return (
    <div className={`shutter-curtain shutter-${phase}`} aria-hidden="true">
      <span className="curtain-cloth" />
    </div>
  );
}
