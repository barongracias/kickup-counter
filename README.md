# Kick Up Counter

Camera-driven juggling counter that overlays MediaPipe Pose landmarks, a real-time blue-ball detector, and automatic kick counting. Built with React and Vite.

## Features

- Automatic kick counting: detects when the ball passes close to either foot and increments a counter
- Pose-based foot markers with left/right labeling and on-screen visibility cues
- Lightweight blue ball detection with exponential smoothing and fade-out when confidence drops
- FPS readout and loading/error overlays for quick debugging
- Apple frosted-glass UI with a dark gradient background

## Getting Started

### Requirements

- A modern browser that supports the MediaPipe WASM runtime (Chrome or Edge recommended)
- Camera access over `https://` or `http://localhost` (required for `getUserMedia`)
- A bright, clearly blue ball (avoid strong blue backgrounds)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd kickup-counter

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`) and grant camera permissions when prompted.

## How to Use

1. Stand back far enough that both feet are visible in the frame.
2. Watch the green "Feet detected" overlay until both Left and Right show a checkmark.
3. Hold a bright blue ball and juggle - the yellow bounding box will appear when the ball is found.
4. The large number below the camera increments each time the ball registers near a foot.
5. Press **Reset** to zero the counter at any time.

## Kick Counting Logic

Kicks are counted on the rising edge of a proximity event:

1. Every second detection frame, the ball center (in normalized 0-1 coordinates) is compared against the normalized positions of both foot landmarks from MediaPipe Pose (landmarks 31 and 32).
2. A "near foot" state is set when the horizontal **and** vertical distance between the ball center and either foot is each less than 15 % of the frame dimension.
3. A kick is registered only when `ballNearFoot` transitions from `false` to `true` **and** at least 15 detection frames have elapsed since the last registered kick (the cooldown prevents double-counting a single contact).
4. The detection frame counter (`detectionFrame`) is separate from the FPS counter so the cooldown is not affected by the per-second reset used for FPS measurement.

## Architecture

| File | Purpose |
|------|---------|
| `src/App.jsx` | `detectBlueBall` pure utility (outside component), `KickupCamera` component (camera + pose + detection), `App` shell |
| `src/App.css` | Apple frosted-glass design system |
| `src/index.css` | Minimal root reset |

## Troubleshooting

- **Stuck on "Loading pose detection model"** - confirm camera permissions are granted and the CDN (`jsdelivr.net`) is reachable.
- **Ball not found** - use a bright, saturated blue ball in good even lighting; reduce other blue objects in view. The status badge shows a raw blue-pixel count when no ball is detected.
- **Pose not detected** - ensure your full lower body is in frame and the camera is not too steeply angled.
- **Kicks not counting** - make sure both feet and the ball are visible simultaneously. The ball must approach within ~15 % of the frame width/height of a foot landmark.

## Development

```bash
npm run dev      # Start development server with HMR
npm run build    # Production build
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

---

Keep the ball in the air!
