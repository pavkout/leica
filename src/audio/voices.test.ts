import { describe, expect, it } from "vitest";
import { BODIES, findBody } from "../data/gear";
import { SHUTTER_VOICE_PROVENANCE, shutterMechanism, shutterVoiceFor } from "./voices";

describe("shutterMechanism", () => {
  it("gives film Ms the cloth focal-plane shutter", () => {
    for (const id of ["m3", "m6", "m7", "mp", "m-a"]) expect(shutterMechanism(findBody(id))).toBe("cloth-focal-plane");
  });

  it("gives digital Ms, SL, CL and S the metal focal-plane shutter", () => {
    for (const id of ["m9", "m10", "m11", "sl3", "cl", "s3"]) expect(shutterMechanism(findBody(id))).toBe("metal-focal-plane");
  });

  it("gives the Q its leaf shutter", () => {
    for (const id of ["q2", "q3", "q3-43"]) expect(shutterMechanism(findBody(id))).toBe("leaf");
  });
});

describe("shutterVoiceFor", () => {
  it("returns a voice for every body in the catalogue", () => {
    for (const body of BODIES) expect(shutterVoiceFor(body).mechanism).toBe(shutterMechanism(body));
  });

  it("recocks with a motor only on metal focal-plane bodies", () => {
    expect(shutterVoiceFor(findBody("m6")).recock).toBeNull();
    expect(shutterVoiceFor(findBody("q3")).recock).toBeNull();
    expect(shutterVoiceFor(findBody("m11")).recock).not.toBeNull();
  });

  it("makes the leaf shutter the quietest", () => {
    const leaf = shutterVoiceFor(findBody("q3")).open.clickGain;
    expect(leaf).toBeLessThan(shutterVoiceFor(findBody("m6")).open.clickGain);
    expect(leaf).toBeLessThan(shutterVoiceFor(findBody("m11")).open.clickGain);
  });

  it("labels the sounds as illustrative", () => {
    expect(SHUTTER_VOICE_PROVENANCE.kind).toBe("illustrative");
  });
});
