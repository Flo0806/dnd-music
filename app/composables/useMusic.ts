import { markRaw, reactive, shallowRef, ref, computed } from 'vue'

// --- Types -----------------------------------------------------------------

export interface Track {
  id: string
  name: string // display name (file name without extension)
  fileName: string
  handle: FileSystemFileHandle
  folderPath: string
}

export interface Folder {
  id: string
  name: string
  path: string // unique relative path from root
  tracks: Track[]
  children: Folder[]
  trackCount: number // total tracks including descendants
}

export type LoopMode = 'queue' | 'track' | 'off'

const AUDIO_EXT = new Set([
  'mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'oga', 'opus', 'wma', 'webm', 'mp4', 'aif', 'aiff',
])

// --- Minimal IndexedDB key/value store (to remember the chosen folder) ------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dnd-music', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  const result = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly')
    const req = tx.objectStore('kv').get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

// --- Module-level singleton state ------------------------------------------

const rootFolder = shallowRef<Folder | null>(null)
const rootName = ref<string>('')
const scanning = ref(false)
const error = ref<string | null>(null)
const supported = ref(true)
const canReconnect = ref(false)

const expanded = reactive(new Set<string>())
const favorites = reactive(new Set<string>())
const query = ref('')

const random = ref(false)
const loopMode = ref<LoopMode>('queue')
const crossfadeEnabled = ref(true)
const crossfadeSec = ref(4)

const scopeFolder = shallowRef<Folder | null>(null)
const currentTrack = shallowRef<Track | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)

// Flattened play order, rebuilt on scan / scope / random toggle.
let playOrder: Track[] = []
const currentIndex = ref(-1)

let rootHandle: FileSystemDirectoryHandle | null = null

// Dual-channel audio engine (for crossfading).
const players: HTMLAudioElement[] = []
const urls: (string | null)[] = [null, null]
const fadeTimers = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>()
let activeChannel = 0
let crossfading = false
let pendingSeek = 0 // playback position to restore once metadata is available
let lastTimeSave = 0

const clamp = (v: number) => Math.max(0, Math.min(1, v))

// --- Per-library persistence in localStorage (folders + favorites + song) ---

interface SavedState {
  expanded?: string[]
  favorites?: string[]
  trackId?: string
  time?: number
}

function stateKey(): string | null {
  return rootName.value ? `dnd-music:state:${rootName.value}` : null
}

function loadState(): SavedState | null {
  const key = stateKey()
  if (!key) return null
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function saveState(patch: SavedState) {
  const key = stateKey()
  if (!key) return
  try {
    const cur = loadState() ?? {}
    localStorage.setItem(key, JSON.stringify({ ...cur, ...patch }))
  } catch {
    /* storage may be full or blocked — non-critical */
  }
}

// Global (cross-library) settings.
function saveSettings() {
  try {
    localStorage.setItem(
      'dnd-music:settings',
      JSON.stringify({
        volume: volume.value,
        random: random.value,
        loopMode: loopMode.value,
        crossfadeEnabled: crossfadeEnabled.value,
        crossfadeSec: crossfadeSec.value,
      }),
    )
  } catch {
    /* non-critical */
  }
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('dnd-music:settings') || 'null')
    if (!s) return
    if (typeof s.volume === 'number') volume.value = clamp(s.volume)
    if (typeof s.random === 'boolean') random.value = s.random
    if (['queue', 'track', 'off'].includes(s.loopMode)) loopMode.value = s.loopMode
    if (typeof s.crossfadeEnabled === 'boolean') crossfadeEnabled.value = s.crossfadeEnabled
    if (typeof s.crossfadeSec === 'number') crossfadeSec.value = s.crossfadeSec
  } catch {
    /* ignore */
  }
}

// --- Audio engine -----------------------------------------------------------

function activeEl(): HTMLAudioElement {
  return players[activeChannel]
}
function inactiveEl(): HTMLAudioElement {
  return players[1 - activeChannel]
}

function clearFade(el: HTMLAudioElement) {
  const t = fadeTimers.get(el)
  if (t) {
    clearInterval(t)
    fadeTimers.delete(el)
  }
}

