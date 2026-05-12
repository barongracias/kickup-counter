import { useRef, useEffect, useState } from 'react'
import './App.css'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'

// Pure utility: detect a blue ball in an ImageData frame.
// Returns { center: {x, y}, boundingBox: [{x,y}x4] } (normalized 0-1) or null.
function detectBlueBall(imageData) {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height
  const bluePixels = []

  // Sample every 2nd pixel for better detection
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      // Blue detection (high blue, lower red and green)
      if (b > 100 && r < 80 && g < 80) {
        bluePixels.push({ x, y })
      }
    }
  }

  if (bluePixels.length > 100) {
    const centerX = bluePixels.reduce((sum, p) => sum + p.x, 0) / bluePixels.length
    const centerY = bluePixels.reduce((sum, p) => sum + p.y, 0) / bluePixels.length

    const minX = Math.min(...bluePixels.map(p => p.x))
    const maxX = Math.max(...bluePixels.map(p => p.x))
    const minY = Math.min(...bluePixels.map(p => p.y))
    const maxY = Math.max(...bluePixels.map(p => p.y))

    const clusterWidth = maxX - minX
    const clusterHeight = maxY - minY
    const aspectRatio = clusterWidth / clusterHeight

    if (
      clusterWidth > 20 &&
      clusterHeight > 20 &&
      aspectRatio > 0.3 &&
      aspectRatio < 3.0
    ) {
      return {
        center: { x: centerX / width, y: centerY / height },
        boundingBox: [
          { x: minX / width, y: minY / height },
          { x: maxX / width, y: minY / height },
          { x: maxX / width, y: maxY / height },
          { x: minX / width, y: maxY / height },
        ],
      }
    }
  }
  return null
}

