# Kick Up Counter

Real-time football juggling (kick-up) counter powered by MediaPipe Pose and a custom blue-ball detector, built with React + Vite. The camera feed fills the full screen; all stats float as Apple-style frosted-glass overlay panels.

## What it does

- Streams your webcam feed mirrored (selfie-style) to fill the viewport
- Uses MediaPipe Pose to locate your feet (landmarks 31 and 32) in real time
- Detects a bright blue ball by scanning for blue-dominant pixels each frame
- Counts a kick when the ball transitions from "away" to "near" a foot (rising-edge), with a 15-frame cooldown to prevent double-counts
- Displays a large animated counter at the bottom with a scale-pulse on each kick
- Shows FPS, pose confidence, foot-visibility, and ball-detection status in frosted-glass overlay panels

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) and grant camera permissions.

**Chrome is recommended.** MediaPipe's WebAssembly runtime works best in Chrome or Edge; Safari may have issues loading the WASM files from the CDN.

## Usage

1. Stand back so both feet are visible in the frame — the top-left panel shows **Both feet visible** when ready.
2. Hold a bright, saturated blue ball (avoid strong blue in the background).
3. Juggle — the yellow bounding box appears when the ball is found.
4. The counter at the bottom increments on each detected kick.
5. Press **Reset** to zero the counter.

## Requirements

- Chrome or Edge (recommended)
- Camera access over `https://` or `http://localhost`
- A bright blue ball with as little competing blue in the background as possible

## Architecture

| File | Purpose |
|---|---|
| `src/App.jsx` | `detectBlueBall` utility, `KickupCamera` component, `App` shell |
| `src/App.css` | Full-screen frosted-glass design system |
| `src/index.css` | Minimal root reset |

## Development

```bash
npm run dev      # Dev server with HMR
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```
