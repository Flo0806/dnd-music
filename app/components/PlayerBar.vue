<script setup lang="ts">
import { computed } from 'vue'
import { useMusic } from '~/composables/useMusic'

const {
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  random,
  loopMode,
  togglePlay,
  next,
  prev,
  seek,
  skip,
  setVolume,
  toggleRandom,
  cycleLoop,
} = useMusic()

const loopTitle = computed(() =>
  loopMode.value === 'folder'
    ? 'Wiederholen: nur dieser Ordner'
    : loopMode.value === 'one'
      ? 'Wiederholen: ein Song'
      : 'Durchspielen: alle Ordner',
)

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const progress = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0,
)
const volPct = computed(() => volume.value * 100)

function onSeek(e: Event) {
  seek(Number((e.target as HTMLInputElement).value))
}
function onVol(e: Event) {
  setVolume(Number((e.target as HTMLInputElement).value))
}
function toggleMute() {
  setVolume(volume.value > 0 ? 0 : 0.8)
}
</script>

<template>
  <footer class="player">
    <!-- Now playing -->
    <div class="now">
      <div class="art" :class="{ spinning: isPlaying }">
        <AppIcon name="music" :size="22" />
      </div>
      <div class="meta" v-if="currentTrack">
        <div class="title">{{ currentTrack.name }}</div>
        <div class="sub">{{ currentTrack.folderPath }}</div>
      </div>
      <div class="meta" v-else>
        <div class="title idle">Nichts ausgewählt</div>
        <div class="sub">Wähle einen Song oder drücke Play</div>
      </div>
    </div>

    <!-- Transport + seek -->
    <div class="center">
      <div class="controls">
        <button
          class="ctl"
          :class="{ on: random }"
          title="Zufallswiedergabe"
          @click="toggleRandom"
        >
          <AppIcon name="shuffle" :size="18" />
        </button>
        <button class="ctl" title="Zurück" @click="prev">
          <AppIcon name="prev" :size="20" />
        </button>
        <button class="ctl skip" title="10s zurück" @click="skip(-10)">
          <span class="skip-num">10</span>
          <AppIcon name="prev" :size="13" />
        </button>
        <button class="play" :title="isPlaying ? 'Pause' : 'Play'" @click="togglePlay">
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="22" />
        </button>
        <button class="ctl skip" title="10s vor" @click="skip(10)">
          <AppIcon name="next" :size="13" />
          <span class="skip-num">10</span>
        </button>
        <button class="ctl" title="Weiter" @click="next(false)">
          <AppIcon name="next" :size="20" />
        </button>
        <button
          class="ctl"
          :class="{ on: loopMode !== 'all' }"
          :title="loopTitle"
          @click="cycleLoop"
        >
          <AppIcon :name="loopMode === 'one' ? 'loopOne' : loopMode === 'folder' ? 'repeatFolder' : 'loop'" :size="18" />
        </button>
      </div>

      <div class="seek">
        <span class="time">{{ fmt(currentTime) }}</span>
        <input
          type="range"
          min="0"
          :max="duration || 0"
          step="0.1"
          :value="currentTime"
          :disabled="!duration"
          :style="{ background: `linear-gradient(to right, var(--accent) ${progress}%, var(--surface-3) ${progress}%)` }"
          @input="onSeek"
        />
        <span class="time">{{ fmt(duration) }}</span>
      </div>
    </div>

    <!-- Volume -->
    <div class="volume">
      <button class="ctl" :title="volume > 0 ? 'Stumm' : 'Ton an'" @click="toggleMute">
        <AppIcon :name="volume > 0 ? 'volume' : 'mute'" :size="19" />
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="volume"
        :style="{ background: `linear-gradient(to right, var(--accent) ${volPct}%, var(--surface-3) ${volPct}%)` }"
        @input="onVol"
      />
    </div>
  </footer>
</template>

<style scoped>
.player {
  height: var(--player-h);
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: grid;
  grid-template-columns: 1fr minmax(360px, 1.4fr) 1fr;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
}

/* Now playing */
.now {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}
.art {
  width: 50px;
  height: 50px;
  border-radius: var(--radius);
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: #1a1206;
  background: linear-gradient(145deg, var(--accent), var(--accent-soft));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}
.art.spinning :deep(svg) {
  animation: spin 6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.meta {
  min-width: 0;
}
.title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title.idle {
  color: var(--muted);
  font-weight: 500;
}
.sub {
  font-size: 12px;
  color: var(--faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Center transport */
.center {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.ctl {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--muted);
  transition: color 0.12s ease, background 0.12s ease;
}
.ctl:hover {
  color: var(--text);
  background: var(--surface-2);
}
.ctl.on {
  color: var(--accent);
}
.ctl.on:hover {
  background: var(--accent-glow);
}
.ctl.spacer {
  pointer-events: none;
}
.skip {
  width: auto;
  padding: 0 8px;
  gap: 1px;
  border-radius: 18px;
}
.skip-num {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.play {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #18120a;
  background: var(--accent);
  margin: 0 4px;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  box-shadow: 0 0 0 0 var(--accent-glow);
}
.play:hover {
  transform: scale(1.06);
  box-shadow: 0 0 0 6px var(--accent-glow);
}
.play :deep(svg) {
  margin-left: 1px;
}

.seek {
  display: flex;
  align-items: center;
  gap: 10px;
}
.time {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--faint);
  width: 36px;
  flex-shrink: 0;
}
.seek .time:last-child {
  text-align: right;
}

/* Volume */
.volume {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}
.volume input[type='range'] {
  max-width: 120px;
}

@media (max-width: 760px) {
  .player {
    grid-template-columns: 1fr;
    height: auto;
    padding: 12px 16px;
    gap: 10px;
  }
  .volume {
    display: none;
  }
}
</style>
