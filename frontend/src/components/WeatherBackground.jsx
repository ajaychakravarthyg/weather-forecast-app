import { useEffect, useMemo, useRef } from 'react'

import { moonPhase, skyPosition } from '../utils/celestial'

/**
 * Animated, live weather scene rendered to a full-viewport canvas.
 *
 * Driven by real measurements rather than just the condition name:
 *  - wind speed sets how far rain slants and how fast clouds drift
 *  - precipitation scales the raindrop count
 *  - cloud cover controls cloud density and dims the sun/moon/stars behind it
 *  - the sun rides the location's actual sunrise→sunset arc, peaking at solar noon
 *  - at night the moon is drawn at its true phase for today's date, so a full
 *    moon really is a full disc and a crescent really is a crescent
 *
 * Performance:
 *  - Particles are stroked in a few batched paths per frame, not one call each.
 *  - Delta-time driven, so speed is frame-rate independent.
 *  - Stops completely when the tab is hidden.
 *  - `prefers-reduced-motion` draws a single static frame instead of animating.
 */

// Per-condition weather effects. Sun, moon and stars are handled separately —
// they depend on time of day, not on the weather.
const SCENES = {
  clear: { motes: 26 },
  'mainly-clear': { clouds: 3, motes: 18 },
  cloudy: { clouds: 7 },
  fog: { fog: 6, clouds: 3 },
  drizzle: { rain: 190, dropLen: [7, 14], dropAlpha: 0.28, clouds: 5 },
  rain: { rain: 420, dropLen: [12, 26], dropAlpha: 0.4, clouds: 6, ripples: true },
  showers: { rain: 340, dropLen: [11, 22], dropAlpha: 0.36, clouds: 6, ripples: true },
  freezing: { rain: 160, dropLen: [8, 15], dropAlpha: 0.3, snow: 60, clouds: 5 },
  snow: { snow: 190, clouds: 5 },
  thunderstorm: {
    rain: 560,
    dropLen: [14, 30],
    dropAlpha: 0.45,
    clouds: 8,
    lightning: true,
    ripples: true,
  },
}

const rand = (min, max) => min + Math.random() * (max - min)
const TAU = Math.PI * 2

