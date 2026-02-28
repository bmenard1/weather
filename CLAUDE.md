# Weather Flow

## What This Is

Weather Flow is an artistic weather visualization that renders a full day's weather as a horizontal panoramic painting. Time flows left to right. There are no weather icons, no dashboards — just a sky ribbon, a temperature curve, and subtle atmospheric effects. It's designed to feel like watching the day pass through a window.

Single-file vanilla app (`index.html`, ~4500 lines). No frameworks, no build step. Open in a browser. Default city: Baltimore.

## File Structure

```
weather flow/
├── index.html          # The entire app (HTML + CSS + JS, single file)
├── favicon.svg         # SVG favicon: sky ribbon + temperature curve
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline/PWA
├── icon-192.png        # PWA icon 192×192
├── icon-512.png        # PWA icon 512×512
├── CLAUDE.md           # This file
├── notes.txt           # Scratch notes
└── OLD/                # Earlier iterations (not used)
```

## Splash Title & Hover Title

### Splash Title (`#splashTitle`)
- Shown on initial page load, overlaid on the sky ribbon area.
- Fades out (0.6s) after first data render, then removed from DOM.
- **Title**: "weather flow" — Avenir Next, Demi Bold (600), 3.2rem, deep blue `rgb(30, 80, 160)`, wide letter-spacing (0.18em), lowercase.
- **Subtitle**: "forecast without numbers" — Avenir Next, Demi Bold (600), 0.78rem, same deep blue. Left-aligned under middle of 'w' in "weather" (`margin-left: 1rem`). Text fades out letter-by-letter starting from "without" (opacity 1.0 → 0.35 across 15 characters).
- Positioned at `top: -15px` within `.weather-display-wrapper`.

### Hover Title (`#hoverTitle`)
- Identical styling to splash title but persists in the DOM.
- Hidden by default (`opacity: 0`), fades in (0.8s) when mouse moves above the sky ribbon (from viewport top to ribbon top, within ribbon horizontal bounds). Desktop only — hidden on touch devices.
- Fades out after 2s delay when mouse leaves the detection zone.
- `pointer-events: none` — never blocks ribbon interaction.
- JS listener: `document` mousemove event checks `e.clientY < ribbonRect.top` within ribbon's horizontal bounds.

## Visual Layers (top to bottom)

### 1. Sky Ribbon (canvas: `#skyRibbon`)

A wide horizontal ribbon rendered column-by-column. Composited layers:

- **Sky gradient** — transitions through night (deep blue-black `#0f1428`), twilight (purple), dawn/dusk (orange-pink), midday (cerulean `#64b4eb` to pale `#a0d2fa`). Driven by daylight value per column.
- **Cloud layer** — radial puff textures at top of ribbon. Brightness shifts: dark at night, bright white during day, orange-tinted at dawn/dusk. Alpha driven by cloud cover with cosine smoothing.
- **Night darkening** — dark blue-black wash that strengthens at night, fades near sunrise.
- **Stars** — 400 pre-seeded dots (deterministic via sin-hash noise). Fade in at night, fade out through clouds. Palette: white, warm yellow, cool blue, reddish.
- **Rain** — 4 parallax depth layers of gradient streaks falling from clouds. Angled ~10-12° for wind feel. Rain extends the ribbon height dynamically.
- **Snow** — 4 parallax layers of radial-gradient glowing dots with sine-wave lateral drift. Mutually exclusive with rain per column.

The ribbon is cropped at the top (hides upper 55% where cloud puffs live), showing only the lower sky gradient. This creates a clean horizon-like edge.

**Dimensions**: `fullBaseHeight = 240`, crop 55%, plus up to `precipExtensionHeight = 200` for rain/snow overflow.

### 2. Temperature Curve (canvas: `#tempCurveCanvas`)

A flowing colored spline curve drawn on a full-viewport canvas positioned behind the sky ribbon.

- **Interpolation**: Catmull-Rom spline on full 24-hour data (avoids edge flattening at display boundaries).
- **Color per pixel**: icy white (≤0°C) → blue (10°C) → golden yellow (20°C) → orange (30°C) → red (40°C) → dark red (50°C) → deep maroon (>50°C).
- **Below 0°C**: curve becomes dashed, gap length increasing as temperature drops further.
- **Fill**: semi-transparent gradient wash flowing down from curve to baseline, fading with power curve.
- **Glow layers**: 4 passes — 8px outer glow, 4px medium, 2px main line, 0.8px bright highlight. All fade at night.
- **Reference bar**: vertical color-coded tick mark at noon showing the display temperature range, with marks at 0°C, 10°C, 20°C, and 40°C (each in its corresponding color).
- **Current time marker**: white downward triangle above sky ribbon, today only.

