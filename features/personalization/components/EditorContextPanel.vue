<script setup lang="ts">
import { computed } from 'vue'
import type { ProductEditor } from '../composables/useProductEditor'
import type { ImageFilterName } from '../types/editor'
import { EDITOR_COLORS, EDITOR_FONTS } from '../config/products'

const props = defineProps<{ editor: ProductEditor }>()

const sel = computed(() => props.editor.selection.value)
const text = computed(() => sel.value.text)

const FILTERS: { value: ImageFilterName, label: string }[] = [
  { value: 'none', label: 'Original' },
  { value: 'grayscale', label: 'B/N' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'bright', label: 'Brillo' }
]

const isBold = computed(() => {
  const w = text.value?.fontWeight
  return w === 'bold' || Number(w) >= 600
})
</script>

<template>
  <div class="panel">
    <div
      v-if="sel.count === 0"
      class="text-body-2 text-medium-emphasis pa-2"
    >
      Selecciona un elemento del diseño para editarlo, o agrega texto, imágenes y stickers.
    </div>

    <template v-else>
      <!-- Texto -->
      <section
        v-if="text"
        class="panel__section"
      >
        <h4 class="panel__title">
          Texto
        </h4>
        <p class="text-caption text-medium-emphasis mb-2">
          Doble clic sobre el texto para escribir.
        </p>
        <v-select
          :model-value="text.fontFamily"
          :items="EDITOR_FONTS"
          label="Fuente"
          density="compact"
          hide-details
          class="mb-3"
          @update:model-value="(v: string) => editor.updateText({ fontFamily: v })"
        />
        <div class="text-caption mb-1">
          Tamaño: {{ Math.round(text.fontSize) }}
        </div>
        <v-slider
          :model-value="text.fontSize"
          :min="16"
          :max="Math.round(editor.template.width * 0.25)"
          :step="1"
          hide-details
          color="primary"
          @end="(v: number) => editor.updateText({ fontSize: v })"
        />
        <div class="d-flex ga-2 my-3">
          <v-btn
            :variant="isBold ? 'flat' : 'tonal'"
            :color="isBold ? 'primary' : undefined"
            icon="mdi-format-bold"
            size="small"
            aria-label="Negrita"
            @click="editor.updateText({ fontWeight: isBold ? 'normal' : '700' })"
          />
          <v-btn-toggle
            :model-value="text.textAlign"
            density="compact"
            variant="tonal"
            mandatory
            @update:model-value="(v: string) => editor.updateText({ textAlign: v })"
          >
            <v-btn
              value="left"
              icon="mdi-format-align-left"
              aria-label="Alinear a la izquierda"
            />
            <v-btn
              value="center"
              icon="mdi-format-align-center"
              aria-label="Centrar"
            />
            <v-btn
              value="right"
              icon="mdi-format-align-right"
              aria-label="Alinear a la derecha"
            />
          </v-btn-toggle>
        </div>
        <div class="swatches">
          <button
            v-for="c in EDITOR_COLORS"
            :key="c"
            type="button"
            class="swatch"
            :class="{ 'swatch--active': text.fill.toLowerCase() === c.toLowerCase() }"
            :style="{ background: c }"
            :aria-label="`Color ${c}`"
            @click="editor.updateText({ fill: c })"
          />
          <label
            class="swatch swatch--picker"
            aria-label="Otro color"
          >
            <v-icon
              icon="mdi-eyedropper"
              size="16"
            />
            <input
              type="color"
              :value="text.fill"
              @change="(e) => editor.updateText({ fill: (e.target as HTMLInputElement).value })"
            >
          </label>
        </div>
      </section>

      <!-- Imagen -->
      <section
        v-if="sel.kind === 'image'"
        class="panel__section"
      >
        <h4 class="panel__title">
          Filtro
        </h4>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="f in FILTERS"
            :key="f.value"
            :color="sel.filter === f.value ? 'primary' : undefined"
            :variant="sel.filter === f.value ? 'flat' : 'tonal'"
            @click="editor.applyFilter(f.value)"
          >
            {{ f.label }}
          </v-chip>
        </div>
      </section>

      <!-- Comunes -->
      <section class="panel__section">
        <h4 class="panel__title">
          Elemento
        </h4>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-content-duplicate"
            @click="editor.duplicateSelected()"
          >
            Duplicar
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-image-filter-center-focus"
            @click="editor.centerSelected()"
          >
            Centrar
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-arrange-bring-forward"
            @click="editor.bringForward()"
          >
            Adelante
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-arrange-send-backward"
            @click="editor.sendBackward()"
          >
            Atrás
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            color="error"
            prepend-icon="mdi-delete-outline"
            @click="editor.removeSelected()"
          >
            Eliminar
          </v-btn>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel__section + .panel__section {
  border-top: 1px solid var(--nt-border);
  padding-top: 16px;
}

.panel__title {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--nt-text-secondary);
  margin-bottom: 8px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--nt-border);
  cursor: pointer;
  transition: transform var(--nt-transition-fast);
}

.swatch:hover {
  transform: scale(1.1);
}

.swatch--active {
  border-color: var(--nt-accent);
  box-shadow: var(--nt-focus-ring);
}

.swatch--picker {
  display: grid;
  place-items: center;
  background: var(--nt-surface-elevated);
  overflow: hidden;
}

.swatch--picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
