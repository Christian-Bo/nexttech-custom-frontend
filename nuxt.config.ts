export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devtools: {
    enabled: true
  },

  modules: [
    'vuetify-nuxt-module',
    '@pinia/nuxt',
    '@nuxt/eslint'
  ],

  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/500.css',
    '@fontsource/inter/600.css',
    '@fontsource/inter/700.css',
    '@mdi/font/css/materialdesignicons.css',
    '~/assets/css/tokens.css',
    '~/assets/css/base.css'
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'NextTech Custom',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0F172A' },
        { name: 'color-scheme', content: 'dark' }
      ]
    }
  },

  vuetify: {
    vuetifyOptions: {
      theme: {
        defaultTheme: 'nexttech',
        themes: {
          nexttech: {
            dark: true,
            colors: {
              'background': '#0F172A',
              'surface': '#1E293B',
              'surface-light': '#334155',
              'primary': '#2563EB',
              'primary-darken-1': '#1D4ED8',
              'secondary': '#06B6D4',
              'accent': '#06B6D4',
              'info': '#06B6D4',
              'success': '#22C55E',
              'warning': '#F59E0B',
              'error': '#EF4444',
              'on-background': '#F8FAFC',
              'on-surface': '#F8FAFC',
              'on-surface-variant': '#CBD5E1'
            },
            variables: {
              'border-color': '#475569',
              'border-opacity': 1
            }
          }
        }
      }
    }
  },

  typescript: {
    strict: true,
    typeCheck: false
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080'
    }
  }
})
