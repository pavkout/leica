# Rangefinder — depth of field studio

Depth of field, zone focusing, exposure practice and a real-camera shooting companion for real Leica bodies and lenses.
Inspired by [jherr/depth-of-field](https://github.com/jherr/depth-of-field).

## Core simulator

- **Shoot a roll:** load film (Portra 400, Ektar 100, Gold 200, CineStill 800T, Velvia 50, Tri-X, HP5, Delta 3200) or use a digital sensor (colour or Monochrom). Then meter (M6-style LEDs in the finder, or the M11's readout), set shutter and aperture, focus, and fire. Each frame is developed with the film's tone curve, colour, grain and halation. Mistakes show: over- and underexposure against the stock's latitude, lens vignetting, and camera shake at slow speeds. Frames land on a contact sheet (36 exposures on film) and can be downloaded, exported as CSV/JSON, or annotated with a note — and they now survive a reload (stored in the browser's IndexedDB, per medium: film roll and digital card are kept separate).
- **Real photos:** three CC0 street photos by Fons Heijnsbroek (Wikimedia Commons), with depth maps from Depth Anything V2. You can also use your own photo: its depth is estimated in the browser (about 27 MB model, downloaded once; the photo never leaves the device). The photo is sliced by depth and each slice gets its physically correct blur, and bright points become aperture-shaped bokeh. Tap to focus.
- **Illustrated scene:** a WebGL dusk street where every object sits at a real distance. The blur uses an aperture-shaped kernel: rounded wide open, polygonal stopped down, and cat's-eye toward the corners on fast lenses. **Compare lenses** puts two lenses on a draggable split.
- **Sounds:** aperture clicks, the shutter-speed dial, the M shutter, the film advance lever and the rewind. All are synthesised with the Web Audio API and can be muted.
- **Rangefinder (M bodies):** the view through a 0.73× M finder with the lens's frameline pair (28/90, 35/135, 50/75), shifted for parallax at close range. The central patch superimposes the second image from a viewpoint 69.25 mm to the side (the M rangefinder base), so the double image merges only at the focus distance. It includes a 3× patch loupe and Leica's 1.4× magnifier, and a **Full screen** button for a minimal-chrome, eye-to-finder view. **Focus challenge** hides the subject at an unknown distance: focus by eye, take the shot, and see how close you got.
- **Zone focus:** one-tap **2 m street** / **3 m street** / **hyperfocal** presets on the lens barrel, so you can read the near/far band and the engraved distance scale and copy the numbers straight to a real lens.
- **Real gear:** 24 bodies (M3 to M11-D, M film and digital, Q2/Q3, SL2/SL3, CL, S3) and 48 lenses including classics, each with a rendered illustration and a visual picker. Each M has its own finder magnification and frameline sets. M lenses are available on L-mount bodies through an adapter.
- **Lens barrel:** a focus ring you can drag. Rotation follows the helicoid extension, so the distance scale crowds toward ∞ just like on the real lens. DoF brackets are engraved for every full stop, and the aperture ring clicks in half stops.
- **Scene view:** a log distance axis from 15 cm to ∞, with a draggable subject and background and a blur-profile curve.
- **Sharpness standards:** the lens-scale standard (0.03 mm), a critical standard (diagonal ÷ 3000), or pixel-level (two pixels at the chosen resolution, including the M11/Q3/SL3 60/36/18 MP modes).
- **Also shown:** background blur as a share of the frame, magnification, angle of view, full-frame equivalent (including Q3 crop framings) and the diffraction limit.

## Practice and shooting tools

- **My Leica Bag:** star any body, lens or film to pin it to a "My Gear" tab at the front of its picker. Your last-used body, lens, aperture, focus distance, film/ISO and exposure mode are restored automatically on reload.
- **Sunny 16 trainer:** a scenario picked from the standard EV guide (bright sun through night street); pick an aperture and shutter for a correct exposure, check yourself against three tolerance levels, and see which other combinations would also have worked. Scored with the exact same exposure equation as the rest of the app.
- **Intent assistant ("What do you want?"):** pick a goal — freeze motion, shallow background, maximum depth, or street/zone focus — and get a deterministic recommended aperture/shutter (no model, just the same constraint math), with alternatives and the option to lock either parameter and let the other adapt.
- **Live View (alpha):** point your phone or webcam at a real scene and get a live overlay: an approximate frameline for the selected lens (labelled as an estimate — a browser can't read a real M lens's actual angle of view), a reactive DOF/exposure shoot card, and a shutter button that captures the real frame onto your roll or card (tagged "Live View" in its caption, so it's never confused with a simulated render). Scene brightness is set manually from the same EV-guide presets as the Sunny 16 trainer, because a browser can't read a camera's real shutter/ISO/gain reliably across platforms — pretending otherwise would just be a more convincing-looking guess.

```bash
npm install
npm run dev        # develop
npm test           # unit tests (physics, exposure, catalog, persistence, ~126 tests)
npm run typecheck  # tsc -b
npm run lint        # eslint
npm run build       # static build in dist/ (relative base, works on GitHub Pages)
```

## A 2-minute walkthrough

1. **Pick your gear.** Camera & lens panel → tap the camera, choose the **M11**; tap the lens, choose a 50 mm Summilux. Notice the star icon on any card — tap it to pin it to "My Gear" for next time.
2. **Feel the depth of field.** Drag the aperture ring open to f/1.4, then closed to f/8 — watch the simulated photo's background blur change and the Readouts panel's near/far numbers move with it.
3. **Zone focus like a real M.** In the lens panel, tap **2 m street**, then **Hyperfocal** — the near/far band above and the engraved distance scale on the barrel show exactly what you'd dial in on a real lens.
4. **Look through the finder.** Scroll to the Rangefinder panel, drag across the image until the ghosted patch merges into one — that's focus. Tap **Full screen** for the eye-to-finder view, or **Focus challenge** to test yourself against a hidden distance.
5. **Practice metering without a meter.** In the Sunny 16 trainer, read the scene ("Hazy sun, soft-edged shadows"), pick an aperture and shutter, and hit **Check exposure**.
6. **Ask the assistant.** In "What do you want?", tap **Shallow background** — see the recommended wide-open aperture and its matching shutter, then tap **Use this** to apply it to the simulator.
7. **Shoot a frame.** Press the shutter release — the frame lands on the contact sheet, developed with the loaded film's look. Reload the page: it's still there.
8. **Go live.** Tap **Live** (needs camera permission), point your device at the room, and watch the shoot card update in real time as you turn the aperture/focus ring. Press the on-screen shutter to capture a real frame onto the same roll.

No step needs a network connection except the very first page load (and, if you use it, the one-time ~27 MB depth-estimation model for uploaded photos).

Film looks are approximations inspired by each stock; the names are trademarks of their owners. Lens specs come from public sources; check them against Leica's datasheets. Leica's datasheets don't list aperture-blade counts, so only lenses with a consistently published count (Noctilux-M 50 f/0.95 and APO-Summicron-M 50, both 11 blades) use their own. The rest use a generic rounded 9-blade iris. Live View's framing overlay and scene-brightness presets are explicitly labelled as estimates, not measurements — see `docs/rangefinder-master-plan.md` for the full provenance notes.
This is an independent tool, not affiliated with Leica Camera AG.
