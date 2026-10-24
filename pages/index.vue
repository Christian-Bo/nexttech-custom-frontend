<script setup lang="ts">
import { homeFor } from '~/utils/authRedirect'
useHead({ title: 'NextTech Custom | Diseña tu llavero personalizado' })
const auth = useAuthStore()
const authOpen = useState<boolean>('nt-landing-auth-open', () => false)
const authMode = useState<'login' | 'register'>('nt-landing-auth-mode', () => 'login')
const side = ref<'A' | 'B'>('A')
const primaryCta = computed(() => auth.isInternal
  ? { text:'Ir a mi panel', to:homeFor(auth.actorType, auth.role), icon:'mdi-view-dashboard-outline' }
  : { text:'Diseñar mi llavero', to:'/catalogo', icon:'mdi-palette-outline' })
function openAuth(mode: 'login' | 'register') { authMode.value = mode; authOpen.value = true }
</script>

<template>
  <main>
    <section class="landing-hero">
      <v-container class="landing-hero__grid">
        <div class="landing-hero__copy">
          <div class="landing-hero__eyebrow"><v-icon icon="mdi-auto-fix" size="small" /> TU ESTILO, TU LLAVERO</div>
          <h1>Un llavero <span>único</span>, diseñado por ti.</h1>
          <p class="landing-hero__lead">Personaliza ambos lados con tus fotos, frases y diseños favoritos. Nosotros lo hacemos realidad.</p>
          <div class="landing-hero__actions">
            <v-btn color="primary" size="x-large" variant="flat" class="text-none landing-hero__main-button" :to="primaryCta.to" :prepend-icon="primaryCta.icon">{{ primaryCta.text }} <v-icon end icon="mdi-arrow-right" /></v-btn>
            <v-btn v-if="!auth.isAuthenticated" variant="outlined" size="large" class="text-none" prepend-icon="mdi-login" @click="openAuth('login')">Ingresar</v-btn>
            <v-btn v-else-if="auth.isBuyer" to="/mis-pedidos" variant="outlined" size="large" class="text-none" prepend-icon="mdi-package-variant-closed">Mis pedidos</v-btn>
          </div>
          <p v-if="!auth.isAuthenticated" class="landing-hero__signup">¿Aún no tienes cuenta? <button type="button" @click="openAuth('register')">Créala aquí</button></p>
          <div class="landing-hero__benefits"><span><v-icon icon="mdi-pencil-ruler" /> Diseña a tu gusto</span><span><v-icon icon="mdi-autorenew" /> Dos lados</span><span><v-icon icon="mdi-map-marker-check-outline" /> Entrega en campus</span></div>
        </div>
        <div class="landing-hero__showcase">
          <div class="landing-hero__halo" aria-hidden="true" />
          <div class="keychain__ring" aria-hidden="true" />
          <div class="keychain" :class="{ 'keychain--flipped': side === 'B' }" aria-label="Vista previa de un llavero personalizado">
            <div class="keychain__face keychain__face--a" :aria-hidden="side !== 'A'"><span class="keychain__hole" /><v-icon icon="mdi-account-circle-outline" size="94" /><strong>Tu mejor recuerdo</strong><small>Diseño · Lado A</small></div>
            <div class="keychain__face keychain__face--b" :aria-hidden="side !== 'B'"><span class="keychain__hole" /><v-icon icon="mdi-star-four-points" size="34" /><strong>¡Mi momento!</strong><small>Tu mensaje · Lado B</small></div>
          </div>
          <div class="landing-hero__switch"><span>Explora ambos lados</span><v-btn-toggle v-model="side" mandatory variant="outlined" color="accent" density="comfortable" rounded="lg" aria-label="Elegir lado del llavero"><v-btn value="A" class="text-none">Lado A</v-btn><v-btn value="B" class="text-none">Lado B</v-btn></v-btn-toggle></div>
        </div>
      </v-container>
    </section>
    <section class="landing-how" aria-label="Cómo funciona"><v-container class="landing-how__inner"><div v-for="item in [{icon:'mdi-palette-outline',title:'Diseña',subtitle:'Personaliza tu llavero'},{icon:'mdi-check-circle-outline',title:'Confirma',subtitle:'Haz tu pedido'},{icon:'mdi-package-variant-closed-check',title:'Recibe',subtitle:'En el campus'}]" :key="item.title" class="landing-how__item"><v-icon :icon="item.icon" size="30" /><div><strong>{{ item.title }}</strong><span>{{ item.subtitle }}</span></div></div></v-container></section>
    <LandingAuthDialog v-model="authOpen" :initial-mode="authMode" />
  </main>
</template>