/** Linearly ramp an element's volume to a target over `ms`. */
function rampVolume(el: HTMLAudioElement, from: number, to: number, ms: number, done?: () => void) {
  clearFade(el)
  if (ms <= 0) {
    el.volume = clamp(to)
    done?.()
    return
  }
  const steps = Math.max(1, Math.round(ms / 40))
  let i = 0
  el.volume = clamp(from)
  const timer = setInterval(() => {
    i++
    el.volume = clamp(from + (to - from) * (i / steps))
    if (i >= steps) {
      clearFade(el)
      done?.()
    }
  }, 40)
  fadeTimers.set(el, timer)
}

function ensurePlayers() {
  if (players.length) return
  for (let ch = 0; ch < 2; ch++) {
    const el = new Audio()
    el.volume = volume.value
    el.preload = 'auto'
    el.addEventListener('timeupdate', () => {
      if (el !== activeEl()) return
      currentTime.value = el.currentTime
      const now = Date.now()
      if (now - lastTimeSave > 4000) {
        lastTimeSave = now
        saveState({ time: el.currentTime })
      }
      maybeCrossfade()
    })
    el.addEventListener('loadedmetadata', () => {
      if (el !== activeEl()) return
      duration.value = Number.isFinite(el.duration) ? el.duration : 0
      if (pendingSeek > 0 && pendingSeek < duration.value) {
        el.currentTime = pendingSeek
        currentTime.value = pendingSeek
      }
      pendingSeek = 0
    })
    el.addEventListener('play', () => {
      if (el === activeEl()) isPlaying.value = true
    })
    el.addEventListener('pause', () => {
      if (el === activeEl()) {
        isPlaying.value = false
        saveState({ time: el.currentTime })
      }
    })
    el.addEventListener('ended', () => {
      if (el !== activeEl() || crossfading) return
      onTrackEnded()
    })
    el.addEventListener('error', () => {
      if (el === activeEl() && currentTrack.value) next(true)
    })
    players.push(el)
  }
}

/** Load a track into a specific channel element. */
async function loadInto(el: HTMLAudioElement, track: Track, autoplay: boolean, startVol: number) {
  currentTrack.value = track
  duration.value = 0
  currentTime.value = 0
  // Reset stored position only for a freshly started track, not on restore.
  saveState(autoplay ? { trackId: track.id, time: 0 } : { trackId: track.id })
  updateMediaSession(track)
  try {
    const file = await track.handle.getFile()
    const ch = players.indexOf(el)
    if (urls[ch]) URL.revokeObjectURL(urls[ch]!)
    urls[ch] = URL.createObjectURL(file)
    el.src = urls[ch]!
    el.volume = clamp(startVol)
    el.load()
    if (autoplay) await el.play()
  } catch (e: any) {
    error.value = `Kann "${track.fileName}" nicht abspielen: ${e?.message ?? e}`
  }
}

/** Abort an in-flight crossfade, keeping the (already-swapped) active channel. */
function cancelCrossfade() {
  if (!crossfading) return
  const out = inactiveEl()
  clearFade(out)
  clearFade(activeEl())
  out.pause()
  activeEl().volume = volume.value
  crossfading = false
}

/** Load a track into the active channel (manual jumps / restore). */
function loadActive(track: Track, autoplay: boolean) {
  ensurePlayers()
  cancelCrossfade()
  loadInto(activeEl(), track, autoplay, volume.value)
}

/** Peek the next track for a seamless crossfade (null = no clean next). */
function peekNext(): { track: Track; index: number } | null {
  if (loopMode.value === 'track') return null
  const idx = currentIndex.value + 1
  if (idx < playOrder.length) return { track: playOrder[idx], index: idx }
  if (loopMode.value === 'off') return null
  if (random.value) return null // reshuffle seam handled by onTrackEnded (no crossfade)
  return playOrder.length ? { track: playOrder[0], index: 0 } : null
}

function maybeCrossfade() {
  if (!crossfadeEnabled.value || crossfading) return
  if (loopMode.value === 'track') return
  const d = duration.value
  if (!d || d <= crossfadeSec.value + 0.5) return
  if (d - currentTime.value > crossfadeSec.value) return
  const n = peekNext()
  if (n) startCrossfade(n)
}

