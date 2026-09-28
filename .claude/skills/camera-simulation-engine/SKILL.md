---
name: camera-simulation-engine
description: "Use this skill when implementing camera, lens, exposure, depth-of-field, focus, field-of-view, motion-blur, long-exposure, rangefinder, optical, or photographic simulation logic. Prefer physically meaningful models, reusable TypeScript, and testable mathematics."
---

# Camera Simulation Engine

Act as a senior camera simulation engineer, computational photography engineer, optics-aware software engineer, and photography systems architect.

Use this skill whenever implementing mathematical or visual simulation of camera behavior.

The goal is to build photographic simulations that are technically meaningful rather than arbitrary visual effects.

## Core Principles

Prioritize:

- physically meaningful models
- photographic correctness
- deterministic calculations
- reusable simulation functions
- separation of simulation logic from UI
- testability
- explicit units
- clearly documented approximations
- graceful simplification when exact physics is unnecessary

Never fake a photographic relationship when a reasonable mathematical model can be used.

When a simulation is intentionally simplified, document:

- what is simplified
- why
- what the approximation represents
- what it does not represent

## Architecture

Keep simulation logic independent from React, Three.js, or rendering code whenever practical.

Prefer architecture such as:

src/
  simulation/
    exposure/
    optics/
    depth-of-field/
    field-of-view/
    motion/
    rangefinder/
    film/
    lens/
    units/

UI components should consume simulation results.

They should not contain the core photographic mathematics.

Prefer pure TypeScript functions for simulation calculations.

## Units

Always define units explicitly.

Typical units may include:

- focal length: millimeters
- aperture: f-number
- focus distance: meters or millimeters
- subject distance: meters
- sensor dimensions: millimeters
- shutter time: seconds
- circle of confusion: millimeters
- exposure value: EV
- angle: degrees or radians

Never mix units implicitly.

Create conversion helpers when necessary.

## Exposure

Model photographic exposure relationships using real stop-based behavior.

A one-stop difference represents a factor of two.

The classic exposure-value relationship at ISO 100 is:

EV100 = log2(N² / t)

where:

- N = aperture f-number
- t = exposure time in seconds

For ISO adjustment, use an appropriate ISO-aware exposure relationship.

Do not model exposure using arbitrary percentage sliders.

A one-stop change should produce mathematically consistent behavior.

## Aperture

The aperture f-number is:

N = focal length / entrance pupil diameter

Aperture affects:

- exposure
- depth of field
- diffraction
- bokeh geometry
- optical rendering

When aperture changes by a full stop, exposure changes by approximately 2x.

Common full-stop sequence:

1
1.4
2
2.8
4
5.6
8
11
16
22

Treat intermediate values appropriately.

## Shutter Speed

Represent shutter time internally in seconds where practical.

Examples:

1/1000 = 0.001
1/125 = 0.008
1 second = 1
30 seconds = 30

Shutter speed affects:

- exposure
- subject motion
- camera motion
- long-exposure effects

Do not visually blur an entire image identically when simulating subject motion unless the simplified model explicitly requires it.

## ISO

ISO affects the effective exposure response of the imaging system.

For digital simulation, distinguish conceptually between:

- light captured
- signal amplification
- noise
- dynamic range

Changing ISO does not change:

- depth of field
- field of view
- perspective
- amount of light entering the lens

Avoid representing high ISO as merely adding uniform random grain.

If noise simulation is used, document that it is an approximation.

## Field of View

For rectilinear lenses, field of view can be calculated using:

FOV = 2 × atan(sensorDimension / (2 × focalLength))

Calculate separately when necessary for:

- horizontal FOV
- vertical FOV
- diagonal FOV

Do not hardcode visual zoom levels when the actual sensor/film dimensions and focal length are available.

For 35mm full-frame photography, nominal frame dimensions are approximately:

36 × 24 mm

Use exact dimensions only when appropriate for the simulated camera.

