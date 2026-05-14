import { useRef, useEffect, useState, useCallback } from 'react'
import './App.css'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'

// Detect a blue ball in an already-mirrored ImageData frame.
// Returns { center: {x, y}, boundingBox: [{x,y}x4] } (normalized 0-1) or null.
function detectBlueBall(imageData) {
  const { data, width, height } = imageData
  const bluePixels = []

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      if (b > 100 && r < 80 && g < 80) {
        bluePixels.push({ x, y })
      }
    }
  }

  if (bluePixels.length < 100) return null

  const centerX = bluePixels.reduce((s, p) => s + p.x, 0) / bluePixels.length
  const centerY = bluePixels.reduce((s, p) => s + p.y, 0) / bluePixels.length
  const minX = Math.min(...bluePixels.map(p => p.x))
  const maxX = Math.max(...bluePixels.map(p => p.x))
  const minY = Math.min(...bluePixels.map(p => p.y))
  const maxY = Math.max(...bluePixels.map(p => p.y))
  const bw = maxX - minX
  const bh = maxY - minY
  const aspect = bw / bh

  if (bw < 20 || bh < 20 || aspect < 0.3 || aspect > 3.0) return null

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

function KickupCamera({ onKick }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [status, setStatus] = useState({ pose: false, error: null })
  const [fps, setFps] = useState(0)
  const [footStatus, setFootStatus] = useState('Waiting for camera…')
  const [ballStatus, setBallStatus] = useState('Looking for blue ball')
  const [confidence, setConfidence] = useState(0)

  const fpsFrames = useRef(0)
  const detFrame = useRef(0)
  const lastBallPos = useRef(null)
  const ballFade = useRef(0)
  const hasFirst = useRef(false)
  const lastKickFrame = useRef(0)
  const ballNearFoot = useRef(false)

  useEffect(() => {
    let camera = null
    let pose = null
    let running = true
    let fpsTimer = null

    pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    })
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    })

    function onResults(results) {
      const canvas = canvasRef.current
      if (!canvas || !results.image) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const iw = results.image.width
      const ih = results.image.height
      if (canvas.width !== iw || canvas.height !== ih) {
        canvas.width = iw
        canvas.height = ih
      }

      fpsFrames.current++
      detFrame.current++

      // Draw the video frame mirrored so the canvas overlay matches the CSS-mirrored video
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      if (!hasFirst.current) {
        hasFirst.current = true
        setStatus({ pose: true, error: null })
      }

      // MediaPipe landmarks are in unmirrored space; flip X to match the mirrored canvas
      const mirrorX = (lm) => lm ? { ...lm, x: 1 - lm.x } : null
      const leftFoot = mirrorX(results.poseLandmarks?.[31])
      const rightFoot = mirrorX(results.poseLandmarks?.[32])

      const rawLeft = results.poseLandmarks?.[31]
      const rawRight = results.poseLandmarks?.[32]
      const conf = rawLeft?.visibility ?? rawRight?.visibility ?? 0
      setConfidence(Math.round(conf * 100))

      // Ball detection every other frame to save CPU
      let ballCenter = null
      if (detFrame.current % 2 === 0) {
        try {
          // imageData is already in mirrored canvas space
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const ball = detectBlueBall(imageData)

          if (ball) {
            // Exponential smoothing of ball position
            if (lastBallPos.current) {
              const s = 0.6
              ball.center.x = ball.center.x * (1 - s) + lastBallPos.current.x * s
              ball.center.y = ball.center.y * (1 - s) + lastBallPos.current.y * s
            }
            lastBallPos.current = { ...ball.center }
            ballFade.current = 10
            ballCenter = ball.center

            // Draw bounding box (coordinates are in mirrored canvas space — draw directly)
            ctx.save()
            ctx.strokeStyle = '#FFD600'
            ctx.lineWidth = 3
            ctx.beginPath()
            ball.boundingBox.forEach(({ x, y }, i) => {
              const px = x * canvas.width
              const py = y * canvas.height
              if (i === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            })
            ctx.closePath()
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(ball.center.x * canvas.width, ball.center.y * canvas.height, 8, 0, Math.PI * 2)
            ctx.fillStyle = '#FFD600'
            ctx.fill()
            ctx.restore()

            setBallStatus('Ball detected')
          } else {
            ballFade.current = Math.max(0, ballFade.current - 1)
            if (ballFade.current > 0 && lastBallPos.current) {
              const alpha = ballFade.current / 10
              ctx.save()
              ctx.strokeStyle = `rgba(255,214,0,${alpha})`
              ctx.lineWidth = 3
              ctx.beginPath()
              ctx.arc(
                lastBallPos.current.x * canvas.width,
                lastBallPos.current.y * canvas.height,
                8, 0, Math.PI * 2
              )
              ctx.stroke()
              ctx.restore()
              ballCenter = lastBallPos.current
              setBallStatus('Ball detected')
            } else {
              setBallStatus('No ball – use a blue ball')
            }
          }
        } catch {
          setBallStatus('Detection error')
        }

        // Rising-edge kick detection with cooldown
        const THRESH = 0.15
        const COOLDOWN = 15
        let nearFoot = false
        if (ballCenter && (leftFoot || rightFoot)) {
          const nearFn = (foot) => foot &&
            Math.abs(ballCenter.x - foot.x) < THRESH &&
            Math.abs(ballCenter.y - foot.y) < THRESH
          nearFoot = nearFn(leftFoot) || nearFn(rightFoot)
        }

        if (nearFoot && !ballNearFoot.current &&
            detFrame.current - lastKickFrame.current > COOLDOWN) {
          onKick()
          lastKickFrame.current = detFrame.current
        }
        ballNearFoot.current = nearFoot
      }

      // Draw foot markers at mirrored positions
      const drawFoot = (foot, color, label) => {
        if (!foot) return
        ctx.save()
        ctx.beginPath()
        ctx.arc(foot.x * canvas.width, foot.y * canvas.height, 8, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = 'bold 13px -apple-system, system-ui'
        ctx.fillText(label, foot.x * canvas.width + 12, foot.y * canvas.height + 4)
        ctx.restore()
      }
      drawFoot(leftFoot, '#3b82f6', 'L')
      drawFoot(rightFoot, '#f97316', 'R')

      // Update foot status string
      const l = leftFoot && leftFoot.x >= 0 && leftFoot.x <= 1
      const r = rightFoot && rightFoot.x >= 0 && rightFoot.x <= 1
      if (!results.poseLandmarks) {
        setFootStatus('No pose – move into frame')
      } else if (l && r) {
        setFootStatus('Both feet visible')
      } else if (l) {
        setFootStatus('Left foot visible')
      } else if (r) {
        setFootStatus('Right foot visible')
      } else {
        setFootStatus('Move feet into view')
      }
    }

    pose.onResults(onResults)

    async function start() {
      if (!videoRef.current || !canvasRef.current) return
      try {
        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (!running) return
            await pose.send({ image: videoRef.current })
          },
          width: 1280,
          height: 720,
        })
        await camera.start()
        fpsTimer = setInterval(() => {
          setFps(fpsFrames.current)
          fpsFrames.current = 0
        }, 1000)
      } catch (e) {
        setStatus({ pose: false, error: e?.message || 'Camera unavailable' })
      }
    }

    start()

    return () => {
      running = false
      clearInterval(fpsTimer)
      camera?.stop()
      pose?.close()
    }
  }, [onKick])

  return (
    <div className="camera-wrap">
      <video ref={videoRef} autoPlay playsInline muted className="feed-video" />
      <canvas ref={canvasRef} className="feed-canvas" />

      {/* Top-left: foot + ball status pills */}
      <div className="overlay-panel status-panel">
        <div className={`pill ${footStatus.includes('Both') ? 'pill-green' : 'pill-dim'}`}>
          {footStatus}
        </div>
        <div className={`pill ${ballStatus.startsWith('Ball') ? 'pill-yellow' : 'pill-dim'}`}>
          {ballStatus}
        </div>
      </div>

      {/* Top-right: FPS + confidence */}
      <div className="overlay-panel metrics-panel">
        <span className="metric">{fps} FPS</span>
        <span className="metric-sep" />
        <span className="metric">{confidence}% conf</span>
      </div>

      {!status.pose && !status.error && (
        <div className="overlay-center loading-panel">
          Loading pose model…
        </div>
      )}
      {status.error && (
        <div className="overlay-center error-panel">
          {status.error}
        </div>
      )}
    </div>
  )
}

