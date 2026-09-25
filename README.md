# Rangefinder — depth of field studio

Depth of field, zone focusing and background blur for real Leica bodies and lenses.
Inspired by [jherr/depth-of-field](https://github.com/jherr/depth-of-field).

- **Shoot a roll:** load film (Portra 400, Ektar 100, Gold 200, CineStill 800T, Velvia 50, Tri-X, HP5, Delta 3200) or use a digital sensor (colour or Monochrom). Then meter (M6-style LEDs in the finder, or the M11's readout), set shutter and aperture, focus, and fire. Each frame is developed with the film's tone curve, colour, grain and halation. Mistakes show: over- and underexposure against the stock's latitude, lens vignetting, and camera shake at slow speeds. Frames land on a contact sheet (36 exposures on film) and can be downloaded.
- **Real photos:** three CC0 street photos by Fons Heijnsbroek (Wikimedia Commons), with depth maps from Depth Anything V2. You can also use your own photo: its depth is estimated in the browser (about 27 MB model, downloaded once; the photo never leaves the device). The photo is sliced by depth and each slice gets its physically correct blur, and bright points become aperture-shaped bokeh. Tap to focus.
- **Illustrated scene:** a WebGL dusk street where every object sits at a real distance. The blur uses an aperture-shaped kernel: rounded wide open, polygonal stopped down, and cat's-eye toward the corners on fast lenses. **Compare lenses** puts two lenses on a draggable split.
- **Sounds:** aperture clicks, the shutter-speed dial, the M shutter, the film advance lever and the rewind. All are synthesised with the Web Audio API and can be muted.
- **Rangefinder (M bodies):** the view through a 0.73× M finder with the lens's frameline pair (28/90, 35/135, 50/75), shifted for parallax at close range. The central patch superimposes the second image from a viewpoint 69.25 mm to the side (the M rangefinder base), so the double image merges only at the focus distance. It includes a 3× patch loupe and Leica's 1.4× magnifier. **Focus challenge** hides the subject at an unknown distance: focus by eye, take the shot, and see how close you got.
- **Real gear:** 24 bodies (M3 to M11-D, M film and digital, Q2/Q3, SL2/SL3, CL, S3) and 48 lenses including classics, each with a rendered illustration and a visual picker. Each M has its own finder magnification and frameline sets. M lenses are available on L-mount bodies through an adapter.
- **Lens barrel:** a focus ring you can drag. Rotation follows the helicoid extension, so the distance scale crowds toward ∞ just like on the real lens. DoF brackets are engraved for every full stop, and the aperture ring clicks in half stops.
- **Scene view:** a log distance axis from 15 cm to ∞, with a draggable subject and background and a blur-profile curve.
- **Sharpness standards:** the lens-scale standard (0.03 mm), a critical standard (diagonal ÷ 3000), or pixel-level (two pixels at the chosen resolution, including the M11/Q3/SL3 60/36/18 MP modes).
- **Also shown:** background blur as a share of the frame, magnification, angle of view, full-frame equivalent (including Q3 crop framings) and the diffraction limit.

```bash
npm install
npm run dev      # develop
npm test         # physics tests
npm run build    # static build in dist/ (relative base, works on GitHub Pages)
```

Film looks are approximations inspired by each stock; the names are trademarks of their owners. Lens specs come from public sources; check them against Leica's datasheets. Leica's datasheets don't list aperture-blade counts, so only lenses with a consistently published count (Noctilux-M 50 f/0.95 and APO-Summicron-M 50, both 11 blades) use their own. The rest use a generic rounded 9-blade iris.
This is an independent tool, not affiliated with Leica Camera AG.
