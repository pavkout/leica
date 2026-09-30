import { findBody } from "../../data/gear";
import { playShutter } from "../../audio/sounds";
import { shutterVoiceFor } from "../../audio/voices";

/** Plays that camera's own shutter (its mechanism's voice) at 1/125 s. */
export function hearShutter(bodyId: string) {
  const body = findBody(bodyId);
  if (body) playShutter(1 / 125, shutterVoiceFor(body, 1 / 125));
}
