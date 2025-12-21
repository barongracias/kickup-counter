# ⚽ Kick Up Counter

Camera-driven juggling helper that overlays MediaPipe pose data and a simple blue-ball detector. Built with React and Vite.

## Features

- Pose-based foot markers with left/right labeling and visibility cues
- Lightweight blue ball detection with smoothing and fade-out when confidence drops
- FPS readout and loading/error overlays for quick debugging
- Responsive layout with mirrored camera feed and canvas overlay

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser at the local development URL and allow camera permissions (https or localhost is required)

## Using the App

1. Stand far enough back for both feet to be visible; the overlay will mark the left foot in blue and right in orange
2. Watch the `Feet detected` status to confirm visibility; move until both show a check
3. Hold a clearly blue ball in frame for detection; a yellow box and center dot will appear when found
4. Keep lighting even and backgrounds uncluttered for the most stable results

## Components

- `src/App.jsx` (`KickupCamera`): sets up the MediaPipe Pose model and camera feed, draws pose landmarks and labels to the canvas, runs the blue-ball color detector, tracks FPS, and cleans up camera/model resources on unmount.
- `src/App.jsx` (`App`): page shell and copy for the experience.

## Troubleshooting

- Stuck on “Loading pose detection model…”: confirm camera permissions are granted and that the CDN (jsdelivr) is reachable.
- Ball not found: ensure you are using a bright blue ball, keep it in good light, and reduce other strong blue objects in view. The status will show a blue pixel count when no ball is detected.
- Pose not detected: make sure your full body, especially feet, are within the frame and the camera is not excessively angled.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

Feel free to contribute to this project by adding new features, improving the UI, or fixing bugs!

---

Keep the ball in the air! ⚽