**Adaptive range**: fetches samples from start/end of forecast period, calculates mean, sets visible range to mean −15°C / mean +22.5°C. This zooms the curve for tropical, arctic, or temperate cities.

### 3. Wind Animation (canvas: `#windCanvas`, RAF loop)

The only continuously animated layer.

- White horizontal tapered streaks above the temperature curve.
- Only visible when wind > ~16 km/h (`WIND_THRESHOLD = 0.2`).
- 40 columns × 2 streaks each. Opacity pulses via sine wave (shimmer).
- Clipped by distance from temperature curve — only appear in a band just above it.

### 4. World Map Overlay (canvas: `#worldMapCanvas`)

- TopoJSON equirectangular world map (Natural Earth 110m via jsDelivr CDN).
- Appears on Random click, city selection, or map interaction. Fades in 0.8s, auto-fades out after 8s (15s if clicked).
- **Temperature heatmap**: land masses are filled with a smooth temperature color field showing mean daytime temperatures worldwide. Uses a 10° lat/lon grid (~540 points) fetched from Open-Meteo, rendered as a tiny 36×15 offscreen canvas stretched to map bounds with browser bilinear interpolation. Clipped to country polygons via `ctx.clip()` — oceans stay transparent.
- Country outlines drawn on top of heatmap (slightly stronger stroke when heatmap active). Colored dot at current city (color = mean daytime temperature).
- **Animated dot transition**: when changing city (random or autocomplete) while map is already visible, the dot animates from old position to new (800ms, ease-out cubic). Uses `ImageData` caching: background (outlines + heatmap) drawn once and cached, RAF loop restores it each frame and draws dot at interpolated lat/lon.
- **Clickable**: click anywhere → reverse geocode via Nominatim → load that location's weather. Remains clickable throughout the 5s fade-out via inline `pointer-events: auto` override.
- Clipped to 83°N–60°S (excludes Antarctica). Anti-meridian artifacts filtered.
- **Heatmap caching**: `heatmapGridCache` keyed by `dateStr`. Only fetched once per date — pressing random on the same day reuses cached data with zero API calls. Grid data updates automatically when navigating to a different day while map is visible.
- **Rendering split**: `drawWorldMapBackground(ctx, polygons, mapBounds, extraDots, heatmapGridData)` draws heatmap + outlines + extra dots. `drawCityDot(ctx, lat, lon, mapBounds)` draws the main city dot. `drawWorldMap()` calls both.

### 5. Year Temperature Band (canvas: `#yearBandCanvas`)

A thin horizontal color strip below the day selector showing the mean midday temperature (noon ± 3h, hours 9–15) for every day of the current year.

- **Visibility**: hidden by default on desktop. Appears (0.8s fade-in) when mouse hovers directly over the band area. Stays visible while cursor is on the band. When cursor moves away, remains visible for 10 seconds, then fades out over 5s (same pattern as world map). Remains clickable during fade-out. On touch devices, always visible.
- **3 data tiers** (all use `hourly=temperature_2m`, temp averaged over hours 9–15):
  - **Tier 1 — Past** (Jan 1 → yesterday): archive API
  - **Tier 2 — Forecast** (today → +14 days): forecast API
  - **Tier 3 — Last-year fill** (remaining days → Dec 31): archive API for same dates last year
- All tiers rendered at 0.35 base alpha.
- **Data per entry**: `{ date, tempC, tier, daylightFrac }` — daylightFrac computed via astronomical formula from latitude + day-of-year (handles polar regions smoothly, no API dependency)
- **Rendering**: each day = one vertical color slice, color via `getTempColor((tempC + 25) / 60)`
- **Daylight-aware fade**: each slice has a per-column vertical gradient — bright center (daylight zone) fading to transparent at both edges (night zone). Width of bright portion = `daylightFrac` (amplified 2.5× from 0.5 midpoint for stronger visual contrast). Summer days appear thick, winter days thin, creating a visible daylight envelope across the year.
- **Today marker**: small triangle below band, pointing up
- **Viewed day marker**: dashed white line when navigating away from today
- **Click**: navigates to that day (past only or within forecast range)
- **Hover tooltip** (desktop): shows "Mon Day · 8°C" — date, colored integer temperature + "(last year)" for tier 3
- **Caching**: `yearBandCache` keyed by `cityKey`. Refetched on city change.
- **Height**: 18px desktop, 16px tablet, 14px phone. Pill-shaped (border-radius).
- **Functions**: `fetchYearBandData(cityKey)`, `drawYearBand()`, `initYearBandInteraction()`, `initYearBandHover()`, `showYearBand()`, `scheduleYearBandFadeOut()`

## Data & APIs

