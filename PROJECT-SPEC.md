# Earth Tracker — Build Specification

A browser-based interactive Earth visualizer and geospatial analysis tool. It renders a live, explorable globe/map with meteorological, oceanographic, astronomical and satellite-tracking layers, and provides per-location analytical readouts.

This document is the complete build brief. It is self-contained: it assumes no prior context, no existing codebase, and no particular technology stack. **Technology selection is deliberately left to the implementer.** Where this document constrains implementation, it constrains *capabilities and invariants*, never libraries.

---

## 0. How to use this document

Every feature below is specified in three parts:

- **Behavior** — what the user observes or does.
- **Acceptance check** — the concrete, runnable or observable thing that proves it works.
- **Known-good values** — measured reference numbers, where available, so correctness can be validated without guesswork.

**Process requirement (first-class, non-negotiable):**

> No feature may be marked complete until its acceptance check has actually been run and its output recorded.

This rule exists because the predecessor project accumulated extensive documentation marking features "complete" that had never been written at all — entire subsystems (orbital propagation, telemetry panels, live video) were described in detail across multiple documents while the corresponding source files did not exist. Prose is not evidence. A recorded check result is.

---

## 1. Rendering and layer system invariants — **priority one**

This section is first because it is the highest-risk area and the primary reason the predecessor was abandoned. Failures here are not cosmetic; they make the product feel broken regardless of feature count.

### 1.1 Single compositing path

**Requirement.** The base map, all raster overlays, all vector/polygon shading, and all GPU-animated content must be composited through **one** rendering and reprojection pipeline.

**Rationale.** Stacking two independent render engines on the same viewport makes z-ordering structurally unsolvable: each engine controls its own internal ordering but neither can interleave with the other. The predecessor did exactly this and produced two distinct classes of defect — animated layers permanently pinned above all static layers regardless of user intent, and subtle geometric misalignment ("seams"/tearing) between the two reprojection paths, most visible near the antimeridian and poles.

**Acceptance check.** Enable every layer type simultaneously (base map + at least two raster overlays + polygon shading + animated particles + point markers). Pan across the antimeridian and over both poles, in both projection modes. No seam, tear, gap, or misalignment appears at any layer boundary.

### 1.2 Deterministic, total z-order

**Requirement.** The user must be able to place **any** layer at **any** position in the stack, including animated layers relative to static ones. There must be a single declared ordering that the composited output provably matches. "Static layers are orderable, animated layers are always on top" is explicitly a failure.

**Acceptance check (enumerable, not a spot-check).** With all orderable layers enabled, assert that the actual composited draw order equals the declared order across a defined case set:

- every adjacent-pair swap from the canonical order, and
- every position in the stack for each **animated** layer (the class that silently failed before).

This is tens of cases, not a full permutation sweep — deliberately sized to be genuinely runnable rather than quietly downgraded to a spot-check. It must be automated, because the defect it catches is invisible to casual inspection: in the predecessor, animated layers ignored ordering entirely while the ordering UI reported success.

A small number of layers may be declared **pinned-to-top** by design (selection cursor, satellite marker) — these are exempt, but the exemption must be explicit and enumerable, not incidental.

### 1.3 Layer compatibility semantics

**Requirement.** Layers must carry **declared, data-driven compatibility metadata**. At minimum the model must express:

- **Mutually exclusive groups** — e.g. only one base map style at a time.
- **Auto-disable / supersede relationships** — enabling X turns off Y because they cannot coexist meaningfully.
- **Visual-incoherence signals** — combinations that are technically renderable but produce unreadable output, surfaced to the user (warning, dimming, or automatic adjustment).

**Rationale.** The predecessor enforced mutual exclusion for base styles and for one group of raster overlays, but had **no rule governing overlay combinations at all**. Users could enable topographic base + satellite imagery overlay + city night lights + cloud cover simultaneously, producing an unreadable stack, with the UI offering no signal that the combination was meaningless. This is the single largest usability gap.

**This specification deliberately does not prescribe the specific rules.** Design them during implementation based on what the layers actually look like together. What is mandated is the **artifact and its authority**, not its contents.

**Required artifact.** A single declarative table — one row per layer — enumerating at minimum:

