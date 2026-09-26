// Feature flags for capability-gated work: experimental live-camera, sensor,
// 3D and audio/haptics features must ship behind a flag so the core simulator
// never depends on them (see RANGEFINDER_MASTER_PLAN.md, "Non-negotiable
// operating protocol"). Register a flag here rather than inventing a one-off
// boolean prop.

export interface FeatureFlags {
  /** Phone-camera live overlay (framelines, metering, focus/DOF card). */
  liveView: boolean;
  /** Film stock selection and the develop pipeline. Already shipped. */
  filmMode: boolean;
  /** DeviceMotion/DeviceOrientation-driven features (e.g. hand-stability trainer). */
  motionSensors: boolean;
  /** Haptic feedback paired with the existing mechanical sounds. */
  audioHaptics: boolean;
  /** The lazy-loaded 3D camera/lens renderer. Not implemented. */
  threeD: boolean;
  /** Lens character (Lens DNA, Flare Lab) beyond the geometric aperture model. */
  experimentalLensCharacter: boolean;
}

export const FLAGS: FeatureFlags = {
  liveView: true,
  filmMode: true,
  motionSensors: true,
  audioHaptics: false,
  threeD: false,
  experimentalLensCharacter: false,
};