## Perspective

Perspective is governed primarily by camera position relative to the scene.

Changing focal length while keeping camera position fixed changes framing but not geometric perspective.

Changing focal length and then moving the camera to maintain similar framing changes perspective because the camera position changed.

The simulator should teach this distinction correctly.

## Depth of Field

Depth of field calculations should consider:

- focal length
- aperture
- focus distance
- format dimensions
- circle of confusion

A typical hyperfocal relationship is:

H = f² / (N × c) + f

where:

- H = hyperfocal distance
- f = focal length
- N = aperture
- c = circle of confusion

Ensure consistent units.

Near and far depth-of-field limits should derive from established optical relationships.

Handle the far limit approaching infinity correctly.

Do not approximate depth of field solely through CSS blur intensity.

Use the optical model to determine the intended visual effect.

## Circle of Confusion

Circle of confusion is a viewing convention, not a universal physical constant.

When using it:

- define the chosen value
- associate it with the simulated format
- keep it configurable when useful
- document the assumption

Do not pretend one value is universally correct.

## Focus

Represent focus distance as an explicit model parameter.

Objects at different distances should have different defocus behavior.

When practical, compute relative defocus from optical relationships instead of a binary focused/blurred state.

For educational simulations, communicate:

- focus plane
- near acceptable sharpness
- far acceptable sharpness

## Hyperfocal Distance

Calculate hyperfocal distance mathematically.

The simulation should demonstrate that focusing at or near the hyperfocal distance can maximize acceptable depth of field for a chosen optical assumption.

Do not communicate that all distances become perfectly sharp.

## Motion Blur

Separate:

- camera motion
- subject motion

A useful motion model may consider:

- shutter duration
- subject velocity
- movement direction
- image scale
- focal length
- camera angular movement

For simplified experiences, document the simplification.

## Camera Shake

Camera shake should depend at least conceptually on:

- shutter duration
- focal length
- angular camera motion

Do not create a universal binary threshold such as:

1/focalLength = sharp
slower = blurry

The reciprocal guideline may be used as an educational reference, but not as a hard physical boundary.

## Long Exposure

Long-exposure simulation may include:

- moving lights
- moving people
- traffic trails
- clouds
- water
- stars
- camera movement

Integrate movement over exposure time conceptually.

Whenever practical, visual output should reflect accumulation across time rather than simply increasing blur radius.

## Diffraction

Diffraction is linked to aperture and wavelength.

For advanced simulation, an Airy-disk approximation may be useful:

d ≈ 2.44 × λ × N

where:

- d = Airy disk diameter
- λ = wavelength
- N = aperture

Only use advanced optical calculations when they improve the educational or simulation goal.

Avoid pseudo-precision.

## Bokeh and Defocus

Bokeh is not simply Gaussian blur.

A richer approximation may consider:

- aperture shape
- blur-circle size
- highlight structure
- optical aberrations
- distance from focus plane

However, prioritize performance and educational value.

Do not claim a simplified effect reproduces the exact rendering of a real Leica lens.

## Lens Character

Separate measurable or physically motivated properties from subjective lens character.

Possible simulation inputs may include:

- vignetting
- contrast
- flare
- distortion
- chromatic aberration
- sharpness distribution
- field curvature
- bokeh characteristics
- transmission

Do not assign invented values to historical Leica lenses.

Lens-specific profiles should require documented source data or an explicitly labelled artistic approximation.

## Vignetting

If using a physical approximation, the cosine-fourth law may be relevant for certain optical contexts.

Real lenses may deviate because of:

- optical design
- mechanical vignetting
- pupil behavior
- corrections

Do not assume all vignetting follows one exact formula.

## Distortion

When implemented, distinguish between:

- barrel distortion
- pincushion distortion
- moustache/wave distortion

Use lens-specific distortion only when source data is available.

Otherwise use generic demonstrations labelled as such.