| Field | Meaning |
|---|---|
| Layer identifier | Stable key |
| Exclusivity group | Which mutex group it belongs to, if any |
| Supersedes / disabled-by | Layers auto-disabled when this activates, and vice versa |
| Discouraged-with | Layers that render incoherently alongside it, plus the signal to show |
| Default order position | Its slot in the canonical stack |
| Pinned-to-top | Whether it is exempt from user ordering (§1.2) |

**Authority requirement.** The renderer and the UI must read layer-combination behavior **exclusively** from this table. No layer-specific combination logic may exist anywhere else in the codebase.

**Acceptance check (mechanical, runnable on day one — does not require the rules to be decided yet).**
1. Search the rendering and UI code for conditionals branching on specific layer identifiers. Every hit outside the table definition is a violation.
2. Adding a new layer requires adding exactly one table row and zero changes to rendering or toggle logic. Demonstrate this by adding a throwaway layer.
3. Toggling any layer produces exactly the consequences its row declares, verified against the table rather than against expectation.

**Rationale for the authority rule.** The predecessor did have mutual exclusion for base styles and one overlay group — but it was implemented as conditionals inside the state-toggle function. Because the rules lived in code rather than data, no rule ever got written for overlay-versus-overlay combinations, and there was no single place where their absence was visible. A table makes the gap self-evident: an empty column is obvious in a way that a missing `if` statement is not.

### 1.4 Seamless projection switching

**Requirement.** Switching between globe (3D sphere) and flat (2D planar) presentation is a **projection change on one view**, not a swap between two separate views or canvases. State (center, zoom, enabled layers, selection) is fully preserved across the switch.

**Acceptance check.** Toggle projection with several layers enabled and a location selected. All layers remain enabled and correctly positioned; selection persists; no flash, reload, or reset of camera position.

### 1.5 GPU resource resilience

**Requirement.**
- Recover automatically from GPU context loss (tab backgrounded, system sleep, driver reset) and rebuild the render state.
- Suspend the render loop when the document is hidden; resume on visibility.
- Isolate render failures so a crash in the visualization does not take down the surrounding UI.

**Acceptance check.** Force a GPU context-loss event; the view rebuilds without a page reload. Background the tab; confirm the animation loop stops (no CPU/GPU burn) and resumes correctly on return, without a visual jump caused by accumulated elapsed time.

### 1.6 Performance mode

**Requirement.** A user-toggleable mode that reduces animated particle count substantially and caps the frame rate, for low-power and mobile devices. The cap must actually throttle the loop, not merely reduce visual density.

**Acceptance check.** With performance mode active, measured frame rate is capped at the intended target and particle count is reduced by roughly the intended factor. Reference from the predecessor: ~1800 particles → ~600, frame loop capped near 30 fps.

---

## 2. Core features

These are the features to build. Depth and polish matter more than breadth — build these excellently rather than adding more.

### 2.1 ISS tracking and orbital prediction

**Behavior.**
- Live telemetry for the International Space Station: latitude, longitude, altitude, ground/orbital speed — updating approximately once per second.
- A marker on the map at the ISS position, visibly moving over time.
- **Pass predictor:** for a user-selected observer location, list upcoming visible passes over the next 24 hours — rise time, duration, peak elevation angle, and compass direction of travel. Filter to passes exceeding a minimum elevation threshold (10° is the conventional cutoff for a meaningful pass).
- **Live video:** embed the publicly available live video stream from cameras aboard the station. The stream target must be a **single configurable constant** — public streams go offline, get re-hosted, and change identifiers. When the stream is unavailable, the panel must show an explicit "stream unavailable" state, never a blank or broken frame.
- Display the age of the orbital data and warn the user when it is stale enough to affect accuracy.

**Implementation requirements (behavioral, not library-specific).**
- Position must be computed by a **standard orbital propagation model** (SGP4) fed with current Two-Line Element (TLE) orbital data. Do not approximate with linear interpolation or simple Keplerian circles — the predecessor's fallback did this and produced meaningfully wrong pass predictions.
- **Strongly prefer an established, well-tested propagation implementation over writing one.** SGP4 is deceptively difficult: gravitational constant selection, secular perturbation terms, and the deep-space regime switch are all easy to get subtly wrong in ways that produce plausible-looking but incorrect output. The predecessor's history includes a hand-rolled propagator that was documented as working and did not exist.
- **Network is for orbital elements only.** Fetch TLE data periodically (~12 hour refresh interval is appropriate; the elements are regenerated several times daily). Cache locally. Propagate position **locally** at the update rate — there must be **zero per-second network traffic** for position updates.
- Enforce a hard staleness ceiling (~7 days) beyond which the user is warned; ISS orbit decays measurably from atmospheric drag and is periodically raised by reboost maneuvers, so old elements drift.
- Validate fetched orbital data structurally before caching it, so an error page or malformed response cannot poison the cache.
- **Position and pass computation must accept an evaluation timestamp as a parameter**, with the current time supplied as the default argument by the caller — never read from the system clock inside the computation. This costs nothing now and is what makes the planned time-scrubbing feature (§5) a small addition rather than a rewrite.