const MILESTONES = new Set([10, 25, 50, 100, 150, 200, 250, 500, 1000])

function App() {
  const [count, setCount] = useState(0)
  const [pulse, setPulse] = useState(false)
  const [milestone, setMilestone] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
  }, [])

  const handleKick = useCallback(() => {
    setCount(c => {
      const next = c + 1
      if (MILESTONES.has(next)) {
        setMilestone(true)
        setTimeout(() => setMilestone(false), 720)
      }
      return next
    })
    setPulse(true)
    setTimeout(() => setPulse(false), 360)
  }, [])

  const counterClass = [
    'kicks-counter',
    !mounted.current ? 'mount-in' : '',
    milestone ? 'milestone' : (pulse ? 'pulse' : ''),
  ].filter(Boolean).join(' ')

  return (
    <div className="app">
      <KickupCamera onKick={handleKick} />

      {/* Counter overlay – bottom centre */}
      <div className="counter-overlay">
        <div className={`counter-card${milestone ? ' has-milestone' : ''}`}>
          <span className={counterClass}>{count}</span>
          <span className="counter-label">Kick-Ups</span>
          <button className="reset-btn" onClick={() => setCount(0)}>Reset</button>
          <div className="spark-layer" aria-hidden="true">
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
            <span className="spark" />
          </div>
        </div>
      </div>

      {/* Title overlay – top centre */}
      <div className="title-overlay">
        <span className="app-title">Kick Up Counter</span>
      </div>
    </div>
  )
}

export default App