function startCrossfade(n: { track: Track; index: number }) {
  crossfading = true
  const dur = crossfadeSec.value * 1000
  const out = activeEl()
  // Hand control to the other channel immediately so the UI follows the new song.
  activeChannel = 1 - activeChannel
  currentIndex.value = n.index
  const inEl = activeEl()
  loadInto(inEl, n.track, true, 0)
  rampVolume(inEl, 0, volume.value, dur)
  rampVolume(out, out.volume, 0, dur, () => {
    out.pause()
    crossfading = false
  })
}

function onTrackEnded() {
  if (loopMode.value === 'track') {
    const el = activeEl()
    el.currentTime = 0
    el.play()
    return
  }
  next(true)
}

// --- Scanning ---------------------------------------------------------------

function isAudio(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return AUDIO_EXT.has(name.slice(dot + 1).toLowerCase())
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

async function scanDir(handle: FileSystemDirectoryHandle, path: string): Promise<Folder> {
  const tracks: Track[] = []
  const children: Folder[] = []

  // @ts-expect-error - async iterator on directory handle
  for await (const entry of handle.values()) {
    if (entry.kind === 'directory') {
      children.push(await scanDir(entry as FileSystemDirectoryHandle, `${path}/${entry.name}`))
    } else if (isAudio(entry.name)) {
      tracks.push({
        id: `${path}/${entry.name}`,
        name: stripExt(entry.name),
        fileName: entry.name,
        handle: entry as FileSystemFileHandle,
        folderPath: path,
      })
    }
  }

  tracks.sort((a, b) => collator.compare(a.name, b.name))
  children.sort((a, b) => collator.compare(a.name, b.name))

  const trackCount = tracks.length + children.reduce((sum, c) => sum + c.trackCount, 0)
  return { id: path, name: handle.name, path, tracks, children, trackCount }
}

/** Tracks in visual top-to-bottom order (folder's own tracks, then children). */
function flatten(folder: Folder, out: Track[] = []): Track[] {
  for (const t of folder.tracks) out.push(t)
  for (const c of folder.children) flatten(c, out)
  return out
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildOrder() {
  const root = scopeFolder.value ?? rootFolder.value
  if (!root) {
    playOrder = []
    currentIndex.value = -1
    return
  }
  const flat = flatten(root)
  playOrder = random.value ? shuffle(flat) : flat
  if (currentTrack.value) {
    currentIndex.value = playOrder.findIndex((t) => t.id === currentTrack.value!.id)
  }
}

/** Find a folder anywhere in the tree by its path. */
export function findFolder(folder: Folder | null, path: string): Folder | null {
  if (!folder) return null
  if (folder.path === path) return folder
  for (const c of folder.children) {
    const hit = findFolder(c, path)
    if (hit) return hit
  }
  return null
}

/** Whether a folder (or any descendant track/folder) matches the search query. */
export function folderMatchesQuery(folder: Folder, q: string): boolean {
  if (!q) return true
  if (folder.name.toLowerCase().includes(q)) return true
  if (folder.tracks.some((t) => t.name.toLowerCase().includes(q))) return true
  return folder.children.some((c) => folderMatchesQuery(c, q))
}

// --- MediaSession (OS media keys / lockscreen) ------------------------------

function updateMediaSession(track: Track) {
  if (!('mediaSession' in navigator)) return
  try {
    // @ts-expect-error - MediaMetadata is widely available in Chromium
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.folderPath,
      album: rootName.value || 'D&D Music',
    })
  } catch {
    /* ignore */
  }
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  const set = (action: string, handler: any) => {
    try {
      // @ts-expect-error - action string union
      ms.setActionHandler(action, handler)
    } catch {
      /* unsupported action */
    }
  }
  set('play', () => togglePlay())
  set('pause', () => togglePlay())
  set('previoustrack', () => prev())
  set('nexttrack', () => next(false))
  set('seekbackward', () => skip(-10))
  set('seekforward', () => skip(10))
  set('seekto', (e: any) => {
    if (typeof e?.seekTime === 'number') seek(e.seekTime)
  })
}