**Acceptance check.** Compare displayed position against an independent public satellite tracker at the same moment — they should agree closely. Then validate against the physical reference values below, which require no external service.

**Known-good values (measured against live orbital data):**

| Quantity | Expected range | Note |
|---|---|---|
| Altitude | 400–440 km | ~432 km measured |
| Orbital speed | 7.5–7.8 km/s | ~7.65 km/s ≈ 27,550 km/h |
| Latitude | \|lat\| ≤ 51.7° | Bounded by orbital inclination (~51.6°) |
| Orbital period | ~92–93 min | Altitude should be near-identical one period later |
| Pass duration | ~3–7 minutes | Above 10° elevation |
| Peak elevation | 10°–90° | Below 10° is filtered out |
| Consecutive pass spacing | ~90–100 min | Roughly one orbit apart |

**Efficiency requirement for pass prediction.** A naive fine-grained scan across 24 hours is wasteful. Use a **two-stage search**: a coarse scan (~60 s steps) to detect threshold crossings, then refinement (bisection or similar) only within candidate windows, plus fine sampling only inside a detected pass to find peak elevation. Reference: this approach required ~1,500 propagation evaluations versus ~8,600 for a naive 10-second scan, while achieving *better* boundary resolution (~1 s vs 10 s).

### 2.2 Day/night terminator and twilight bands

**Behavior.** Render the physical day/night boundary on the Earth with three graduated twilight bands (civil, nautical, astronomical) between full daylight and full darkness. Update periodically as the Earth rotates.

**Time handling.** The geometry computation must **accept an evaluation timestamp as a parameter**, with current time supplied by the caller as the default — never read from the system clock internally. Same rationale as §2.1.

**Geometry — verified approach.** This is fully worked out and validated; implement it directly rather than rediscovering it.

The region where solar altitude ≤ *h* is exactly the set of points within angular distance **90° + h** of the **antisolar point** (the antipode of the sub-solar point). Therefore, measured from the antisolar point:

| Boundary | Solar altitude | Angular radius |
|---|---|---|
| Terminator (day/night line) | 0° | 90° |
| Civil twilight limit | −6° | 84° |
| Nautical twilight limit | −12° | 78° |
| Astronomical twilight limit / full night | −18° | 72° |

**Critical solution details — each of these corresponds to a real defect encountered:**

1. **Solve per-longitude in closed form, not by grid scan.** Along any fixed meridian, angular distance to a fixed point is *unimodal*, so the dark region at a given longitude is a **single contiguous latitude interval**. It solves analytically: the condition reduces to `sin(lat + φ) ≥ u`, where `φ` and `u` derive from the antisolar coordinates and the target radius. The predecessor scanned a 2° global grid — 16,200 cells producing 8,000+ unmerged quads. The analytic form produces roughly **7 polygons** total.

2. **Sample longitude from −180° to +180° inclusive.** This makes antimeridian seams *structurally impossible* — the polygon edges land exactly on the antimeridian and coincide when wrapped, rather than crossing it.

3. **Polar caps require no special handling.** The latitude interval clips naturally at ±90°. Note this is the *normal* case, not an edge case: the 90° terminator circle encloses a pole at all times except the exact equinox instant.

4. **Filter degenerate solution branches.** Because a meridian is only *half* a great circle, the distance function can have an interior maximum, yielding two ±360°-shifted solution branches. At the exact equinox these are two zero-width points at opposite poles; naively merging them by taking min/max yields "the entire meridian is dark" — **which shades the whole daylight side of the Earth.** Discard branches below a small width threshold.

5. **Bands must be disjoint strips, not nested filled shapes.** Compute each band as the difference between its outer and inner region, emitted as separate strips. Drawing four nested filled circles instead causes opacity to stack multiplicatively — the night core would render at roughly 4× the intended darkness and the bands would read incorrectly.

