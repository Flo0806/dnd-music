<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useMusic, folderMatchesQuery } from '~/composables/useMusic'

const {
  rootFolder,
  rootName,
  scanning,
  error,
  supported,
  canReconnect,
  hasLibrary,
  random,
  query,
  scenes,
  crossfadeEnabled,
  crossfadeSec,
  isPlaying,
  currentTrack,
  init,
  pickFolder,
  reconnect,
  playAll,
  playTrack,
  playFolder,
  togglePlay,
  next,
  prev,
  skip,
  nudgeVolume,
  toggleRandom,
  cycleLoop,
  setQuery,
  setCrossfade,
  setCrossfadeSec,
  collapseAll,
  expandAll,
} = useMusic()

const searchInput = ref<HTMLInputElement | null>(null)

const q = computed(() => query.value.trim().toLowerCase())
const filteredChildren = computed(() => {
  const r = rootFolder.value
  if (!r) return []
  return q.value ? r.children.filter((c) => folderMatchesQuery(c, q.value)) : r.children
})
const filteredRootTracks = computed(() => {
  const r = rootFolder.value
  if (!r) return []
  return q.value ? r.tracks.filter((t) => t.name.toLowerCase().includes(q.value)) : r.tracks
})
const noResults = computed(
  () => hasLibrary.value && !!q.value && !filteredChildren.value.length && !filteredRootTracks.value.length,
)

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
    if (e.key === 'Escape') t.blur()
    return
  }
  switch (e.key) {
    case ' ':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      e.preventDefault()
      e.shiftKey ? prev() : skip(-10)
      break
    case 'ArrowRight':
      e.preventDefault()
      e.shiftKey ? next(false) : skip(10)
      break
    case 'ArrowUp':
      e.preventDefault()
      nudgeVolume(0.05)
      break
    case 'ArrowDown':
      e.preventDefault()
      nudgeVolume(-0.05)
      break
    case 'r':
    case 'R':
      toggleRandom()
      break
    case 'l':
    case 'L':
      cycleLoop()
      break
    case '/':
      e.preventDefault()
      searchInput.value?.focus()
      break
  }
}

onMounted(() => {
  init()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo"><AppIcon name="music" :size="18" /></span>
        <div class="brand-text">
          <h1>D&amp;D Music</h1>
          <span v-if="hasLibrary" class="lib-name">{{ rootName }}</span>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="hasLibrary"
          class="btn ghost"
          :class="{ on: random }"
          title="Zufallswiedergabe (R)"
          @click="toggleRandom"
        >
          <AppIcon name="shuffle" :size="16" />
          <span>{{ random ? 'Zufall' : 'Der Reihe nach' }}</span>
        </button>
        <button v-if="hasLibrary" class="btn primary" title="Leertaste" @click="playAll">
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="16" />
          <span>{{ isPlaying ? 'Pause' : currentTrack ? 'Weiter' : 'Alles abspielen' }}</span>
        </button>
        <button class="btn ghost" @click="pickFolder">
          <AppIcon name="folder" :size="16" />
          <span>{{ hasLibrary ? 'Ordner wechseln' : 'Ordner wählen' }}</span>
        </button>
      </div>
    </header>

    <!-- Toolbar: search · scenes · crossfade · collapse -->
    <div v-if="hasLibrary" class="toolbar">
      <label class="search">
        <AppIcon name="search" :size="15" />
        <input
          ref="searchInput"
          :value="query"
          type="text"
          placeholder="Suchen …  ( / )"
          @input="setQuery(($event.target as HTMLInputElement).value)"
        />
        <button v-if="query" class="clear" title="Leeren" @click="setQuery('')">
          <AppIcon name="close" :size="13" />
        </button>
      </label>

      <div v-if="scenes.length" class="scenes">
        <button
          v-for="s in scenes"
          :key="s.path"
          class="scene"
          :title="`Szene abspielen: ${s.name}`"
          @click="playFolder(s, random)"
        >
          <AppIcon name="star" :size="12" />
          <span>{{ s.name }}</span>
        </button>
      </div>

      <div class="tools">
        <button
          class="btn ghost compact"
          :class="{ on: crossfadeEnabled }"
          title="Sanftes Überblenden zwischen Songs"
          @click="setCrossfade(!crossfadeEnabled)"
        >
          <AppIcon name="crossfade" :size="16" />
          <span>Überblenden</span>
        </button>
        <div v-if="crossfadeEnabled" class="xsec" title="Überblendzeit">
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            :value="crossfadeSec"
            @input="setCrossfadeSec(Number(($event.target as HTMLInputElement).value))"
          />
          <span>{{ crossfadeSec }}s</span>
        </div>
        <span class="divider" />
        <button class="iconbtn" title="Alle einklappen" @click="collapseAll">
          <AppIcon name="collapse" :size="16" />
        </button>
        <button class="iconbtn" title="Alle ausklappen" @click="expandAll">
          <AppIcon name="expand" :size="16" />
        </button>
      </div>
    </div>

    <main class="content">
      <!-- Library tree -->
      <div v-if="hasLibrary && rootFolder" class="library">
        <FolderNode
          v-for="child in filteredChildren"
          :key="child.path"
          :folder="child"
          :depth="0"
        />
        <button
          v-for="track in filteredRootTracks"
          :key="track.id"
          class="root-track"
          :class="{ active: currentTrack?.id === track.id }"
          @click="playTrack(track)"
        >
          <AppIcon name="note" :size="15" />
          <span>{{ track.name }}</span>
        </button>

        <p v-if="noResults" class="no-results">Nichts gefunden für „{{ query }}“.</p>
      </div>

      <!-- Empty / welcome state -->
      <div v-else class="empty">
        <div v-if="scanning" class="empty-inner">
          <div class="spinner" />
          <p>Lese deine Musik …</p>
        </div>

        <div v-else class="empty-inner">
          <span class="hero-logo"><AppIcon name="music" :size="34" /></span>
          <h2>Deine Musikbibliothek</h2>
          <p class="lead">
            Wähle einen Ordner. Die Unterordner werden als aufklappbare Listen
            angezeigt — Song anklicken oder „Alles abspielen“ drücken.
          </p>

          <div class="empty-actions">
            <button v-if="canReconnect" class="btn primary big" @click="reconnect">
              <AppIcon name="folder" :size="18" />
              <span>Zuletzt genutzten Ordner öffnen</span>
            </button>
            <button class="btn big" :class="canReconnect ? 'ghost' : 'primary'" @click="pickFolder">
              <AppIcon name="folder" :size="18" />
              <span>Ordner wählen</span>
            </button>
          </div>

          <p v-if="!supported" class="warn">
            Hinweis: Die Ordnerauswahl funktioniert nur in Chromium-Browsern
            (Chrome, Edge, Brave).
          </p>
        </div>
      </div>
    </main>

    <transition name="fade">
      <div v-if="error" class="toast" @click="error = null">{{ error }}</div>
    </transition>

    <PlayerBar />
  </div>
</template>

<style scoped>
.app {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  overflow: hidden;
}

/* Top bar */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface), var(--bg));
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: #18120a;
  background: linear-gradient(145deg, var(--accent), var(--accent-soft));
}
.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
h1 {
  font-size: 16px;
  margin: 0;
  letter-spacing: 0.2px;
}
.lib-name {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.actions {
  display: flex;
  gap: 9px;
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 550;
  white-space: nowrap;
  transition: background 0.13s ease, color 0.13s ease, transform 0.1s ease;
}
.btn:active {
  transform: translateY(1px);
}
.btn.ghost {
  background: var(--surface-2);
  color: var(--text);
}
.btn.ghost:hover {
  background: var(--surface-3);
}
.btn.ghost.on {
  color: var(--accent);
}
.btn.primary {
  background: var(--accent);
  color: #18120a;
}
.btn.primary:hover {
  background: #e3b572;
}
.btn.big {
  padding: 12px 20px;
  font-size: 14px;
}
.btn.compact {
  padding: 7px 11px;
  font-size: 12.5px;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-wrap: wrap;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 0 10px;
  height: 36px;
  width: 260px;
  color: var(--faint);
  transition: border-color 0.13s ease;
}
.search:focus-within {
  border-color: var(--accent-soft);
}
.search input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 13px;
}
.search .clear {
  display: grid;
  place-items: center;
  color: var(--faint);
}
.search .clear:hover {
  color: var(--text);
}

