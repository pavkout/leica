import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// `base` is relative so the build works on GitHub Pages or any sub-path.
// `npm run dev:phone` serves over HTTPS on the LAN with a self-signed cert:
// iOS Safari only exposes DeviceMotionEvent (and the camera) in a secure
// context, so a plain-HTTP LAN URL can't exercise the motion trainer.
// Workers are ES modules: the live depth worker (#37) loads the depth model with a dynamic import, which
// the default (IIFE) worker format can't split. Module workers are supported from iOS Safari 15.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "phone" ? [basicSsl()] : [])],
  worker: { format: "es" },
}));