**Open-Meteo** (free, no key):
- Forecast: `api.open-meteo.com/v1/forecast` — today + 14 days, recent past (within 5 days)
- Archive: `archive-api.open-meteo.com/v1/archive` — historical (>5 days ago)
- Hourly params: `temperature_2m`, `cloud_cover`, `rain`, `snowfall`, `precipitation`, `precipitation_probability`, `wind_speed_10m`, `wind_direction_10m`, `is_day`
- Daily: `sunrise`, `sunset` (main weather fetch only; year band uses astronomical formula instead)
- Timezone per city for local time alignment.

**Open-Meteo Geocoding**: `geocoding-api.open-meteo.com/v1/search` — city autocomplete (debounced 300ms, 5 results).

**Nominatim** (OpenStreetMap): reverse geocoding for map click → place name.

### Normalization

| Field | Raw | Normalized 0–1 |
|-------|-----|-----------------|
| `daylight` | computed from sunrise/sunset | 0=night, 1=full day (cosine transitions, 1.5h dawn/dusk) |
| `clouds` | 0–100% | divided by 100 |
| `rain` | mm/h | capped at 10mm = 1.0 |
| `snow` | cm/h | capped at 5cm = 1.0 |
| `temperature` | °C | `(temp + 25) / 60` unclamped (range extends beyond 1.0; color ramp covers up to 50°C+) |
| `windSpeed` | km/h | capped at 80 km/h = 1.0 |

### Caching

- In-memory `weatherCache` keyed by `cityKey-dateString`.
- In-memory `yearBandCache` keyed by `cityKey` (365-entry array of `{date, tempC, tier, daylightFrac}`).
- In-memory `heatmapGridCache` keyed by `dateStr` (2D array `[row][col]` of mean daytime °C for 540-point global grid). Only fetched once per date.
- Prefetches full 14-day forecast in batches of 3 after initial load.
- Prefetches past days in batches of 7 when navigating backward.

## Interactive Features

### Day Navigation
- Arrow buttons (hidden on touch → tap left/right third of sky ribbon).
- Keyboard: ← / → arrow keys.
- Click day label → jump to today.
- Unlimited past history (archive API). Up to 14 days ahead.
- Label format: "Today", "Tomorrow Wednesday", "Yesterday Tuesday", "Wednesday Feb 26", etc. Year shown if not current.

### City Selection
- Click city label → live autocomplete input (geocoding API).
- Type ≥2 chars → debounced suggestions with state/country detail.
- Enter auto-picks top result. Escape cancels.
- "set as default" link appears after picking a city → saves to `localStorage`.

### Random Button
- Picks a random world capital (~100 cities, all continents).
- Shows world map overlay with temperature heatmap and animated city dot.
- If map is already visible, animates dot from previous city to new city.

### Similar Button (commented out)
- Code present but commented out. Would find cities with similar daytime temperatures using `majorCities` array (284 cities with 1M+ population).

### Tooltips (desktop only, hidden on touch)
- **Sky ribbon**: hour, cloud %, precipitation mm/cm, sunrise/sunset time near those events.
- **Temperature curve**: hour, integer °C (color-coded), wind km/h if >15.

## Key Functions

| Function | Purpose |
|----------|---------|
| `interpolateData(data, t)` | Smoothstep interpolation for most data arrays |
| `interpolateDataSmooth(data, t, useFullTemp)` | Catmull-Rom spline. When `useFullTemp=true`, uses full 24h temperature for edge smoothness |
| `getSkyColor(dayValue, cloudValue)` | Returns `{top, bottom}` gradient colors for sky |
| `getTempColor(tempValue)` | Returns `{r,g,b}` for normalized temperature |
| `drawSkyRibbon()` | Renders entire sky ribbon (static, one-shot) |
| `drawTemperatureCurve()` | Renders temperature curve + reference bar + time marker (static) |
| `drawWindAnimation(timestamp)` | RAF loop for wind streaks |
| `showWorldMap(lat, lon)` | Renders + fades world map overlay; fetches heatmap grid if not cached; animates dot if map already visible |
| `drawWorldMapBackground(ctx, polygons, bounds, extraDots, heatmap)` | Draws heatmap overlay (if data provided) + country outlines + extra dots |
| `drawCityDot(ctx, lat, lon, bounds)` | Draws temperature-colored city dot at given coordinates |
| `drawWorldMap(ctx, polygons, lat, lon, bounds, extraDots, heatmap)` | Calls `drawWorldMapBackground` + `drawCityDot` |
| `drawHeatmapOverlay(ctx, bounds, polygons, gridData)` | Renders smooth temperature color field clipped to land polygons via offscreen canvas |
| `fetchHeatmapGrid(dateStr)` | Fetches 540-point temperature grid (11 batch API calls), caches by date |
| `animateDotTransition(canvas, fromLat, fromLon, toLat, toLon, dur)` | RAF animation of city dot between two positions using ImageData caching |
| `fetchYearBandData(cityKey)` | 3 API calls → merged 365-entry array `{date, tempC, tier, daylightFrac}` |
| `drawYearBand()` | Canvas rendering of year band with color slices + daylight gradient + markers |
| `initYearBandInteraction()` | Sets up click (navigate) + hover (tooltip) on year band |
| `initYearBandHover()` | Desktop auto-show/hide: mousemove detection, 10s timer, 5s fade-out |
| `showYearBand()` | Shows year band (cancels pending fade, adds `.visible`) |
| `scheduleYearBandFadeOut()` | Schedules 10s delay → remove `.visible` → 5s fade → cleanup |
| `calculateTempRangeFromData(dayData)` | Synchronous temp range from single day's data (fast initial render) |
| `refineTempRangeInBackground(cityKey)` | Background fetch of day+14, recalculates range, re-renders if changed |
| `refreshView(skipTempRangeRecalc)` | Main entry: fetch data → update → draw all |
| `draw()` | Calls `drawSkyRibbon()` → reflow → `drawTemperatureCurve()` → `drawYearBand()` → `startWindAnimation()` |
| `noise(x, y, seed)` | Sin-hash pseudo-random for organic textures |
| `mapTempToDisplayRange(tempValue)` | Maps normalized temp to 0–1 within adaptive display range |

