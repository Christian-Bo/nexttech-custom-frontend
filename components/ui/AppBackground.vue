<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Fondo animado de la marca: red de partículas (azul/cian) con resplandores suaves.
 * - Queda detrás de todo y no recibe clics.
 * - Menos partículas en celular; se pausa con la pestaña oculta.
 * - Con "reducir movimiento" del sistema se dibuja una sola vez, sin animación.
 */
const props = withDefaults(defineProps<{
  /** Intensidad del fondo: 'soft' para pantallas de trabajo, 'full' para portada/presentación. */
  intensity?: 'soft' | 'full'
}>(), { intensity: 'soft' })

const canvas = ref<HTMLCanvasElement | null>(null)

interface Particle { x: number, y: number, vx: number, vy: number, r: number, accent: boolean }

const BLUE = '59, 130, 246'
const CYAN = '6, 182, 212'
const LINK_DISTANCE = 140

let particles: Particle[] = []
let width = 0
let height = 0
let frame = 0
let running = false
let reduceMotion = false

function particleCount(): number {
  const base = Math.round((width * height) / 14_000)
  const max = props.intensity === 'full' ? 110 : 80
  return Math.max(18, Math.min(max, base))
}

function createParticle(): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 1.6 + 0.8,
    accent: Math.random() > 0.72
  }
}

function resize(): void {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)

  const target = particleCount()
  while (particles.length < target) particles.push(createParticle())
  particles.length = target
  for (const p of particles) {
    p.x = Math.min(p.x, width)
    p.y = Math.min(p.y, height)
  }
  if (reduceMotion) draw(false)
}

function draw(move = true): void {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const alpha = props.intensity === 'full' ? 1 : 0.8
  ctx.clearRect(0, 0, width, height)

  for (const p of particles) {
    if (move) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > width) p.vx *= -1
      if (p.y < 0 || p.y > height) p.vy *= -1
    }
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${p.accent ? CYAN : BLUE}, ${0.85 * alpha})`
    ctx.fill()
  }

  ctx.lineWidth = 0.6
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i]!
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j]!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.hypot(dx, dy)
      if (d < LINK_DISTANCE) {
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = `rgba(${BLUE}, ${(1 - d / LINK_DISTANCE) * 0.35 * alpha})`
        ctx.stroke()
      }
    }
  }
}

function loop(): void {
  if (!running) return
  draw()
  frame = requestAnimationFrame(loop)
}

function start(): void {
  if (running || reduceMotion) return
  running = true
  frame = requestAnimationFrame(loop)
}

function stop(): void {
  running = false
  cancelAnimationFrame(frame)
}

function onVisibility(): void {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  if (reduceMotion) draw(false)
  else start()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div
    class="nt-bg"
    :class="`nt-bg--${intensity}`"
    aria-hidden="true"
  >
    <div class="nt-bg__glow nt-bg__glow--a" />
    <div class="nt-bg__glow nt-bg__glow--b" />
    <canvas
      ref="canvas"
      class="nt-bg__canvas"
    />
  </div>
</template>

<style scoped>
.nt-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.nt-bg__canvas {
  position: absolute;
  inset: 0;
}

.nt-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  animation: nt-drift 18s ease-in-out infinite alternate;
}

.nt-bg__glow--a {
  width: 520px;
  height: 520px;
  top: -160px;
  left: -140px;
  background: rgb(37 99 235 / 22%);
}

.nt-bg__glow--b {
  width: 460px;
  height: 460px;
  right: -120px;
  bottom: -160px;
  background: rgb(6 182 212 / 14%);
  animation-delay: -9s;
}

.nt-bg--soft .nt-bg__glow {
  opacity: 0.7;
}

@keyframes nt-drift {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(60px, 40px) scale(1.12); }
}

@media (prefers-reduced-motion: reduce) {
  .nt-bg__glow { animation: none; }
}
</style>