## Film Simulation

Do not model film as:

image + random noise.

A richer model may conceptually include:

- grain size
- grain distribution
- contrast curve
- highlight response
- color response
- halation
- development
- scanning characteristics

For educational simulations, prioritize understandable behavior over attempting perfect emulation.

## Rangefinder Simulation

Rangefinder simulation may involve:

- viewfinder scene
- central focusing patch
- horizontally displaced secondary image
- focus-dependent coincidence
- framelines
- parallax
- viewfinder magnification

As the focus control approaches the correct subject distance, the two images in the focusing patch should converge.

A useful abstraction is:

focus error
→ patch displacement
→ convergence at correct focus

The relationship should be smooth and deterministic.

Do not randomly move the patch.

## Parallax Simulation

The viewfinder and taking lens occupy different physical positions.

For close subjects, calculate or approximate the resulting framing offset.

The effect should increase at shorter subject distances.

If exact camera geometry is unavailable, use a documented educational approximation.

## Leica Rangefinder Behavior

When simulating a specific Leica camera:

- verify its viewfinder magnification
- verify frameline pairs
- verify minimum focusing behavior
- verify relevant camera geometry
- avoid assuming all Leica M models behave identically

Coordinate with the Leica photography knowledge skill for camera-specific facts.

## Rendering Strategy

Simulation logic and visual rendering should remain separate.

Example:

calculateDepthOfField()
→ returns physical/simulation values

renderer
→ translates those values into visual blur

calculateExposureDifference()
→ returns stop difference

renderer
→ maps stop difference into image brightness/tone

This allows the visual implementation to evolve without corrupting the photographic model.

## Performance

For interactive simulations:

- avoid recalculating expensive models unnecessarily
- cache deterministic values
- precompute lookup data when appropriate
- keep animation-loop allocations low
- use GPU rendering where beneficial
- avoid excessive full-resolution post-processing
- provide quality tiers for mobile hardware

Accuracy should not require poor performance.

## TypeScript Standards

Prefer strongly typed domain models.

Example concepts:

CameraParameters
LensParameters
ExposureSettings
FocusParameters
SensorFormat
DepthOfFieldResult
FieldOfViewResult
MotionParameters

Avoid large bags of untyped numbers.

Represent units clearly through naming or domain types.

## Testing

Simulation mathematics must have tests.

Test:

- known exposure relationships
- one-stop changes
- FOV calculations
- hyperfocal calculations
- depth-of-field limits
- unit conversions
- edge cases
- infinity behavior
- invalid values
- minimum distances

Use known reference cases where possible.

Floating-point calculations should use tolerances rather than strict equality when appropriate.

## Edge Cases

Handle:

- zero or negative distances
- invalid aperture
- zero focal length
- extremely long exposure
- infinity focus
- subject closer than minimum focus
- far DOF limit at infinity
- unsupported sensor dimensions
- invalid ISO
- missing lens information

Do not silently produce nonsensical values.

## Educational Mode

When simulation is being used to teach photography, expose meaningful intermediate values.

For example:

f/2
1/125
ISO 100

→ EV
→ focus distance
→ near DOF
→ far DOF
→ total DOF
→ field of view

This allows the application to explain why the visual result changes.

## Approximation Labels

Use terminology such as:

- physical calculation
- photographic approximation
- perceptual approximation
- artistic simulation

when useful.

Do not imply a browser simulation perfectly reproduces a real optical system.

## Collaboration With Other Skills

Use Leica-specific camera and photography knowledge from:

leica-photography-expert

Use historical context from:

leica-museum-curator

Use Three.js and rendering skills for visualization.

This skill owns the underlying simulation model, mathematics, and architecture.

## Product Standard

The user should be able to change a camera setting and see a result that makes photographic sense.

The simulator should teach cause and effect:

setting
→ physics
→ photographic result

Prefer a simplified correct model over a visually impressive but technically meaningless effect.
