# Rangefinder — depth of field studio

Depth of field, zone focusing and background blur for real Leica bodies and lenses.
Inspired by [jherr/depth-of-field](https://github.com/jherr/depth-of-field).

- **Real gear:** M11, M11 Monochrom, M10-R, M10, M6, Q3, Q3 43, SL3, CL and S3, each with its own lens catalog. M lenses are available on L-mount bodies through an adapter.
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

Lens specs come from public sources; check them against Leica's datasheets.
This is an independent tool, not affiliated with Leica Camera AG.
