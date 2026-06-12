// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Pure client-side app: relies on browser-only APIs (File System Access, <audio>)
  ssr: false,
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'D&D Music',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' },
      ],
    },
  },
})
