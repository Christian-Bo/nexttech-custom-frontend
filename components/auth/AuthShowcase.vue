<script setup lang="ts">
/**
 * Vitrina del negocio para el panel izquierdo del login/registro:
 * llaveros que giran mostrando Lado A y Lado B, stickers flotando y los 3 pasos del servicio.
 * Solo CSS (sin librerías); respeta "reducir movimiento".
 */
const FEATURES = [
  { icon: 'mdi-palette-outline', title: 'Diseña los dos lados', text: 'Tu foto, filtros, texto y stickers en el Lado A y el Lado B.' },
  { icon: 'mdi-timer-sand', title: 'Listo en minutos', text: 'Lo elaboramos al momento y ves cada paso en tiempo real.' },
  { icon: 'mdi-map-marker-radius-outline', title: 'Recíbelo en el campus', text: 'Elige dónde te lo entregamos y paga al recibir.' }
]
const PRODUCTS = ['Llaveros acrílicos', 'Llaveros metálicos', 'Photocards', 'Imanes']
</script>

<template>
  <div class="show">
    <!-- Escena: productos girando -->
    <div
      class="scene"
      aria-hidden="true"
    >
      <span class="sticker sticker--1">⭐</span>
      <span class="sticker sticker--2">😎</span>
      <span class="sticker sticker--3">🎓</span>
      <span class="sticker sticker--4">💙</span>

      <div class="piece piece--circle">
        <div class="piece__inner">
          <div class="face face--a">
            <span class="hole" />
            <v-icon
              icon="mdi-account-circle"
              size="58"
            />
            <span class="face__label">Lado A</span>
          </div>
          <div class="face face--b">
            <span class="hole" />
            <span class="face__text">Promo<br>2027</span>
            <span class="face__label">Lado B</span>
          </div>
        </div>
      </div>

      <div class="piece piece--square">
        <div class="piece__inner">
          <div class="face face--a face--alt">
            <span class="hole" />
            <v-icon
              icon="mdi-heart"
              size="44"
            />
            <span class="face__label">Lado A</span>
          </div>
          <div class="face face--b">
            <span class="hole" />
            <span class="face__text face__text--sm">NextTech</span>
            <span class="face__label">Lado B</span>
          </div>
        </div>
      </div>
    </div>

    <ul class="products">
      <li
        v-for="p in PRODUCTS"
        :key="p"
      >
        {{ p }}
      </li>
    </ul>

    <ul class="features">
      <li
        v-for="f in FEATURES"
        :key="f.title"
      >
        <span class="features__icon"><v-icon
          :icon="f.icon"
          size="20"
        /></span>
        <div>
          <div class="features__title">
            {{ f.title }}
          </div>
          <div class="features__text">
            {{ f.text }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.show {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ---------- Escena ---------- */
.scene {
  position: relative;
  height: 250px;
  perspective: 900px;
}

.piece {
  position: absolute;
  animation: float 6s ease-in-out infinite;
}

.piece--circle {
  left: 8%;
  top: 18px;
  width: 170px;
  height: 170px;
}

.piece--square {
  left: 52%;
  top: 60px;
  width: 140px;
  height: 140px;
  animation-delay: -3s;
}

.piece__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  animation: flip 8s ease-in-out infinite;
}

.piece--square .piece__inner {
  animation-delay: -4s;
}

.face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #fff;
  backface-visibility: hidden;
  box-shadow: 0 24px 48px -24px rgb(0 0 0 / 80%), 0 0 40px -12px rgb(37 99 235 / 70%);
}

.piece--circle .face {
  border-radius: 50%;
}

.piece--square .face {
  border-radius: 26px;
}

.face--a {
  background: linear-gradient(160deg, #3b82f6, #1e40af);
}

.face--alt {
  background: linear-gradient(160deg, #06b6d4, #2563eb);
}

.face--b {
  transform: rotateY(180deg);
  background: linear-gradient(160deg, #334155, #1e293b);
  border: 1px solid rgb(148 163 184 / 40%);
}

.face__label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
}

.face__text {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  background: linear-gradient(120deg, #f8fafc, #67e8f9);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.face__text--sm {
  font-size: 1.15rem;
}

.hole {
  position: absolute;
  top: 12px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--nt-bg);
  box-shadow: inset 0 0 0 2px rgb(148 163 184 / 50%);
}

.sticker {
  position: absolute;
  font-size: 1.7rem;
  filter: drop-shadow(0 6px 10px rgb(0 0 0 / 40%));
  animation: bob 5s ease-in-out infinite;
}

.sticker--1 { left: 2%; top: 0; }
.sticker--2 { left: 44%; top: 8px; animation-delay: -1.2s; }
.sticker--3 { left: 86%; top: 40px; animation-delay: -2.4s; }
.sticker--4 { left: 36%; top: 196px; animation-delay: -3.6s; }

/* ---------- Productos ---------- */
.products {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.products li {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--nt-text-secondary);
  border: 1px solid rgb(148 163 184 / 30%);
  background: rgb(15 23 42 / 45%);
}

/* ---------- Beneficios ---------- */
.features {
  display: grid;
  gap: 14px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.features li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.features__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--nt-accent);
  background: rgb(6 182 212 / 12%);
  border: 1px solid rgb(6 182 212 / 30%);
}

.features__title {
  font-weight: 700;
}

.features__text {
  font-size: 0.875rem;
  color: var(--nt-text-secondary);
}

@keyframes flip {
  0%, 40% { transform: rotateY(0deg); }
  50%, 90% { transform: rotateY(180deg); }
  100% { transform: rotateY(360deg); }
}

@keyframes float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -12px; }
}

@keyframes bob {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-10px) rotate(6deg); }
}

@media (prefers-reduced-motion: reduce) {
  .piece,
  .piece__inner,
  .sticker {
    animation: none;
  }
}
</style>
