# NextTech Custom Frontend

Proyecto base para comenzar el desarrollo del frontend.

## Tecnologías

- Nuxt 3
- Vue 3
- TypeScript
- Vuetify 3

## Ejecutar

```bash
npm install
npm run dev
```

Luego abrir:

```text
http://localhost:3000
```

## API

La URL del backend se define en `.env`:

```text
NUXT_PUBLIC_API_BASE=http://localhost:8080
```

## Estructura

```text
assets/
components/
composables/
features/
layouts/
middleware/
pages/
plugins/
public/
services/
stores/
types/
utils/
```

Las carpetas están vacías intencionalmente para que el equipo implemente
la arquitectura y funcionalidades del proyecto.

## Git

Flujo recomendado:

```text
feature/* -> develop -> main
```
