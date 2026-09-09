export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devtools: {
    enabled: true
  },

  modules: [
    'vuetify-nuxt-module',
    '@nuxt/eslint'
  ],

  css: [
    '@mdi/font/css/materialdesignicons.css',
    '~/assets/css/main.css'
  ],

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