**Acceptance check — analytic layer (verified method).** Compare the closed-form interval solver against a brute-force point-by-point evaluation of solar altitude across a dense sweep of longitudes, thresholds, and sub-solar latitudes including equinox (0°) and both solstices (±23.44°). Reference result: across ~104,000 longitude/threshold combinations, exactly **one** discrepancy, corresponding to the zero-area terminator line at the exact equinox; boundary error equal to the brute-force sampling step.

**Acceptance check — visual layer (must be performed).** Confirm on screen: the boundary is a smooth curve, not blocky or sliced; the three twilight bands render as three visually distinct shades (if they appear as one flat wash, the band-difference logic has collapsed); no tear at the antimeridian; the dark polar cap fills correctly rather than inverting onto the daylight side.

### 2.3 Wind and precipitation particle flows

**Behavior.** Animated particle streams over the map visualizing wind vector fields and precipitation motion, in the style of established weather visualizers. User controls for particle **density**, **line thickness**, **speed**, and **trail length**. Particles must be GPU-rendered — thousands of them at interactive frame rates.

**Implementation notes.** Wind data arrives as a sparse grid of sample points; interpolate to a continuous field (inverse-distance weighting is sufficient) and integrate particle paths through it.

**Acceptance check.** Particles flow in directions consistent with the underlying wind data. Each of the four controls produces its stated visual effect. Performance mode measurably reduces load (§1.6). Animation remains smooth with all other layers enabled.

**Critical performance requirement.** Per-frame animation must **not** trigger application-level re-rendering or rebuild layer objects. Drive animation by updating uniforms/parameters on existing GPU layers within a single animation loop. The predecessor's original implementation rebuilt layers every frame through the UI framework's state system and froze the application.

### 2.4 Raster data layers

**Behavior.** Toggleable overlays:

- **Satellite imagery** — recent true-colour Earth observation imagery.
- **City night lights** — nighttime artificial illumination.
- **Surface temperature**.
- **Precipitation radar** — near-real-time, with the observation timestamp surfaced to the user.
- **Cloud cover**.

Each with appropriate opacity, sensible maximum zoom, and participation in the ordering and compatibility systems (§1.2, §1.3).

**Acceptance check.** Each layer loads and displays; opacity and ordering behave as declared; layers unload cleanly when disabled without leaving orphaned resources; timestamped layers show the actual observation time, not the request time.

### 2.5 Base map styles

**Behavior.** Selectable base maps: satellite/aerial imagery, street map, topographic. Mutually exclusive. Identical behavior in both projection modes.

**Acceptance check.** Selecting one deselects the others (verifiable in the state model, not just visually). Each renders correctly in both globe and flat projection.

### 2.6 Location detail analysis

Triggered by clicking any point on the map.

**Behavior.**
- **Reverse geocoding** — resolve to a human-readable place name.
- **Current conditions** — temperature, apparent temperature, humidity, precipitation, cloud cover, wind speed/direction/gust, pressure, visibility, UV index, weather condition.
- **Local time and timezone** alongside UTC.
- **Multi-day forecast.**
- **Terrain cross-section profile** — sample elevation along a transect through the clicked point (reference: 15 sample points spanning roughly 10 km either side) and render it as a cross-section chart, so terrain relief is directly readable.
- **Historical climate anomaly** — compare the current temperature against the multi-year historical mean for the same location and calendar month (reference: 3-year archive baseline), rendered as a chart with the historical norm and the current reading plotted together, so the deviation is visible at a glance.

**Acceptance check.** Click a location with known characteristics — a coastal city, a mountainous area, a desert. Place name resolves correctly. Elevation profile shows relief consistent with actual terrain (flat where flat, mountainous where mountainous). Anomaly chart shows both the historical baseline and current value with the deviation legible.

### 2.7 Marine and oceanographic layer

**Behavior.** Wave height, wave direction, wave period, and sea surface temperature, presented as map markers scaled and colour-coded by value.

**Acceptance check.** Marine data appears for ocean locations and degrades gracefully for inland points where the data source returns nothing.

### 2.8 Search and navigation

**Behavior.** Text search for cities/places with autocomplete; selecting a result animates the camera to that location. Smooth animated transitions, not instant jumps.