export default function WeatherBackground({
  group = 'cloudy',
  isDay = true,
  windSpeed = 0,
  precipitation = 0,
  cloudCover = 0,
  sunrise = null,
  sunset = null,
  timeZone = null,
}) {
  const canvasRef = useRef(null)

  // Bucket the live values so ordinary data refreshes don't re-seed the scene.
  const windBucket = Math.round(Math.min(windSpeed, 80) / 8)
  const precipBucket = Math.min(Math.round(precipitation * 2), 12)
  const cloudBucket = Math.round(Math.min(cloudCover, 100) / 20)

  const scene = useMemo(() => SCENES[group] ?? SCENES.cloudy, [group])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let raf = 0
    let lastTime = 0
    let clock = 0

    let drops = []
    let flakes = []
    let cloudPuffs = []
    let starField = []
    let motes = []
    let fogBands = []
    let ripples = []
    let shootingStar = null
    let nextShootingStar = rand(4, 12)

    // Pre-rendered sprites. Clouds and the sun's ray fan are identical every
    // frame apart from position/rotation/alpha, so drawing them once into an
    // offscreen canvas turns dozens of arcs and gradient allocations per frame
    // into a couple of drawImage calls — the difference shows on low-end mobile.
    let cloudSprite = null
    let raySprite = null
    let glowCache = null

    const CLOUD_PUFFS = [
      { dx: 0, dy: 0, r: 92 },
      { dx: 74, dy: 12, r: 66 },
      { dx: -74, dy: 16, r: 60 },
      { dx: 34, dy: -26, r: 58 },
      { dx: -34, dy: -20, r: 52 },
    ]

    const flash = { alpha: 0, bolt: null, timer: rand(1.5, 4), stage: 0 }

    // How much the sky is obscured: 0 = clear, 1 = fully overcast.
    const overcast = Math.min(1, cloudCover / 100)
    // Fog hides the sky almost entirely.
    const skyClarity = Math.max(0, 1 - overcast * 0.85) * (scene.fog ? 0.25 : 1)

    // Moon phase is fixed for the day, so compute it once.
    const moon = moonPhase(new Date())

    // Sun/moon arc position, refreshed occasionally rather than every frame
    // (Intl formatting isn't free, and the sun moves slowly).
    let sky = skyPosition(new Date(), { sunrise, sunset, timeZone })
    let skyAge = 0

    const windDrift = Math.min(windSpeed, 90) * 2.6
    const slant = Math.max(-0.55, Math.min(0.55, windSpeed / 90))

    // ---------------------------------------------------------------- seed --- #
    function seed() {
      const area = (width * height) / (1440 * 900)
      const scale = Math.max(0.35, Math.min(1.4, area))

      const rainCount = scene.rain ? Math.round(scene.rain * scale * (1 + precipitation * 0.12)) : 0
      drops = Array.from({ length: rainCount }, () => makeDrop())

      const snowCount = scene.snow ? Math.round(scene.snow * scale) : 0
      flakes = Array.from({ length: snowCount }, () => makeFlake())

      const cloudCount = Math.round((scene.clouds ?? 0) * (1 + overcast * 0.8))
      cloudPuffs = Array.from({ length: cloudCount }, (_, i) => makeCloud(i, cloudCount))

      // Stars appear on any clear-ish night, thinning out under cloud.
      const starCount = isDay ? 0 : Math.round(130 * scale * skyClarity)
      starField = Array.from({ length: starCount }, makeStar)

      motes = isDay && scene.motes ? Array.from({ length: Math.round(scene.motes * scale) }, makeMote) : []
      fogBands = scene.fog ? Array.from({ length: scene.fog }, (_, i) => makeFogBand(i, scene.fog)) : []
      ripples = []

      buildCloudSprite()
      buildRaySprite()
      glowCache = null
    }

    /** One cloud blob, rendered at the largest scale in play and drawn scaled down. */
    function buildCloudSprite() {
      cloudSprite = null
      if (!cloudPuffs.length) return
      const maxScale = cloudPuffs.reduce((max, c) => Math.max(max, c.scale), 1)
      const w = Math.ceil((92 + 74) * 2 * maxScale + 24)
      const h = Math.ceil((92 + 26) * 2 * maxScale + 24)
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const octx = off.getContext('2d')
      const tint = isDay ? '232, 240, 255' : '147, 166, 200'
      // Each puff is a radial gradient rather than a flat disc, so the cloud has
      // a soft translucent edge instead of a hard outline.
      for (const p of CLOUD_PUFFS) {
        const cx = w / 2 + p.dx * maxScale
        const cy = h / 2 + p.dy * maxScale
        const r = p.r * maxScale
        const grad = octx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r)
        grad.addColorStop(0, `rgba(${tint}, 0.85)`)
        grad.addColorStop(0.55, `rgba(${tint}, 0.42)`)
        grad.addColorStop(1, `rgba(${tint}, 0)`)
        octx.fillStyle = grad
        octx.beginPath()
        octx.arc(cx, cy, r, 0, TAU)
        octx.fill()
      }
      cloudSprite = { canvas: off, w, h, scale: maxScale }
    }

    /** The sun's 12-ray fan, drawn once and then just rotated each frame. */
    function buildRaySprite() {
      raySprite = null
      if (!isDay) return
      // Half resolution: these are soft gradients, so upscaling is invisible.
      const size = 512
      const off = document.createElement('canvas')
      off.width = size
      off.height = size
      const octx = off.getContext('2d')
      const r = size / 2
      octx.translate(r, r)
      for (let i = 0; i < 12; i += 1) {
        octx.rotate(TAU / 12)
        const ray = octx.createLinearGradient(0, 0, r * 0.95, 0)
        ray.addColorStop(0, 'rgba(255, 233, 186, 1)')
        ray.addColorStop(1, 'rgba(255, 233, 186, 0)')
        octx.fillStyle = ray
        octx.beginPath()
        octx.moveTo(0, 0)
        octx.lineTo(r * 0.95, -r * 0.045)
        octx.lineTo(r * 0.95, r * 0.045)
        octx.closePath()
        octx.fill()
      }
      raySprite = off
    }

    function makeDrop(atTop = false) {
      const [minLen, maxLen] = scene.dropLen ?? [10, 20]
      const depth = Math.random() // 0 = far, 1 = near
      return {
        x: rand(-0.2 * width, 1.2 * width),
        y: atTop ? rand(-height * 0.2, 0) : rand(0, height),
        len: rand(minLen, maxLen) * (0.6 + depth * 0.7),
        speed: rand(680, 1150) * (0.55 + depth * 0.75),
        width: 0.7 + depth * 1.0,
      }
    }

    function makeFlake(atTop = false) {
      const depth = Math.random()
      return {
        x: rand(0, width),
        y: atTop ? rand(-height * 0.15, 0) : rand(0, height),
        r: rand(1.1, 2.9) * (0.6 + depth * 0.8),
        speed: rand(28, 78) * (0.5 + depth * 0.8),
        sway: rand(14, 42),
        swaySpeed: rand(0.35, 1.05),
        phase: rand(0, TAU),
        alpha: rand(0.4, 0.9) * (0.5 + depth * 0.6),
      }
    }

    function makeCloud(index, total) {
      const depth = index / Math.max(1, total - 1)
      return {
        x: rand(-0.25 * width, 1.1 * width),
        y: rand(-0.02 * height, 0.42 * height),
        scale: rand(0.75, 1.9) * (0.7 + depth * 0.6),
        speed: rand(5, 20) * (0.5 + depth),
        alpha: rand(0.05, 0.14),
      }
    }

    function makeStar() {
      return {
        x: rand(0, width),
        y: rand(0, height * 0.78),
        r: rand(0.5, 1.5),
        base: rand(0.25, 0.8),
        amp: rand(0.1, 0.45),
        speed: rand(0.4, 1.9),
        phase: rand(0, TAU),
      }
    }

    function makeMote() {
      return {
        x: rand(0, width),
        y: rand(0, height),
        r: rand(0.6, 1.9),
        speed: rand(6, 20),
        drift: rand(-9, 9),
        alpha: rand(0.08, 0.24),
        phase: rand(0, TAU),
      }
    }

    function makeFogBand(index, total) {
      return {
        y: (index / total) * height + rand(-30, 30),
        h: rand(70, 190),
        x: rand(-width, 0),
        speed: rand(8, 26) * (index % 2 === 0 ? 1 : -1),
        alpha: rand(0.03, 0.085),
      }
    }

    // -------------------------------------------------------------- resize --- #
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    // -------------------------------------------------------------- update --- #
    function update(dt) {
      clock += dt

      skyAge += dt
      if (skyAge > 20) {
        sky = skyPosition(new Date(), { sunrise, sunset, timeZone })
        skyAge = 0
      }

      for (const d of drops) {
        d.y += d.speed * dt
        d.x += windDrift * dt
        if (d.y - d.len > height) {
          Object.assign(d, makeDrop(true))
        } else if (d.x < -0.3 * width || d.x > 1.3 * width) {
          d.x = d.x < 0 ? 1.25 * width : -0.25 * width
        }
      }

      if (scene.ripples && ripples.length < 40 && Math.random() < dt * 26) {
        ripples.push({ x: rand(0, width), y: height - rand(0, 26), r: 0, life: 0, max: rand(0.45, 0.9) })
      }
      ripples = ripples.filter((r) => {
        r.life += dt
        r.r = (r.life / r.max) * 14
        return r.life < r.max
      })

      for (const f of flakes) {
        f.y += f.speed * dt
        f.x += Math.sin(clock * f.swaySpeed + f.phase) * f.sway * dt + windDrift * 0.25 * dt
        if (f.y - f.r > height) Object.assign(f, makeFlake(true))
        if (f.x < -20) f.x = width + 10
        if (f.x > width + 20) f.x = -10
      }

      for (const c of cloudPuffs) {
        c.x += (c.speed + windDrift * 0.12) * dt
        const span = 300 * c.scale
        if (c.x - span > width) c.x = -span
      }

      for (const m of motes) {
        m.y -= m.speed * dt
        m.x += Math.sin(clock * 0.5 + m.phase) * m.drift * dt
        if (m.y + m.r < 0) {
          m.y = height + m.r
          m.x = rand(0, width)
        }
      }

      for (const b of fogBands) {
        b.x += b.speed * dt
        if (b.x > width) b.x = -width
        if (b.x < -width) b.x = width
      }

      if (starField.length) {
        nextShootingStar -= dt
        if (!shootingStar && nextShootingStar <= 0) {
          shootingStar = {
            x: rand(0, width * 0.7),
            y: rand(0, height * 0.35),
            vx: rand(420, 700),
            vy: rand(120, 240),
            life: 0,
            max: 0.85,
          }
          nextShootingStar = rand(6, 18)
        }
        if (shootingStar) {
          shootingStar.life += dt
          shootingStar.x += shootingStar.vx * dt
          shootingStar.y += shootingStar.vy * dt
          if (shootingStar.life > shootingStar.max) shootingStar = null
        }
      }

      if (scene.lightning) {
        flash.timer -= dt
        if (flash.timer <= 0 && flash.stage === 0) {
          flash.stage = 1
          flash.alpha = rand(0.5, 0.9)
          flash.bolt = makeBolt()
          flash.timer = 0.09
        } else if (flash.stage === 1 && flash.timer <= 0) {
          flash.stage = 2
          flash.alpha = rand(0.25, 0.6)
          flash.timer = 0.07
        } else if (flash.stage === 2 && flash.timer <= 0) {
          flash.stage = 0
          flash.bolt = null
          flash.timer = rand(2.2, 7.5)
        }
        flash.alpha = Math.max(0, flash.alpha - dt * (flash.stage === 0 ? 5 : 3.2))
      }
    }

    /** A jagged bolt with a couple of branches. */
    function makeBolt() {
      const startX = rand(width * 0.15, width * 0.85)
      const endY = rand(height * 0.42, height * 0.72)
      const segments = Math.round(rand(7, 12))
      const points = [{ x: startX, y: -20 }]
      for (let i = 1; i <= segments; i += 1) {
        const prev = points[i - 1]
        points.push({ x: prev.x + rand(-46, 46), y: prev.y + (endY + 20) / segments })
      }
      const branches = []
      for (let b = 0; b < Math.round(rand(1, 3)); b += 1) {
        const from = points[Math.round(rand(2, points.length - 2))]
        const branch = [from]
        for (let i = 1; i <= 4; i += 1) {
          const prev = branch[i - 1]
          branch.push({ x: prev.x + rand(-40, 40), y: prev.y + rand(18, 44) })
        }
        branches.push(branch)
      }
      return { points, branches }
    }

    // ---------------------------------------------------------------- draw --- #
    function drawPolyline(points) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
      ctx.stroke()
    }

    /**
     * The lit portion of the moon for a given phase.
     *
     * Built from the outer limb (a semicircle) plus the terminator (a half
     * ellipse whose width is r·|cos(2πphase)|). That degenerates correctly at
     * both extremes: a straight line at the quarters, and the full circle at
     * full moon. Waning phases are the mirror image, so we flip and reuse it.
     */
    function drawLitMoon(cx, cy, r, phase) {
      const cosA = Math.cos(TAU * phase)
      const waning = phase > 0.5
      ctx.save()
      if (waning) {
        ctx.translate(cx, cy)
        ctx.scale(-1, 1)
        ctx.translate(-cx, -cy)
      }
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false)
      ctx.ellipse(cx, cy, r * Math.abs(cosA), r, 0, Math.PI / 2, -Math.PI / 2, cosA > 0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    /**
     * Shared sun/moon placement: swept horizontally by time of day, held inside
     * the sky band the layout keeps clear between the header and the search bar.
     */
    function arcPosition() {
      return {
        x: width * (0.12 + sky.progress * 0.76),
        y: height * (0.085 + (1 - sky.altitude) * 0.05),
      }
    }

    /** Celestial radius, trimmed on narrow screens so it stays proportionate. */
    function bodyRadius() {
      return Math.max(17, Math.min(28, width * 0.021))
    }

    function drawSun() {
      // East to west across the day, highest at solar noon. The horizontal sweep
      // carries time-of-day; vertical travel is small and confined to the open
      // sky band the layout reserves below the header (see .container's top
      // padding), since the literal horizon sits behind the dashboard cards.
      const { x, y } = arcPosition()
      const strength = skyClarity * (0.55 + sky.altitude * 0.45)
      if (strength <= 0.02) return

      const radius = Math.max(width, height) * 0.34

      // The glow only changes when the arc position refreshes (every ~20s), so
      // rebuild the gradient on that cadence rather than 60 times a second.
      const key = `${x | 0}:${y | 0}:${strength.toFixed(2)}`
      if (!glowCache || glowCache.key !== key) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
        glow.addColorStop(0, `rgba(255, 226, 160, ${0.34 * strength})`)
        glow.addColorStop(0.35, `rgba(255, 198, 121, ${0.14 * strength})`)
        glow.addColorStop(1, 'rgba(255, 190, 110, 0)')
        glowCache = { key, glow }
      }
      ctx.fillStyle = glowCache.glow
      ctx.fillRect(0, 0, width, height)

      // The disc itself, warmer and larger near the horizon. Built as a gradient
      // that fades out at the rim so it reads as a soft luminous body rather
      // than a flat sticker pasted on the sky.
      const discR = bodyRadius() + (1 - sky.altitude) * 8
      const core = sky.altitude > 0.35 ? '255, 244, 210' : '255, 208, 138'
      const disc = ctx.createRadialGradient(x, y, 0, x, y, discR * 1.5)
      disc.addColorStop(0, `rgba(${core}, ${0.85 * strength})`)
      disc.addColorStop(0.6, `rgba(${core}, ${0.45 * strength})`)
      disc.addColorStop(1, `rgba(${core}, 0)`)
      ctx.fillStyle = disc
      ctx.beginPath()
      ctx.arc(x, y, discR * 1.5, 0, TAU)
      ctx.fill()

      // Slowly rotating soft rays — one drawImage of the cached fan.
      if (raySprite) {
        ctx.save()
        ctx.globalAlpha = 0.13 * strength
        ctx.translate(x, y)
        ctx.rotate(clock * 0.045)
        ctx.drawImage(raySprite, -radius, -radius, radius * 2, radius * 2)
        ctx.restore()
      }
    }

    function drawMoon() {
      // Same open-sky band as the sun (see arcPosition).
      const { x, y } = arcPosition()
      const strength = skyClarity * (0.6 + sky.altitude * 0.4)
      if (strength <= 0.02) return

      const r = bodyRadius()
      // Halo, brighter the fuller the moon.
      const haloR = 150 + moon.illumination * 90
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR)
      halo.addColorStop(0, `rgba(214, 228, 255, ${(0.1 + moon.illumination * 0.2) * strength})`)
      halo.addColorStop(1, 'rgba(214, 228, 255, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(x, y, haloR, 0, TAU)
      ctx.fill()

      // Earthshine: the unlit disc stays faintly visible.
      ctx.globalAlpha = 0.08 * strength
      ctx.fillStyle = '#8fa4c8'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()

      // The lit crescent/gibbous/full disc. Kept translucent so it sits in the
      // sky rather than on top of it — but still crisp enough to read the phase.
      ctx.globalAlpha = Math.min(0.82, strength * 0.9)
      ctx.fillStyle = '#eef3ff'
      drawLitMoon(x, y, r, moon.phase)

      // A few maria, only worth drawing when most of the disc is lit.
      if (moon.illumination > 0.55) {
        ctx.globalAlpha = 0.1 * strength
        ctx.fillStyle = '#9fb0cc'
        // Offsets are expressed against a 27px disc, so scale with the radius.
        const k = r / 27
        for (const spot of [
          { dx: -8, dy: -7, r: 6.5 },
          { dx: 7, dy: 4, r: 5 },
          { dx: -3, dy: 10, r: 4 },
        ]) {
          ctx.beginPath()
          ctx.arc(x + spot.dx * k, y + spot.dy * k, spot.r * k, 0, TAU)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      // ---- stars ----
      for (const s of starField) {
        const alpha = (s.base + Math.sin(clock * s.speed + s.phase) * s.amp) * skyClarity
        ctx.globalAlpha = Math.max(0.03, Math.min(1, alpha))
        ctx.fillStyle = '#eaf2ff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (shootingStar) {
        const fade = 1 - shootingStar.life / shootingStar.max
        const tailX = shootingStar.x - shootingStar.vx * 0.12
        const tailY = shootingStar.y - shootingStar.vy * 0.12
        const grad = ctx.createLinearGradient(tailX, tailY, shootingStar.x, shootingStar.y)
        grad.addColorStop(0, 'rgba(234,242,255,0)')
        grad.addColorStop(1, `rgba(234,242,255,${0.85 * fade * skyClarity})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        drawPolyline([
          { x: tailX, y: tailY },
          { x: shootingStar.x, y: shootingStar.y },
        ])
      }

      // ---- the sun or the moon, on its arc ----
      if (isDay) drawSun()
      else drawMoon()

      // ---- clouds (drawn over the sky so they occlude it) ----
      if (cloudSprite) {
        for (const c of cloudPuffs) {
          ctx.globalAlpha = c.alpha
          const ratio = c.scale / cloudSprite.scale
          const w = cloudSprite.w * ratio
          const h = cloudSprite.h * ratio
          ctx.drawImage(cloudSprite.canvas, c.x - w / 2, c.y - h / 2, w, h)
        }
        ctx.globalAlpha = 1
      }

      // ---- fog ----
      for (const b of fogBands) {
        const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
        grad.addColorStop(0, 'rgba(200, 214, 236, 0)')
        grad.addColorStop(0.5, `rgba(200, 214, 236, ${b.alpha})`)
        grad.addColorStop(1, 'rgba(200, 214, 236, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(b.x, b.y, width * 2, b.h)
      }

      // ---- dust motes ----
      for (const m of motes) {
        ctx.globalAlpha = m.alpha
        ctx.fillStyle = '#fff6e0'
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ---- rain, batched into a few stroked paths ----
      if (drops.length) {
        ctx.lineCap = 'round'
        ctx.strokeStyle = `rgba(186, 214, 255, ${scene.dropAlpha ?? 0.35})`
        for (const bucket of [0.8, 1.3, 1.8]) {
          ctx.beginPath()
          let drew = false
          for (const d of drops) {
            if (Math.abs(d.width - bucket) > 0.28) continue
            ctx.moveTo(d.x, d.y)
            ctx.lineTo(d.x - d.len * slant, d.y - d.len)
            drew = true
          }
          if (drew) {
            ctx.lineWidth = bucket
            ctx.stroke()
          }
        }
      }

      // ---- splash ripples ----
      for (const r of ripples) {
        const fade = 1 - r.life / r.max
        ctx.strokeStyle = `rgba(190, 218, 255, ${0.3 * fade})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, TAU)
        ctx.stroke()
      }

      // ---- snow ----
      for (const f of flakes) {
        ctx.globalAlpha = f.alpha
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ---- lightning ----
      if (scene.lightning && flash.alpha > 0.001) {
        if (flash.bolt) {
          ctx.strokeStyle = `rgba(232, 240, 255, ${Math.min(1, flash.alpha + 0.25)})`
          ctx.lineWidth = 2.4
          ctx.lineCap = 'round'
          ctx.shadowColor = 'rgba(190, 214, 255, 0.9)'
          ctx.shadowBlur = 18
          drawPolyline(flash.bolt.points)
          ctx.lineWidth = 1.2
          for (const branch of flash.bolt.branches) drawPolyline(branch)
          ctx.shadowBlur = 0
        }
        const grad = ctx.createLinearGradient(0, 0, 0, height)
        grad.addColorStop(0, `rgba(214, 230, 255, ${flash.alpha * 0.5})`)
        grad.addColorStop(1, `rgba(214, 230, 255, ${flash.alpha * 0.08})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }
    }

    // ---------------------------------------------------------------- loop --- #
    function frame(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      update(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }

    function start() {
      if (raf) return
      lastTime = performance.now()
      raf = requestAnimationFrame(frame)
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    function onVisibility() {
      if (document.hidden) stop()
      else if (!reduceMotion) start()
    }

    resize()

    if (reduceMotion) {
      update(0)
      draw()
    } else {
      start()
    }

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [
    scene,
    isDay,
    windBucket,
    precipBucket,
    cloudBucket,
    windSpeed,
    precipitation,
    cloudCover,
    sunrise,
    sunset,
    timeZone,
  ])

  return <canvas ref={canvasRef} className="weather-canvas" aria-hidden="true" />
}