<style scoped>
.landing-hero { min-height:min(740px,calc(100svh - 64px)); display:flex; align-items:center; border-bottom:1px solid var(--nt-border); position:relative; overflow:hidden; }
.landing-hero__grid { max-width:1200px; display:grid; grid-template-columns:1.08fr .92fr; gap:4rem; align-items:center; padding-block:54px; }
.landing-hero__eyebrow { display:inline-flex; gap:8px; align-items:center; letter-spacing:.13em; font-weight:800; font-size:.77rem; color:var(--nt-accent); margin-bottom:20px; }
.landing-hero__copy h1 { max-width:670px; font-size:clamp(2.7rem,5.3vw,4.65rem); letter-spacing:-.05em; line-height:1.06; font-weight:850; }
.landing-hero__copy h1 span { color:var(--nt-accent); }
.landing-hero__lead { color:var(--nt-text-secondary); max-width:520px; font-size:clamp(1rem,1.5vw,1.16rem); line-height:1.65; margin-top:20px; }
.landing-hero__actions { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:30px; }
.landing-hero__main-button { font-weight:700; }
.landing-hero__signup { margin-top:13px; color:var(--nt-text-secondary); font-size:.91rem; }
.landing-hero__signup button { color:var(--nt-accent); text-decoration:underline; text-underline-offset:3px; font-weight:700; }
.landing-hero__benefits { display:flex; flex-wrap:wrap; gap:11px 19px; color:var(--nt-text-secondary); font-size:.82rem; margin-top:30px; }
.landing-hero__benefits span { display:flex; align-items:center; gap:5px; }
.landing-hero__benefits :deep(.v-icon) { color:var(--nt-accent); font-size:17px; }
.landing-hero__showcase { min-height:430px; display:flex; flex-direction:column; justify-content:center; align-items:center; position:relative; isolation:isolate; }
.landing-hero__halo { position:absolute; width:min(470px,95%); aspect-ratio:1; border-radius:50%; background:radial-gradient(circle,color-mix(in srgb,var(--nt-accent) 18%,transparent),transparent 66%); z-index:-1; animation:halo 6s ease-in-out infinite alternate; }
.keychain__ring { width:52px; height:52px; border:9px solid #aebdd1; border-radius:50%; margin-bottom:-13px; box-shadow:0 4px 12px #0005; }
.keychain { width:240px; height:300px; position:relative; transform-style:preserve-3d; transition:transform .7s cubic-bezier(.2,.75,.25,1); filter:drop-shadow(0 22px 25px #0007); }
.keychain--flipped { transform:rotateY(180deg); }
.keychain__face { position:absolute; inset:0; backface-visibility:hidden; border:7px solid #c8e9f0a6; border-radius:23px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:13px; text-align:center; background:linear-gradient(140deg,var(--nt-primary),var(--nt-surface-elevated)); box-shadow:inset 0 0 0 2px #ffffff22; padding:18px; }
.keychain__face--b { transform:rotateY(180deg); background:linear-gradient(140deg,var(--nt-surface-elevated),var(--nt-primary)); }
.keychain__face strong { font-size:1.22rem; }
.keychain__face small { color:var(--nt-text-secondary); }
.keychain__face :deep(.v-icon) { color:var(--nt-accent); }
.keychain__hole { position:absolute; top:11px; width:17px; height:17px; background:var(--nt-bg); border:4px solid #c9dbe7; border-radius:50%; }
.landing-hero__switch { margin-top:22px; display:flex; align-items:center; flex-direction:column; gap:10px; color:var(--nt-text-secondary); font-size:.8rem; }
.landing-how { border-top:1px solid var(--nt-border); background:color-mix(in srgb,var(--nt-surface) 55%,transparent); }
.landing-how__inner { max-width:1150px; display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding-block:26px; }
.landing-how__item { display:flex; align-items:center; gap:14px; padding:12px 18px; }
.landing-how__item :deep(.v-icon) { color:var(--nt-accent); }
.landing-how__item div { display:flex; flex-direction:column; gap:2px; }
.landing-how__item span { color:var(--nt-text-secondary); font-size:.82rem; }
@keyframes halo { from { opacity:.55; transform:scale(.88); } to { opacity:1; transform:scale(1.12); } }
@media(max-width:959px) { .landing-hero__grid { grid-template-columns:1fr; gap:12px; padding-block:25px 28px; } .landing-hero__copy h1 { max-width:580px; font-size:clamp(2rem,6.3vw,3.2rem); } .landing-hero__lead { margin-top:12px; } .landing-hero__actions { margin-top:20px; } .landing-hero__benefits { margin-top:16px; } .landing-hero__showcase { min-height:290px; } .keychain { width:146px; height:182px; } .keychain__ring { width:32px; height:32px; border-width:6px; margin-bottom:-8px; } .keychain__face { gap:5px; border-width:4px; border-radius:14px; } .keychain__face :deep(.v-icon) { font-size:52px !important; } .keychain__face strong { font-size:.85rem; } .keychain__face small { font-size:.68rem; } .keychain__hole { width:11px; height:11px; top:5px; border-width:2px; } .landing-hero__switch { margin-top:12px; gap:6px; } }
@media(max-width:599px) { .landing-hero__grid { padding-inline:16px; } .landing-hero__eyebrow { font-size:.68rem; margin-bottom:12px; } .landing-hero__copy h1 { font-size:clamp(1.9rem,7.4vw,2.6rem); } .landing-hero__lead { font-size:.92rem; line-height:1.5; } .landing-hero__actions .v-btn { flex:1 1 auto; min-height:45px; font-size:.85rem; } .landing-hero__benefits { font-size:.72rem; gap:8px 12px; } .landing-hero__showcase { min-height:255px; } .landing-how__inner { padding:10px 16px; gap:4px; } .landing-how__item { flex-direction:column; gap:5px; padding:10px 2px; text-align:center; } .landing-how__item div { gap:2px; } .landing-how__item strong { font-size:.83rem; } .landing-how__item span { font-size:.68rem; } }
@media(prefers-reduced-motion:reduce) { .landing-hero__halo { animation:none; } .keychain { transition:none; } }
</style>