**Acceptance check.** Search for cities across multiple countries and character sets. Results are relevant; camera animation is smooth and lands at the correct coordinates.

### 2.9 Bookmarks

**Behavior.** Save locations to a persistent local list; revisit by selecting from the list (animating the camera there); remove entries. Persists across sessions.

**Acceptance check.** Save, reload the page, confirm bookmarks survive; navigate to one; delete one.

### 2.10 Offline resilience and network hygiene

This section is **verified and portable** — carry it forward regardless of stack.

**Requirements.**
- **Map tiles:** stale-while-revalidate — serve cached tiles immediately, refresh in background.
- **API responses:** network-first with a short TTL cache fallback, extended when offline.
- **Cache size management** — bounded entry counts with least-recently-used eviction.
- **All external requests** must pass through a shared client providing:
  - Per-host concurrency limiting (a cap around 4 concurrent requests per host prevents self-inflicted rate-limiting on public APIs).
  - Exponential backoff with jitter.
  - Automatic retry on HTTP 429 and 5xx, honoring `Retry-After` when present.
  - Graceful degradation (return empty rather than throw) on terminal failure.
- **Every field of every external response must pass through validators** that guarantee a usable value — numeric fields verified finite, string fields verified non-empty, with defined fallbacks. Never allow an upstream `null`, `NaN`, or missing field to reach rendering or state.

**Acceptance check.** Load the app, navigate, then disconnect the network: previously visited areas remain viewable. Block a specific API: the app shows a clear user-facing message rather than crashing or displaying `NaN`. Trigger a rate-limit response: confirm backoff and retry rather than immediate failure.

### 2.11 Supporting interface elements

- **Layer ordering UI** — direct manipulation of the render order defined in §1.2.
- **Coordinate readout** for the current selection.
- **Scale bar** reflecting current zoom.
- **Layer legends** — colour scales for active data layers, so values are interpretable.
- **Toast notifications** for errors and status.
- **Loading skeletons** for panels awaiting data.
- **Error boundary** isolating render failures (§1.5).
- **Audio feedback** — subtle synthesized cues for selection and search confirmation. Must be unobtrusive and respect user preference.
- **UI hide toggle** — a keyboard shortcut collapsing all panels for an unobstructed view.

**Acceptance check.** Each element appears when expected and updates correctly. Legends match the actual colour mapping of the rendered data.

---

## 3. Data sources

**Constraint:** free-to-use sources. Services requiring registration are acceptable where their free tier is sufficient; **prefer those that do not require payment details.** Keyless sources remain attractive for zero-friction setup but are not mandatory — where a keyed service offers materially better resolution, coverage, or reliability, it is the better choice.

**Categories required:**

| Category | Needed for |
|---|---|
| Weather (current + forecast) | §2.6 |
| Marine/oceanographic | §2.7 |
| Historical climate archive | §2.6 anomaly baseline |
| Elevation/terrain | §2.6 cross-section |
| Geocoding + reverse geocoding | §2.6, §2.8 |
| Satellite imagery tiles | §2.4 |
| Weather radar tiles | §2.4 |
| Base map tiles (street/topo/aerial) | §2.5 |
| Satellite orbital elements (TLE) | §2.1 |
| Live video stream | §2.1 |

**Requirements for whatever is chosen.** Document the rate limits and attribution requirements of every source. Comply with attribution. Never commit credentials to source control. Design so a source can be swapped without touching rendering code — the predecessor hardcoded endpoint knowledge across multiple layers, making substitution painful.

---

## 4. Platform, audience, and non-functional requirements

- **Platform:** Web application, desktop-first, fully responsive on mobile. Deployable to standard static/edge hosting.
- **Language:** **English only** at launch. **However — localization must not be precluded.** No user-facing string may be hardcoded at its usage site; all text flows through a translation layer from the start. All locale-sensitive formatting (numbers, dates, times, compass directions, hemisphere indicators) must resolve through that layer. Turkish is a planned addition.
  > This is called out specifically because it was a recurring defect in the predecessor: a translation layer existed, but hemisphere letters and time formatting were hardcoded to one locale directly in components, so switching language produced mixed-language output.
