import { useRef, useEffect, useState } from 'react'
import './App.css'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'
import * as drawingUtils from '@mediapipe/drawing_utils'

function KickupCamera() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [poseLoaded, setPoseLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [footInfo, setFootInfo] = useState('')
  const [fps, setFps] = useState(0)
  const [ballInfo, setBallInfo] = useState('')
  const frameCount = useRef(0)
  const lastBallPosition = useRef(null)
  const ballDetectionCount = useRef(0)

  useEffect(() => {
    let camera = null
    let pose = null
    let running = true
    let fpsInterval = null

    // Lightweight FPS counter
    const startFpsCounter = () => {
      fpsInterval = setInterval(() => {
        setFps(frameCount.current)
        frameCount.current = 0
      }, 1000)
    }

    const stopFpsCounter = () => {
      if (fpsInterval) {
        clearInterval(fpsInterval)
      }
    }

    async function setup() {
      // Setup Pose with basic settings
      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: false,
        enableSegmentation: false,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });
      pose.onResults(onPoseResults);
      setPoseLoaded(true);

      if (typeof videoRef.current !== 'object' || !videoRef.current) return;
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (!running) return;
          frameCount.current++; // Count frames for FPS
          await pose.send({ image: videoRef.current });
        },
      });
      camera.start();
      startFpsCounter(); // Start FPS counter
    }

    function onPoseResults(results) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Only redraw if we have pose landmarks
      if (results.poseLandmarks) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        
        // Draw feet tracking
        const leftFoot = results.poseLandmarks[31];
        const rightFoot = results.poseLandmarks[32];
        
        if (leftFoot) {
          ctx.beginPath();
          ctx.arc(leftFoot.x * canvas.width, leftFoot.y * canvas.height, 7, 0, 2 * Math.PI);
          ctx.fillStyle = 'blue';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Add label
          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.fillText('Left Foot', leftFoot.x * canvas.width + 15, leftFoot.y * canvas.height);
        }
        
        if (rightFoot) {
          ctx.beginPath();
          ctx.arc(rightFoot.x * canvas.width, rightFoot.y * canvas.height, 7, 0, 2 * Math.PI);
          ctx.fillStyle = 'orange';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Add label
          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.fillText('Right Foot', rightFoot.x * canvas.width + 15, rightFoot.y * canvas.height);
        }
        
        // Ball detection (every 2nd frame for better stability)
        if (frameCount.current % 2 === 0) {
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const blueBall = detectBlueBall(imageData);
            
            if (blueBall) {
              // Smooth ball position to reduce flashing
              if (lastBallPosition.current) {
                const smoothing = 0.7; // Keep 70% of previous position
                blueBall.center.x = blueBall.center.x * (1 - smoothing) + lastBallPosition.current.x * smoothing;
                blueBall.center.y = blueBall.center.y * (1 - smoothing) + lastBallPosition.current.y * smoothing;
              }
              lastBallPosition.current = { x: blueBall.center.x, y: blueBall.center.y };
              ballDetectionCount.current = Math.min(ballDetectionCount.current + 1, 10);
              
              // Draw ball bounding box
              ctx.strokeStyle = '#FFD600';
              ctx.lineWidth = 3;
              ctx.beginPath();
              blueBall.boundingBox.forEach((pt, i) => {
                const x = pt.x * canvas.width;
                const y = pt.y * canvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              });
              ctx.closePath();
              ctx.stroke();
              
              // Draw ball center
              ctx.beginPath();
              ctx.arc(blueBall.center.x * canvas.width, blueBall.center.y * canvas.height, 8, 0, 2 * Math.PI);
              ctx.fillStyle = '#FFD600';
              ctx.fill();
              
              setBallInfo('Ball detected ✓');
            } else {
              // If no ball detected, gradually fade out the last position
              ballDetectionCount.current = Math.max(ballDetectionCount.current - 1, 0);
              
              if (ballDetectionCount.current > 0 && lastBallPosition.current) {
                // Draw fading ball position
                ctx.strokeStyle = `rgba(255, 214, 0, ${ballDetectionCount.current / 10})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(lastBallPosition.current.x * canvas.width, lastBallPosition.current.y * canvas.height, 8, 0, 2 * Math.PI);
                ctx.stroke();
                
                setBallInfo('Ball detected ✓');
              } else {
                // Debug: count blue pixels to see what's happening
                const data = imageData.data;
                let blueCount = 0;
                for (let i = 0; i < data.length; i += 8) { // Sample every 2nd pixel
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  if (b > 100 && r < 80 && g < 80) {
                    blueCount++;
                  }
                }
                setBallInfo(`No ball - Blue pixels: ${blueCount}`);
              }
            }
          } catch (error) {
            setBallInfo('Ball detection error');
          }
        }
        
        ctx.restore();
        
        // Update foot info with visibility checking
        let info = 'Feet detected: ';
        let leftVisible = false;
        let rightVisible = false;
        
        if (leftFoot) {
          const leftX = leftFoot.x * canvas.width;
          const leftY = leftFoot.y * canvas.height;
          if (leftX >= 0 && leftX <= canvas.width && leftY >= 0 && leftY <= canvas.height) {
            leftVisible = true;
            info += 'Left ✓ ';
          }
        }
        
        if (rightFoot) {
          const rightX = rightFoot.x * canvas.width;
          const rightY = rightFoot.y * canvas.height;
          if (rightX >= 0 && rightX <= canvas.width && rightY >= 0 && rightY <= canvas.height) {
            rightVisible = true;
            info += 'Right ✓ ';
          }
        }
        
        if (!leftVisible && !rightVisible) {
          info = 'Move feet into view';
        }
        
        setFootInfo(info);
      } else {
        setFootInfo('No pose detected - make sure you are visible in the camera');
      }
    }

    setup().catch((e) => setError(e.message))
    return () => {
      running = false
      stopFpsCounter()
      if (camera) camera.stop()
    }
  }, [])

  // Lightweight blue ball detection
  const detectBlueBall = (imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let bluePixels = [];
    
    // Sample every 2nd pixel for better detection
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Blue detection (high blue, lower red and green)
        if (b > 100 && r < 80 && g < 80) {
          bluePixels.push({ x, y });
        }
      }
    }
    
    if (bluePixels.length > 100) { // Detect ball with around 100 blue pixels for distant ball
      // Find center of blue cluster
      const centerX = bluePixels.reduce((sum, p) => sum + p.x, 0) / bluePixels.length;
      const centerY = bluePixels.reduce((sum, p) => sum + p.y, 0) / bluePixels.length;
      
      // Find bounding box
      const minX = Math.min(...bluePixels.map(p => p.x));
      const maxX = Math.max(...bluePixels.map(p => p.x));
      const minY = Math.min(...bluePixels.map(p => p.y));
      const maxY = Math.max(...bluePixels.map(p => p.y));
      
      // Only return if the cluster is reasonably sized and roughly circular
      const clusterWidth = maxX - minX;
      const clusterHeight = maxY - minY;
      const aspectRatio = clusterWidth / clusterHeight;
      
      // Relaxed constraints for better detection
      if (clusterWidth > 20 && clusterHeight > 20 && 
          aspectRatio > 0.3 && aspectRatio < 3.0) {
        return {
          center: { x: centerX / width, y: centerY / height },
          boundingBox: [
            { x: minX / width, y: minY / height },
            { x: maxX / width, y: minY / height },
            { x: maxX / width, y: maxY / height },
            { x: minX / width, y: maxY / height }
          ]
        };
      }
    }
    return null;
  };

  return (
    <div className="camera-container">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="camera-video"
      />
      <canvas ref={canvasRef} className="pose-canvas" />
      <div className="foot-info">{footInfo}</div>
      <div className="ball-info">{ballInfo}</div>
      <div className="fps-display">FPS: {fps}</div>
      {!poseLoaded && <div className="loading">Loading pose detection model...</div>}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

function App() {
  return (
    <div className="app">
      <div className="container">
        <header>
          <h1 className="title">⚽ Kick Up Counter</h1>
          <p className="subtitle">Foot tracking with visibility detection</p>
        </header>
        <KickupCamera />
        <footer>
          <p>Blue = Left foot, Orange = Right foot. Only shows ✓ when feet are visible on screen.</p>
        </footer>
      </div>
    </div>
  )
}

export default App
