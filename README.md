# Agrigate — Interactive 3D Bangladesh Map

Interactive Three.js-powered 3D map of Bangladesh showing Agrigate's network of branch offices with animated light beams connecting them to the Head Office in Dhaka.

## Features

- 🗺️ **3D Bangladesh Map** — Extruded country outline with glowing borders
- 📍 **Clickable Markers** — Each branch office is a 3D pin with pulse animation
- ✨ **Animated Light Beams** — Looping particle beams from Dhaka HQ to all branches
- 💬 **Info Popups** — Floating cards with clickable phone, email, and address
- 🎥 **Camera Transitions** — Top-down default → 3D zoom on marker click
- 📱 **Responsive** — Works on desktop and mobile

## Quick Start

This project uses ES Modules and loads Three.js from CDN, so it needs a local HTTP server (not `file://`).

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## File Structure

```
interactive-3d-map/
├── index.html   ← Main HTML (drop this section into your landing page)
├── style.css    ← All styles (scoped to .map-section)
├── main.js      ← Three.js scene, animations, interactions
├── data.js      ← ★ EDIT THIS — branch names, contacts, coordinates
└── README.md    ← This file
```

## How to Update Branch Data

Open **`data.js`** and edit the `operationAreas` array. Each branch entry looks like:

```js
{
  id: "chittagong",                          // unique identifier
  branchName: "Chittagong Branch",           // display name
  district: "Chittagong",                    // district name
  coordinates: [91.7832, 22.3569],           // [longitude, latitude]
  phone: "+880 31-XXXX-XXXX",               // clickable phone link
  email: "chittagong@agrigate.asia",         // clickable email link
  address: "Agrabad, Chittagong, Bangladesh" // clickable Google Maps link
}
```

## Embedding in Your Website

1. Copy all 4 files into your project
2. Add the `<section class="map-section">` from `index.html` into your landing page
3. Include `style.css` in your `<head>`
4. Add `<script type="module" src="main.js"></script>` before `</body>`
5. Adjust the `.map-section` height in CSS to fit your layout (default is `100vh`)

## Customization

### Colors & Theme
Edit the `theme` object in `data.js`:
- `mapColor` — Map surface color
- `beamColor` — Light beam color  
- `markerColor` — Branch marker color
- `hqMarkerColor` — HQ marker color
- `backgroundColor` — Scene background

### Map Accuracy
The current map uses a simplified outline. For pixel-perfect accuracy, replace `BANGLADESH_OUTLINE` in `main.js` with coordinates from actual GeoJSON data.

## Dependencies

- [Three.js r160](https://threejs.org/) — loaded from CDN (no install needed)
- [Inter Font](https://fonts.google.com/specimen/Inter) — loaded from Google Fonts
# agrigatenetworkacrossbangladesh