- **Accessibility:** keyboard navigation for all controls, ARIA labeling, WCAG AA contrast, and touch targets of at least 44 px. The predecessor treated this as an afterthought and never achieved it — build it in from the start.
- **Testing:** an automated test suite from the beginning. At minimum: the pure computational cores (orbital propagation, terminator geometry, interpolation, coordinate transforms, response validators) and the layer-ordering invariant test from §1.2. The predecessor had **zero** tests, which is why defects reached the user rather than the build.
- **Type safety:** statically typed throughout; no escape hatches that disable type checking in application code.

---

## 5. Future expansion — must not be precluded

Not in scope. Listed so the architecture leaves room, since expansion is planned.

- **Multi-satellite tracking** — arbitrary satellites by catalog identifier (Hubble, Tiangong, constellations). Implication: orbital data fetching and caching must generalize beyond a single hardcoded object; the propagator itself is already object-agnostic.
- **Ground track rendering** — the projected path over the Earth's surface for one or more orbital periods. Implication: the layer system needs a path/line primitive; note that ground tracks cross the antimeridian and must split correctly.
- **Time slider** — scrub forward and backward to see past/predicted state. Implication: **do not hardcode "now."** Time should be an input to the terminator, orbital position, and any time-varying layer, not read from the system clock deep inside those computations. This is the single most invasive retrofit if omitted — design for it now.
- **3D terrain elevation** — actual relief on the globe surface.
- **Additional data layers** — air quality, seismic activity, aurora forecast, shipping/flight traffic.

---

## 6. Non-goals

Explicitly out of scope. The predecessor's documentation drifted into describing an increasingly ambitious product that was never built; this section exists to prevent recurrence.

- User accounts, authentication, server-side persistence, or multi-user features.
- A backend service beyond what static hosting requires — this is a client-side application.
- Serving as an authoritative source for navigation, aviation, maritime, or emergency use. It is a visualization and exploration tool; if any presented data could be mistaken for operational guidance, label it accordingly.
- Historical data archival or a time-series database.
- Editing, annotating, or exporting geospatial datasets.

---

## 7. Confidence labeling of prior findings

Everything in this document falls into one of two buckets. This separation is deliberate — treating unverified work as settled is precisely how the predecessor failed.

**Verified — validated by measurement or direct source inspection:**
- ISS reference values in §2.1, measured against live orbital data.
- Two-stage pass-prediction search efficiency (§2.1), measured.
- Terminator analytic geometry and its five critical details (§2.2), validated against brute force across ~104,000 cases.
- Network hygiene requirements (§2.10) — proven in production use.
- TLE caching strategy (§2.1) — proven.
- The two-render-engine failure mode (§1.1) and total-ordering requirement (§1.2) — diagnosed from a real defect.

**Unverified — sound in principle, never observed working:**
- The *polygon assembly* stage of the terminator (converting latitude intervals into closed rings, run-grouping across longitudes, and the outer∖inner band split). The underlying mathematics is verified; the assembly into renderable geometry was never displayed on screen. **Implement, then visually verify before considering it done.**
- ISS panel presentation, the map marker, and the live video embed — implemented in the predecessor but never visually confirmed.

**Not reproduced — disregard.** A repeating runtime error was observed in an automated preview environment that was not rendering frames, and a UI badge reported a number of issues that was never enumerated. Neither was reproduced in a normally rendering browser and neither is carried forward. Do not treat these as known defects.

---

## Appendix A: Stack-specific findings

Applicable **only** if the corresponding technology is chosen. These are not requirements.

- **`satellite.js` version 7.x** introduces package-import branches pointing at large embedded Emscripten-generated WebAssembly modules. Bundlers performing static analysis of these branches may hang indefinitely — observed as a build that never reaches compilation and never terminates. Version 6.x provides an identical synchronous API without the WebAssembly path. If the build hangs after adding an orbital-mechanics dependency, this is the likely cause.
- **deck.gl interleaved rendering with MapLibre/Mapbox:** deck layers are not registered under their own identifiers. They are grouped by their `beforeId` target and inserted under a generated group identifier. The group position is re-asserted on every property update, so ordering self-heals — but any code attempting to reposition deck layers by their own layer id will silently do nothing, since those identifiers do not exist in the map's style. Layers without a `beforeId` are grouped into a final group that always renders last.
- **Tailwind CSS v4** requires the separate PostCSS plugin package rather than the direct plugin reference used in v3.
- **Next.js 16** removed the `next lint` command; invoke the linter directly.
- **`typescript-eslint`** did not support TypeScript 7.x at time of writing — pairing them silently disables linting entirely.
