# Kick Up Counter

Real-time juggling counter powered by MediaPipe Pose and a custom blue-ball detector, built with React and Vite. The camera feed fills the full screen; all stats float as frosted-glass overlay panels.

## Features

- Full-screen camera feed with mirrored display (selfie-style)
- Automatic kick counting: rising-edge proximity detection when the ball passes near either foot
- Pose-based foot markers (blue = left, orange = right) rendered in mirrored canvas space
- Blue-ball detection with exponential position smoothing and fade-out when confidence drops
- FPS readout and pose confidence badge in a top-right frosted-glass panel
- Scale-pulse animation on counter increment
- Apple frosted-glass design system: `backdrop-filter: blur(20px)`, dark gradient background, SF Pro typography, consistent 16-24 px border-radius

## Getting Started

### Requirements

- Chrome or Edge (MediaPipe WASM requires a modern browser)
- Camera access over `https://` or `http://localhost`
- A bright, clearly blue ball (avoid strong blue in the background)

### Installation

```bash
git clone <repo-url>
cd kickup-counter
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`) and grant camera permissions.

## How to Use

1. Stand back so both feet are visible in the frame.
2. Watch the top-left status panel until **Both feet visible** appears.
3. Hold a bright blue ball and juggle — the yellow bounding box shows when the ball is found.
4. The large counter at the bottom increments each time the ball registers near a foot.
5. Press **Reset** to zero the counter.

## Kick Counting Logic

Kicks are counted on the rising edge of a proximity event:

1. Every second detection frame the ball center (normalized 0–1) is compared against both foot landmarks (MediaPipe landmarks 31 and 32), mirrored to match the canvas.
2. A "near foot" state is set when the horizontal **and** vertical distance is each below 15 % of the frame dimension.
3. A kick is registered only when `ballNearFoot` transitions `false → true` **and** at least 15 detection frames have elapsed since the last kick (prevents double-counting a single contact).

## Architecture

| File | Purpose |
|---|---|
| `src/App.jsx` | `detectBlueBall` utility, `KickupCamera` component, `App` shell |
| `src/App.css` | Full-screen frosted-glass design system |
| `src/index.css` | Minimal root reset |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Stuck on "Loading pose model" | Check camera permissions; ensure `jsdelivr.net` is reachable |
| Ball not found | Use a saturated blue ball in even lighting; remove other blue objects |
| Overlay markers appear on wrong side | Canvas and CSS are both mirrored — should self-correct; reload if stuck |
| Kicks not counting | Both feet and ball must be visible simultaneously; ball must come within ~15 % of a foot landmark |

## Development

```bash
npm run dev      # Dev server with HMR
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

---

Keep the ball in the air!