.scenes {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.scene {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
  transition: background 0.12s ease, transform 0.1s ease;
}
.scene :deep(svg) {
  color: var(--accent);
}
.scene:hover {
  background: var(--surface-3);
}
.scene:active {
  transform: translateY(1px);
}

.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.xsec {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.xsec input[type='range'] {
  width: 76px;
}
.divider {
  width: 1px;
  height: 22px;
  background: var(--border);
}
.iconbtn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  color: var(--muted);
  background: var(--surface-2);
  transition: color 0.12s ease, background 0.12s ease;
}
.iconbtn:hover {
  color: var(--text);
  background: var(--surface-3);
}

/* Content */
.content {
  overflow-y: auto;
  padding: 14px 16px 22px;
}
.library {
  max-width: 880px;
  margin: 0 auto;
}
.root-track {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--muted);
}
.root-track:hover {
  background: var(--surface-2);
  color: var(--text);
}
.root-track.active {
  color: var(--accent);
  font-weight: 550;
}
.no-results {
  color: var(--faint);
  text-align: center;
  padding: 32px 0;
}

/* Empty state */
.empty {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
}
.empty-inner {
  text-align: center;
  max-width: 440px;
}
.hero-logo {
  display: inline-grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border-radius: 22px;
  margin-bottom: 18px;
  color: var(--accent);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 0 60px var(--accent-glow);
}
.empty h2 {
  margin: 0 0 10px;
  font-size: 22px;
}
.lead {
  color: var(--muted);
  margin: 0 0 24px;
  line-height: 1.6;
}
.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.empty-actions .btn {
  justify-content: center;
  min-width: 240px;
}
.warn {
  margin-top: 22px;
  font-size: 12.5px;
  color: var(--accent-soft);
}

.spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto 16px;
  border-radius: 50%;
  border: 3px solid var(--surface-3);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.empty-inner p {
  color: var(--muted);
}

/* Toast */
.toast {
  position: fixed;
  bottom: calc(var(--player-h) + 16px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface-3);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 12px 18px;
  border-radius: var(--radius);
  font-size: 13px;
  max-width: 90vw;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  z-index: 50;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
