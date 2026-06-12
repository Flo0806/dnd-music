<script setup lang="ts">
defineProps<{ name: keyof typeof paths; size?: number }>()

const paths = {
  play: '<path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  next: '<path d="M6 5.14v13.72a1 1 0 0 0 1.5.86l9-5.61V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v3.89l-9-5.61A1 1 0 0 0 6 5.14Z"/>',
  prev: '<path d="M18 5.14v13.72a1 1 0 0 1-1.5.86l-9-5.61V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v3.89l9-5.61a1 1 0 0 1 1.5.86Z"/>',
  forward: '<path d="M4 5.14v13.72a1 1 0 0 0 1.5.86l9-5.61V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v3.89l-9-5.61A1 1 0 0 0 4 5.14Z" transform="translate(2 0)"/>',
  shuffle: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M21 3l-7.5 7.5M16 21h5v-5M21 21l-6-6M3 4l4 4M3 20l13-13"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
  chevron: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6"/>',
  note: '<path d="M9 17.5a3.5 3.5 0 1 1-2-3.16V4l11-2v11.5a3.5 3.5 0 1 1-2-3.16V4.4L9 5.9v11.6Z"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m16 9 5 6M21 9l-5 6"/>',
  music: '<path d="M9 17.5a3.5 3.5 0 1 1-2-3.16V4l11-2v11.5a3.5 3.5 0 1 1-2-3.16V4.4L9 5.9v11.6Z"/>',
  loop: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
  loopOne: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/></g><text x="12" y="15.5" font-size="9" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">1</text>',
  repeatFolder: '<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5H8l2 2h7.5A1.5 1.5 0 0 1 19 9.5v8A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5v-10Z"/><path d="M8.5 14.2a3 3 0 0 1 5-2.1l1.2 1.1"/><path d="M14.8 11.1v2.3h-2.3"/><path d="M13.5 14.6a3 3 0 0 1-5 2.1L7.3 15.6"/><path d="M7.2 17.7v-2.3h2.3"/></g>',
  star: '<path d="m12 2.5 2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.5l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5Z"/>',
  starOff: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="m12 2.5 2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.5l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5Z"/>',
  search: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4"/>',
  close: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/>',
  crossfade: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h4l3 8h4M3 16h4l3-8h4"/><path d="m18 5 3 3-3 3M18 13l3 3-3 3"/></g>',
  collapse: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m7 11 5-5 5 5M7 18l5-5 5 5"/>',
  expand: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m7 13 5 5 5-5M7 6l5 5 5-5"/>',
} as const
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    v-html="paths[name]"
  />
</template>