// KickupCamera handles camera setup, pose overlays, blue ball detection, and kick counting.
function KickupCamera({ kickCount, setKickCount }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [poseLoaded, setPoseLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [footInfo, setFootInfo] = useState('Waiting for camera permissions...')
  const [fps, setFps] = useState(0)
  const [ballInfo, setBallInfo] = useState('Looking for a blue ball in frame')

  // FPS counter uses its own frame ref; detection uses a separate one
  const fpsFrameCount = useRef(0)
  const detectionFrame = useRef(0)

  const lastBallPosition = useRef(null)
  const ballDetectionCount = useRef(0)
  const hasFirstResult = useRef(false)

  // Kick counting state
  const lastKickFrame = useRef(0)
  const ballNearFoot = useRef(false)

  useEffect(() => {
    let camera = null
    let pose = null
    let running = true
    let fpsInterval = null

    // Lightweight FPS counter - only resets fpsFrameCount, not detectionFrame
    const startFpsCounter = () => {
      fpsInterval = setInterval(() => {
        setFps(fpsFrameCount.current)
        fpsFrameCount.current = 0
      }, 1000)
    }

    const stopFpsCounter = () => {
      if (fpsInterval) {
        clearInterval(fpsInterval)
      }
    }

    async function setup() {
      if (!videoRef.current || !canvasRef.current) {
        setError('Camera elements are not ready')
        return
      }

      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      })
      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: false,
        enableSegmentation: false,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      })
      pose.onResults(onPoseResults)

      if (typeof videoRef.current !== 'object' || !videoRef.current) return
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (!running) return
          fpsFrameCount.current++
          detectionFrame.current++
          await pose.send({ image: videoRef.current })
        },
        width: 1280,
        height: 720,
      })
      await camera.start()
      startFpsCounter()
    }

    function onPoseResults(results) {
      const canvas = canvasRef.current
      if (!canvas || !results.image) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (canvas.width !== results.image.width || canvas.height !== results.image.height) {
        canvas.width = results.image.width
        canvas.height = results.image.height
      }

      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)

      if (!hasFirstResult.current) {
        hasFirstResult.current = true
        setPoseLoaded(true)
        setError(null)
      }

      const leftFoot = results.poseLandmarks?.[31]
      const rightFoot = results.poseLandmarks?.[32]

      // Ball detection every 2nd detection frame (independent of FPS counter)
      let currentBallCenter = null
      if (detectionFrame.current % 2 === 0) {
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const blueBall = detectBlueBall(imageData)

          if (blueBall) {
            // Smooth ball position to reduce flashing
            if (lastBallPosition.current) {
              const smoothing = 0.7
              blueBall.center.x =
                blueBall.center.x * (1 - smoothing) + lastBallPosition.current.x * smoothing
              blueBall.center.y =
                blueBall.center.y * (1 - smoothing) + lastBallPosition.current.y * smoothing
            }
            lastBallPosition.current = { x: blueBall.center.x, y: blueBall.center.y }
            ballDetectionCount.current = Math.min(ballDetectionCount.current + 1, 10)
            currentBallCenter = blueBall.center

            // Draw ball bounding box
            ctx.strokeStyle = '#FFD600'
            ctx.lineWidth = 3
            ctx.beginPath()
            blueBall.boundingBox.forEach((pt, i) => {
              const x = pt.x * canvas.width
              const y = pt.y * canvas.height
              if (i === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            })
            ctx.closePath()
            ctx.stroke()

            // Draw ball center
            ctx.beginPath()
            ctx.arc(
              blueBall.center.x * canvas.width,
              blueBall.center.y * canvas.height,
              8,
              0,
              2 * Math.PI
            )
            ctx.fillStyle = '#FFD600'
            ctx.fill()

            setBallInfo('Ball detected')
          } else {
            ballDetectionCount.current = Math.max(ballDetectionCount.current - 1, 0)

            if (ballDetectionCount.current > 0 && lastBallPosition.current) {
              // Draw fading ball position
              ctx.strokeStyle = `rgba(255, 214, 0, ${ballDetectionCount.current / 10})`
              ctx.lineWidth = 3
              ctx.beginPath()
              ctx.arc(
                lastBallPosition.current.x * canvas.width,
                lastBallPosition.current.y * canvas.height,
                8,
                0,
                2 * Math.PI
              )
              ctx.stroke()

              // Still use last known center while fading
              currentBallCenter = lastBallPosition.current
              setBallInfo('Ball detected')
            } else {
              // Debug: count blue pixels to show what is happening
              const data = imageData.data
              let blueCount = 0
              for (let i = 0; i < data.length; i += 8) {
                const r = data[i]
                const g = data[i + 1]
                const b = data[i + 2]
                if (b > 100 && r < 80 && g < 80) {
                  blueCount++
                }
              }
              setBallInfo(`No ball - Blue pixels: ${blueCount}`)
            }
          }
        } catch {
          setBallInfo('Ball detection error')
        }

        // --- Kick counting logic ---
        // A kick is registered when the ball center is within 15% of the canvas height
        // from either detected foot, and the ball was NOT near a foot on the previous check
        // (rising edge), with a minimum cooldown of 15 detection frames between kicks.
        const PROXIMITY_THRESHOLD = 0.15 // 15% of canvas height in normalized coords
        const KICK_COOLDOWN = 15 // minimum detection frames between registered kicks

        let isNearFoot = false
        if (currentBallCenter && (leftFoot || rightFoot)) {
          const checkFoot = (foot) => {
            if (!foot) return false
            const dx = Math.abs(currentBallCenter.x - foot.x)
            const dy = Math.abs(currentBallCenter.y - foot.y)
            return dx < PROXIMITY_THRESHOLD && dy < PROXIMITY_THRESHOLD
          }
          isNearFoot = checkFoot(leftFoot) || checkFoot(rightFoot)
        }

        // Rising edge: ball just entered the foot zone + cooldown satisfied
        if (
          isNearFoot &&
          !ballNearFoot.current &&
          detectionFrame.current - lastKickFrame.current > KICK_COOLDOWN
        ) {
          setKickCount((prev) => prev + 1)
          lastKickFrame.current = detectionFrame.current
        }
        ballNearFoot.current = isNearFoot
      }

      // Draw feet tracking
      if (leftFoot) {
        ctx.beginPath()
        ctx.arc(leftFoot.x * canvas.width, leftFoot.y * canvas.height, 7, 0, 2 * Math.PI)
        ctx.fillStyle = 'blue'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = 'white'
        ctx.font = '14px Arial'
        ctx.fillText('Left Foot', leftFoot.x * canvas.width + 15, leftFoot.y * canvas.height)
      }

      if (rightFoot) {
        ctx.beginPath()
        ctx.arc(rightFoot.x * canvas.width, rightFoot.y * canvas.height, 7, 0, 2 * Math.PI)
        ctx.fillStyle = 'orange'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = 'white'
        ctx.font = '14px Arial'
        ctx.fillText('Right Foot', rightFoot.x * canvas.width + 15, rightFoot.y * canvas.height)
      }

      ctx.restore()

      // Update foot info
      let info = 'Feet detected: '
      let leftVisible = false
      let rightVisible = false

      if (leftFoot) {
        const leftX = leftFoot.x * canvas.width
        const leftY = leftFoot.y * canvas.height
        if (leftX >= 0 && leftX <= canvas.width && leftY >= 0 && leftY <= canvas.height) {
          leftVisible = true
          info += 'Left '
        }
      }

      if (rightFoot) {
        const rightX = rightFoot.x * canvas.width
        const rightY = rightFoot.y * canvas.height
        if (rightX >= 0 && rightX <= canvas.width && rightY >= 0 && rightY <= canvas.height) {
          rightVisible = true
          info += 'Right '
        }
      }

      if (!leftVisible && !rightVisible) {
        info = 'Move feet into view'
      }

      setFootInfo(info)
      if (!leftFoot && !rightFoot) {
        setFootInfo('No pose detected - make sure you are visible in the camera')
      }
    }

    setup().catch((e) => setError(e?.message || 'Unable to start the camera feed'))
    return () => {
      running = false
      stopFpsCounter()
      if (camera) camera.stop()
      if (pose) pose.close()
    }
  }, [setKickCount])

  return (
    <div className="camera-container">
      <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
      <canvas ref={canvasRef} className="pose-canvas" />
      <div className="foot-info">{footInfo}</div>
      <div className="ball-info">{ballInfo}</div>
      <div className="fps-display">FPS: {fps}</div>
      {!poseLoaded && !error && (
        <div className="loading">Loading pose detection model...</div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

function App() {
  const [kickCount, setKickCount] = useState(0)

  return (
    <div className="app">
      <div className="container">
        <header>
          <h1 className="title">Kick Up Counter</h1>
          <p className="subtitle">Foot tracking with real-time kick detection</p>
        </header>
        <KickupCamera kickCount={kickCount} setKickCount={setKickCount} />
        <div className="kick-counter">
          <span className="kick-counter-label">Kicks</span>
          <span className="kick-counter-number">{kickCount}</span>
          <button
            className="reset-kick-button"
            onClick={() => setKickCount(0)}
          >
            Reset
          </button>
        </div>
        <footer>
          <p>Blue = Left foot &nbsp;|&nbsp; Orange = Right foot &nbsp;|&nbsp; Yellow box = Ball detected</p>
        </footer>
      </div>
    </div>
  )
}

export default App
