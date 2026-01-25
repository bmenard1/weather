# Weather Ribbons

## Project Overview

Weather Ribbons is an artistic weather visualization project that displays daily weather data as flowing, colorful ribbon graphics. Built with vanilla HTML5, CSS, and JavaScript using Canvas API.

## Tech Stack

- **HTML5 Canvas** - All visualizations rendered via 2D canvas context
- **Vanilla JavaScript** - No frameworks or dependencies
- **CSS3** - Modern styling with gradients, flexbox, and shadows

## Project Structure

```
ribbons/
├── weather-viz-3-ribbons-v2.html  # Earlier iteration
├── weather-viz-3-ribbons-v3.html  # Intermediate version
└── weather-viz-3-ribbons-v4.html  # Current/latest version (use this)
```

## Key Concepts

### Weather Data Format
Data is stored as 24-element arrays (one value per hour, 0=midnight to 23=11pm):
- `daylight`: 0-1 (0=night, 1=full day)
- `clouds`: 0-1 (0=clear, 1=overcast)
- `rain`: 0-1 (0=dry, 1=heavy rain)
- `temperature`: 0-1 (normalized, 0=coldest, 1=warmest)

### Visualization Components
1. **Sky Ribbon** - Shows day/night cycle, clouds, stars, and rain with dynamic height
2. **Temperature Ribbon** - Color gradient from cool blues to warm oranges/reds

### Core Functions
- `interpolateData()` - Smooth cubic interpolation between hourly data points
- `getSkyColor()` - Returns gradient colors based on daylight value
- `drawSkyRibbon()` - Renders sky with stars, clouds, rain
- `drawTemperatureRibbon()` - Renders temperature flow with shimmer/mist effects

## Development Notes

- Visualizations are static (no animation loop) - rendered once on load
- Uses `noise()` function for organic randomness
- Canvas is rendered at 2x resolution for Retina displays
- Stars are pre-generated for consistent positions across redraws
- Rain dynamically extends the sky ribbon height based on intensity

## Color Palettes

**Sky colors** transition through:
- Night: dark blue (#0f1428 to #19233f)
- Twilight: purple (#3c325a to #5a466e)
- Dawn/Dusk: orange/pink (#ff8c64 to #ffb48c)
- Day: sky blue (#64b4eb to #a0d2fa)

**Temperature colors**:
- Cold: #4682c8 (blue)
- Cool: #82beea (light blue)
- Mild: #fadc8c (yellow)
- Warm: #f5a05a (orange)
- Hot: #e66450 (red)

## Running Locally

Open any HTML file directly in a browser. No build step or server required.