// --- Public actions ---------------------------------------------------------

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'read' } as const
  // @ts-expect-error - permission API
  if ((await handle.queryPermission(opts)) === 'granted') return true
  // @ts-expect-error - permission API
  return (await handle.requestPermission(opts)) === 'granted'
}

async function loadFromHandle(handle: FileSystemDirectoryHandle) {
  scanning.value = true
  error.value = null
  try {
    rootHandle = handle
    const tree = await scanDir(handle, handle.name)
    rootFolder.value = markRaw(tree)
    rootName.value = handle.name
    scopeFolder.value = null
    query.value = ''

    // Restore previously open folders, favorites + last song (collapsed by default).
    const saved = loadState()
    expanded.clear()
    favorites.clear()
    if (saved?.expanded) for (const p of saved.expanded) expanded.add(p)
    if (saved?.favorites) for (const p of saved.favorites) favorites.add(p)
    buildOrder()
    if (saved?.trackId) {
      const track = flatten(tree).find((t) => t.id === saved.trackId)
      if (track) {
        currentIndex.value = playOrder.findIndex((t) => t.id === track.id)
        pendingSeek = saved.time ?? 0
        loadActive(track, false) // load paused, ready to resume
      }
    }
  } finally {
    scanning.value = false
  }
}

async function pickFolder() {
  error.value = null
  // @ts-expect-error - File System Access API
  if (typeof window.showDirectoryPicker !== 'function') {
    supported.value = false
    error.value = 'Dein Browser unterstützt die Ordnerauswahl nicht. Nutze Chrome, Edge oder Brave.'
    return
  }
  try {
    // @ts-expect-error - File System Access API
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ id: 'dnd-music-lib', mode: 'read' })
    await loadFromHandle(handle)
    try {
      await idbSet('rootHandle', handle)
      canReconnect.value = false
    } catch {
      /* persistence is best-effort */
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return // user cancelled
    error.value = `Konnte den Ordner nicht lesen: ${e?.message ?? e}`
  }
}

async function reconnect() {
  error.value = null
  try {
    const handle = await idbGet<FileSystemDirectoryHandle>('rootHandle')
    if (!handle) {
      canReconnect.value = false
      return
    }
    if (!(await ensurePermission(handle))) {
      error.value = 'Zugriff verweigert. Bitte Ordner erneut wählen.'
      return
    }
    await loadFromHandle(handle)
    canReconnect.value = false
  } catch (e: any) {
    error.value = `Reconnect fehlgeschlagen: ${e?.message ?? e}`
    canReconnect.value = false
  }
}

async function init() {
  loadSettings()
  setupMediaSession()
  window.addEventListener('beforeunload', () => {
    if (players.length && currentTrack.value) saveState({ time: activeEl().currentTime })
  })

  // @ts-expect-error - feature detect
  supported.value = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
  if (!supported.value) return
  try {
    const handle = await idbGet<FileSystemDirectoryHandle>('rootHandle')
    if (!handle) return
    // @ts-expect-error - permission API
    const state = await handle.queryPermission({ mode: 'read' })
    if (state === 'granted') await loadFromHandle(handle)
    else canReconnect.value = true
  } catch {
    /* ignore */
  }
}

function playTrack(track: Track) {
  let idx = playOrder.findIndex((t) => t.id === track.id)
  if (idx < 0) {
    scopeFolder.value = null
    buildOrder()
    idx = playOrder.findIndex((t) => t.id === track.id)
  }
  currentIndex.value = idx
  loadActive(track, true)
}

function playFolder(folder: Folder, shuffleIt = false) {
  scopeFolder.value = folder
  random.value = shuffleIt
  saveSettings()
  buildOrder()
  if (!playOrder.length) return
  currentIndex.value = 0
  loadActive(playOrder[0], true)
}

function playAll() {
  if (currentTrack.value && currentIndex.value >= 0) {
    togglePlay()
    return
  }
  scopeFolder.value = null
  buildOrder()
  if (!playOrder.length) return
  currentIndex.value = 0
  loadActive(playOrder[0], true)
}

