# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project identity

Earth Tracker is a WebGL2 2D/3D interactive Earth and GIS visualizer built with Next.js (App Router) + React 19, MapLibre GL, and Deck.gl. It runs entirely client-side and requires **no API keys or accounts** — all data comes from keyless public APIs (Open-Meteo, NASA GIBS, RainViewer). Documentation elsewhere describes ISS satellite tracking, but that subsystem is not implemented in the current code (see Doc trust note).

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build (also the type-check gate — Next runs tsc)
npm run start      # serve the production build
npm run lint       # ESLint via eslint-config-next
npm run analyze    # bundle analysis (cross-env ANALYZE=true next build)
```

Correctness gates: `npm run lint` and `npm run build` must both pass. There is no test suite in this repo.

## Architecture

### Rendering model

A single unified rendering engine lives in `components/earth/EarthCanvas.tsx` (loaded via `next/dynamic`, `ssr: false`):

- **MapLibre GL** owns the base map plus all native raster overlays (NASA GIBS, night lights, temperature, precipitation/RainViewer, clouds) and the day/night terminator + twilight bands, composited through one reprojection path.
- **Deck.gl `MapboxOverlay`** sits on top and renders only animated content: `TripsLayer` wind/precipitation particles, marine wave `ScatterplotLayer` points, and the selection/cursor pulse.
- **2D↔3D** is a MapLibre projection toggle (`map.setProjection({ type: 'globe' | 'mercator' })`) driven by the `globe3D` module (Toolbar "Globe View"). It is a manual user toggle; the zoom-based auto-switch mentioned in older docs is vestigial (`onZoomChange` is a no-op in `app/page.tsx`). This is **not** a Deck.gl `GlobeView`.
- **WebGL context-loss recovery:** `EarthCanvas.tsx` listens for `webglcontextlost` / `webglcontextrestored` and rebuilds the engine; `components/ui/ErrorBoundary.tsx` isolates render crashes.

### Directory layout

```
app/                      # page.tsx (orchestration/state), layout.tsx, globals.css
components/
  earth/EarthCanvas.tsx   # unified MapLibre + Deck.gl overlay engine
  panels/                 # BookmarksPanel, LocationDetailPanel, WeatherPanel
  ui/                     # Toolbar, SearchBar, LayerOrderPanel, ParticleSettingsPanel,
                          #   TimeLegend, CoordDisplay, ScaleBar, Toast, ErrorBoundary, SkeletonLoader
hooks/                    # useModules (module/view state), useSun (SunCalc terminator + twilight)
lib/                      # api, geo, tiles, map, canvasStyle, fetchWithRetry, pulse, audio
data/ , public/data/      # major_cities.geojson
public/sw.js              # service worker (v3)
types/index.ts            # shared TypeScript types
legacy/                   # archived prototype code — not used by the running app
```

### Key subsystems

- **Weather / marine / wind (`lib/api.ts`):** Open-Meteo forecast, marine, historical archive (climatology), elevation, and geocoding. Wind grids feed IDW interpolation and TripsLayer path generation in `lib/map.ts`.
- **Location detail (`components/panels/LocationDetailPanel.tsx`):** 15-point SVG elevation profile (`fetchElevationProfile`) and a climate-anomaly curve comparing current temperature against a 3-year monthly archive mean.
- **Particle / TripsLayer flows (`EarthCanvas.tsx`, `hooks/useModules.ts`, `ParticleSettingsPanel.tsx`):** GPU wind/precipitation particles with Windy-style density/thickness/speed/trail controls and a performance mode.
- **Day/night (`hooks/useSun.ts`):** SunCalc-based terminator polygon + civil/nautical/astronomical twilight bands.
- **Offline / network resilience (`public/sw.js`, `lib/fetchWithRetry.ts`):** service worker v3 (Stale-While-Revalidate for tiles, Network-First + 2-min TTL for API), and `fetchWithRetry` with per-host concurrency limiting, exponential backoff, and `safeNum`/`safeStr` validators.
- **Simplified pass helper (`lib/geo.ts`):** `predictUpcomingPasses` / `ISSUpcomingPass` — a geometric approximation (not SGP4), currently dormant and not imported by any UI code.
- **Tiles (`lib/tiles.ts`) + base styles (`lib/canvasStyle.ts`):** NASA GIBS, RainViewer, and satellite/street/topo base-map URL builders.

## Absolute rules — do not break these

1. **No API keys or accounts.** All data must come from keyless public endpoints (Open-Meteo, NASA GIBS, RainViewer, ArcGIS Online raster tiles). Never introduce a dependency that requires a key or login.
2. **Preserve WebGL context-loss handling.** Keep the `webglcontextlost` / `webglcontextrestored` recovery in `EarthCanvas.tsx` and the surrounding `ErrorBoundary` intact when editing the canvas.
3. **Route external network calls through `fetchWithRetry`** (`lib/fetchWithRetry.ts`) so per-host concurrency (max 4), backoff, and 429/5xx retries are preserved; validate parsed JSON with `safeNum` / `safeStr`.
4. **Respect layer z-order management.** Raster and overlay ordering is user-controllable via `LayerOrderPanel` / `reorderLayers`; keep the `LayerOrderKey` ordering logic consistent to avoid Z-fighting.
5. **Keep the performance/FPS-throttle mode working.** When `performanceMode` is on, particle counts drop (~1800→600) and the render loop is capped at ~30 FPS (`setTimeout(..., 33)`); do not bypass this throttle.
6. **Rendering stays single-engine.** Base map + raster + day/night composite in MapLibre; only animated particles/points/cursor go through the Deck.gl `MapboxOverlay`. Do not split this into separate globe/map canvases.

## Doc trust note

`README.md` and `ARCHITECTURE.md` describe ISS features (live telemetry, NASA live stream, SGP4/pass-predictor panels) that are **not implemented** in the current code — treat those as aspirational, not present. Also note `@arcgis/core` is listed in `package.json` but is **not imported anywhere** (dead dependency slated for removal; the only "arcgis" usage is the `server.arcgisonline.com` raster tile URL, unrelated to the SDK).
