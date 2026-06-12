<script setup lang="ts">
import { computed } from 'vue'
import type { Folder } from '~/composables/useMusic'
import { useMusic, folderMatchesQuery } from '~/composables/useMusic'

const props = defineProps<{ folder: Folder; depth: number }>()

const {
  expanded,
  currentTrack,
  isPlaying,
  scopeFolder,
  query,
  toggleExpand,
  playTrack,
  playFolder,
  toggleFavorite,
  isFavorite,
} = useMusic()

const q = computed(() => query.value.trim().toLowerCase())
const nameMatch = computed(() => !!q.value && props.folder.name.toLowerCase().includes(q.value))
// While searching, force-open so matches are visible.
const isOpen = computed(() => (q.value ? true : expanded.has(props.folder.path)))
const isScope = computed(() => scopeFolder.value?.path === props.folder.path)
const fav = computed(() => isFavorite(props.folder.path))

const visibleChildren = computed(() =>
  !q.value || nameMatch.value
    ? props.folder.children
    : props.folder.children.filter((c) => folderMatchesQuery(c, q.value)),
)
const visibleTracks = computed(() =>
  !q.value || nameMatch.value
    ? props.folder.tracks
    : props.folder.tracks.filter((t) => t.name.toLowerCase().includes(q.value)),
)
</script>

<template>
  <div class="node">
    <div
      class="folder-row"
      :class="{ scope: isScope }"
      :style="{ paddingLeft: `${depth * 16 + 10}px` }"
      role="button"
      tabindex="0"
      @click="toggleExpand(folder.path)"
      @keydown.enter="toggleExpand(folder.path)"
    >
      <AppIcon name="chevron" :size="16" class="chev" :class="{ open: isOpen }" />
      <AppIcon name="folder" :size="17" class="folder-ic" />
      <span class="folder-name">{{ folder.name }}</span>

      <div v-if="folder.trackCount" class="folder-actions">
        <button
          class="fbtn star"
          :class="{ on: fav }"
          :title="fav ? 'Aus Szenen entfernen' : 'Als Szene merken'"
          @click.stop="toggleFavorite(folder)"
        >
          <AppIcon :name="fav ? 'star' : 'starOff'" :size="14" />
        </button>
        <button class="fbtn" title="Ordner der Reihe nach abspielen" @click.stop="playFolder(folder, false)">
          <AppIcon name="play" :size="13" />
        </button>
        <button class="fbtn" title="Ordner zufällig abspielen" @click.stop="playFolder(folder, true)">
          <AppIcon name="shuffle" :size="14" />
        </button>
      </div>

      <span class="count">{{ folder.trackCount }}</span>
    </div>

    <div v-show="isOpen" class="children">
      <FolderNode
        v-for="child in visibleChildren"
        :key="child.path"
        :folder="child"
        :depth="depth + 1"
      />

      <button
        v-for="track in visibleTracks"
        :key="track.id"
        class="track-row"
        :class="{ active: currentTrack?.id === track.id }"
        :style="{ paddingLeft: `${(depth + 1) * 16 + 12}px` }"
        @click="playTrack(track)"
      >
        <span class="track-ic">
          <span v-if="currentTrack?.id === track.id && isPlaying" class="bars" aria-hidden="true">
            <i /><i /><i />
          </span>
          <AppIcon v-else name="note" :size="15" />
        </span>
        <span class="track-name">{{ track.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.folder-row,
.track-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  text-align: left;
  padding: 7px 12px 7px 10px;
  border-radius: var(--radius-sm);
  color: var(--text);
  transition: background 0.12s ease;
}
.folder-row:hover,
.track-row:hover {
  background: var(--surface-2);
}
.folder-row {
  cursor: pointer;
}
.folder-row.scope {
  background: var(--accent-glow);
}
.folder-row.scope .folder-ic,
.folder-row.scope .folder-name {
  color: var(--accent);
}

/* Per-folder actions (revealed on hover) */
.folder-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.folder-row:hover .folder-actions,
.folder-row.scope .folder-actions,
.folder-row:focus-visible .folder-actions {
  opacity: 1;
}
.fbtn {
  width: 27px;
  height: 27px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--muted);
  transition: color 0.12s ease, background 0.12s ease, transform 0.1s ease;
}
.fbtn:hover {
  color: var(--accent);
  background: var(--surface-3);
}
.fbtn:active {
  transform: scale(0.92);
}
.fbtn.star.on {
  opacity: 1;
  color: var(--accent);
}
/* A favourited folder keeps its star visible even when not hovered */
.folder-actions:has(.star.on) {
  opacity: 1;
}
.folder-row:not(:hover):not(.scope) .folder-actions:has(.star.on) .fbtn:not(.star) {
  opacity: 0;
  pointer-events: none;
}

.chev {
  color: var(--faint);
  flex-shrink: 0;
  transition: transform 0.18s ease;
}
.chev.open {
  transform: rotate(90deg);
}
.folder-ic {
  color: var(--accent-soft);
  flex-shrink: 0;
}
.folder-name {
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.count {
  margin-left: auto;
  font-size: 11px;
  color: var(--faint);
  background: var(--surface-2);
  padding: 1px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}

.track-ic {
  width: 16px;
  display: inline-flex;
  justify-content: center;
  color: var(--faint);
  flex-shrink: 0;
}
.track-name {
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-row:hover .track-name {
  color: var(--text);
}
.track-row.active .track-name {
  color: var(--accent);
  font-weight: 550;
}
.track-row.active .track-ic {
  color: var(--accent);
}

/* Animated equalizer bars for the playing track */
.bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 13px;
}
.bars i {
  width: 2px;
  background: var(--accent);
  border-radius: 2px;
  animation: eq 0.9s ease-in-out infinite;
}
.bars i:nth-child(1) {
  height: 40%;
  animation-delay: -0.2s;
}
.bars i:nth-child(2) {
  height: 100%;
  animation-delay: -0.5s;
}
.bars i:nth-child(3) {
  height: 65%;
  animation-delay: -0.8s;
}
@keyframes eq {
  0%,
  100% {
    transform: scaleY(0.35);
  }
  50% {
    transform: scaleY(1);
  }
}
</style>