function togglePlay() {
  ensurePlayers()
  if (!currentTrack.value) {
    playAll()
    return
  }
  const el = activeEl()
  if (el.paused) {
    el.volume = 0
    el.play()
    rampVolume(el, 0, volume.value, 300)
  } else {
    rampVolume(el, el.volume, 0, 300, () => el.pause())
  }
}

function next(auto = false) {
  if (!playOrder.length) return
  let idx = currentIndex.value + 1
  if (idx >= playOrder.length) {
    if (auto && loopMode.value === 'off') {
      activeEl().pause()
      return
    }
    if (random.value) buildOrder()
    idx = 0
  }
  currentIndex.value = idx
  loadActive(playOrder[idx], true)
}

function prev() {
  if (!playOrder.length) return
  ensurePlayers()
  const el = activeEl()
  if (el.currentTime > 3) {
    el.currentTime = 0
    return
  }
  let idx = currentIndex.value - 1
  if (idx < 0) idx = playOrder.length - 1
  currentIndex.value = idx
  loadActive(playOrder[idx], true)
}

function seek(time: number) {
  ensurePlayers()
  const el = activeEl()
  el.currentTime = time
  currentTime.value = time
}

function skip(seconds: number) {
  ensurePlayers()
  const el = activeEl()
  if (!duration.value) return
  el.currentTime = Math.min(Math.max(0, el.currentTime + seconds), duration.value)
  currentTime.value = el.currentTime
}

function setVolume(v: number) {
  volume.value = clamp(v)
  if (players.length && !crossfading) activeEl().volume = volume.value
  saveSettings()
}

function nudgeVolume(delta: number) {
  setVolume(volume.value + delta)
}

function toggleRandom() {
  random.value = !random.value
  saveSettings()
  buildOrder()
}

function cycleLoop() {
  loopMode.value = loopMode.value === 'queue' ? 'track' : loopMode.value === 'track' ? 'off' : 'queue'
  saveSettings()
}

function setCrossfade(enabled: boolean) {
  crossfadeEnabled.value = enabled
  saveSettings()
}

function setCrossfadeSec(sec: number) {
  crossfadeSec.value = Math.max(1, Math.min(12, Math.round(sec)))
  saveSettings()
}

function setQuery(q: string) {
  query.value = q
}

function toggleExpand(path: string) {
  if (expanded.has(path)) expanded.delete(path)
  else expanded.add(path)
  saveState({ expanded: [...expanded] })
}

function collapseAll() {
  expanded.clear()
  saveState({ expanded: [] })
}

function expandAll() {
  const add = (f: Folder) => {
    if (f.children.length) expanded.add(f.path)
    f.children.forEach(add)
  }
  if (rootFolder.value) rootFolder.value.children.forEach(add)
  saveState({ expanded: [...expanded] })
}

function toggleFavorite(folder: Folder) {
  if (favorites.has(folder.path)) favorites.delete(folder.path)
  else favorites.add(folder.path)
  saveState({ favorites: [...favorites] })
}

function isFavorite(path: string): boolean {
  return favorites.has(path)
}

const hasLibrary = computed(() => !!rootFolder.value)

const scenes = computed<Folder[]>(() => {
  const root = rootFolder.value
  if (!root) return []
  return [...favorites]
    .map((p) => findFolder(root, p))
    .filter((f): f is Folder => !!f)
    .sort((a, b) => collator.compare(a.name, b.name))
})

export function useMusic() {
  return {
    // state
    rootFolder,
    rootName,
    scanning,
    error,
    supported,
    canReconnect,
    expanded,
    favorites,
    query,
    random,
    loopMode,
    crossfadeEnabled,
    crossfadeSec,
    scopeFolder,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    currentIndex,
    hasLibrary,
    scenes,
    // actions
    init,
    pickFolder,
    reconnect,
    playTrack,
    playFolder,
    playAll,
    togglePlay,
    next,
    prev,
    seek,
    skip,
    setVolume,
    nudgeVolume,
    toggleRandom,
    cycleLoop,
    setCrossfade,
    setCrossfadeSec,
    setQuery,
    toggleExpand,
    collapseAll,
    expandAll,
    toggleFavorite,
    isFavorite,
  }
}