## UI Architecture

```
body (dark gradient background #0d1117 → #0f1a2e)
└── .weather-display-wrapper (relative container for all canvases)
    ├── #splashTitle (initial load title, removed after first render)
    ├── #hoverTitle (hover title, fades in/out on mouse above ribbon)
    ├── #loadingOverlay (shimmer skeleton, shown during fetches)
    ├── #tempCurveCanvas (full viewport, z-index: 0)
    ├── #windCanvas (full viewport, z-index: 1, animated)
    ├── #tempCurveOverlay (invisible hit area for temp tooltips, z-index: 10)
    ├── .temp-tooltip (fixed position, follows mouse)
    ├── .container
    │   └── .ribbon-row → .ribbon-wrapper.dynamic-height
    │       └── #skyRibbon canvas (pill-shaped, border-radius: 50px top)
    ├── .sky-tooltip (fixed position, follows mouse)
    └── .day-selector (absolute bottom)
        └── .day-selector-content (flex row)
            ├── .date-nav (← Today →)
            └── .location-section (city label + random btn)
└── .year-band-container (below wrapper)
    ├── #yearBandCanvas (full-year color strip, clickable)
    └── .year-band-tooltip (fixed position, follows mouse)
└── #swipeIndicator ("tap left/right of sky to change day", touch only)
└── #worldMapCanvas (below wrapper, fades in/out)
```

## Rendering Details

- All canvases rendered at 2× for Retina (`canvas.width = w*2; ctx.scale(2,2)`).
- Sky ribbon drawn column-by-column (per-pixel-column compositing).
- Temperature curve drawn segment-by-segment for per-pixel color + dash control.
- Display range crops 2h before sunrise to 2h after sunset (not full 24h).
- Wind is the only RAF animation. Everything else renders once on `draw()`.
- Resize handler debounced at 200ms → redraws all + resizes map if visible.

## Responsive Design

Three breakpoints:
- **Desktop** (>768px): full layout, tooltips active, arrow buttons visible.
- **Tablet** (≤768px): reduced spacing, smaller fonts, 80px ribbon height.
- **Phone portrait** (≤480px portrait): day selector moves below ribbon (relative positioning), horizontal layout with date-nav left / city right. Arrows hidden, tap navigation.
- **Phone landscape** (≤480px landscape): compact spacing, smaller fonts.

Touch devices: arrows hidden, tap left/right third of sky to navigate days. Tooltips disabled.

## PWA

- `manifest.json` with 192 and 512 icons.
- `sw.js` service worker for offline support.
- Apple mobile web app meta tags with black-translucent status bar.
- Theme color: `#0d1117`.

## Style Notes

- All UI chrome is ghostly: nearly transparent backgrounds, hairline borders, muted silver-white text.
- Title font: Avenir Next (system font, no external load), Demi Bold, deep blue `rgb(30, 80, 160)`.
- UI font: system UI (`Segoe UI`, Tahoma, etc.), always small and light.
- Buttons: `rgba(255,255,255,0.06)` background, `rgba(255,255,255,0.08)` border, 12px border-radius.
- Loading: shimmer skeleton with traveling gradient, 1.5s ease-in-out infinite animation.
- Transitions: 0.25s ease on all interactive elements.
- Auto-refreshes weather data every hour.

## Overleaf Document
- Overleaf project: "Weather flow"
- Keep a log of changes in an appendix:
  - start a new section for each 24h period. Draw a horizontal lines beween then. Make sure they all appear chronologically.
  - Write the date and a description of both the requests and changes implemented. Separate them clearly.
  - write the number of code lines.
