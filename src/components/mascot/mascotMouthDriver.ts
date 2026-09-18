/**
 * Task #366 — drives «مرشد نبراس»'s MOUTH from its actual voice, so the
 * lantern's mouth moves in sync with the guidance it's speaking (Amal:
 * «لما يتكلم يتحرك الفم»). Pairs with NibrasGuideFace (the SVG state
 * machine) and NibrasGuideMascot (which owns expression + reduced-motion).
 *
 * Two honest signals, one per voice path. This is a SEPARATE, mascot-local
 * driver: it deliberately does NOT publish into lib/narrationProgress.ts,
 * because the mascot also appears on /reader where the word-highlight ruler
 * subscribes to that store — the mascot's own script must never move the
 * reader's highlight.
 *
 *  - NEURAL (xAI /voice) → an <audio> element playing a `data:` MP3.
 *    A data URI is same-origin, so an AnalyserNode reads its REAL samples
 *    (not CORS-tainted zeros): amplitude → mouth openness. The clips are
 *    RMS-normalised to about -16 LUFS (quiet peaks), so a LINEAR map barely
 *    opens the mouth — this uses AUTO-GAIN (openness relative to the loudest
 *    recent moment) so the mouth uses its full range at any clip level, and
 *    still CLOSES on real pauses (silence normalises to rest).
 *  - BROWSER (Web Speech, demo/AI-off) → onboundary fires per spoken word,
 *    but measured Arabic boundary rates are sparse (~1.3/sec, with ~2.4s
 *    gaps on some OS voices) — a purely per-word mouth would visibly FREEZE
 *    mid-sentence. So here a gentle time-based flap is the PRIMARY clock
 *    (continuous motion) and onboundary only NUDGES an open vowel for
 *    word-aligned emphasis where it's available.
 *
 * Graceful: if Web Audio is unavailable, or the analyser reads silence for
 * too long (a tainted source), the neural path also falls back to the flap.
 * It's honest — a generic talking motion, never a claim of true lip-sync.
 *
 * Reduced motion is handled by the CALLER (it never start()s a moving mouth)
 * AND by the SVG's own @media block; this driver carries no reduced-motion
 * logic of its own.
 */

export type MouthShape = 'mouth-rest' | 'mouth-m' | 'mouth-e' | 'mouth-a' | 'mouth-o'
export type VoicePath = 'neural' | 'browser'

// vdesign's contract: hold each shape >= 80ms or it reads as a flicker.
const MIN_HOLD_MS = 80
// Browser primary-clock flap cadence (> MIN_HOLD_MS) and its shape cycle.
const FLAP_STEP_MS = 130
const FLAP_CYCLE: MouthShape[] = ['mouth-a', 'mouth-e', 'mouth-m', 'mouth-o', 'mouth-e']
// onboundary nudge: rotate an open vowel per word for word-aligned emphasis.
const BOUNDARY_OPEN_CYCLE: MouthShape[] = ['mouth-a', 'mouth-e', 'mouth-o']
// Neural auto-gain: openness is `smoothed / runningMax`, so the mouth uses
// its full range regardless of the clip's absolute (quiet) level. runningMax
// decays slowly so a pause reads as rest RELATIVE to recent speech.
const GAIN_FLOOR = 0.06 // floor so true silence can't normalise up to "loud"
const RUNNING_MAX_DECAY = 0.995
// Normalised-openness → mouth. Slightly hysteretic via the >=80ms hold +
// slow release smoothing below, so it doesn't chatter between bands.
const NORM_REST = 0.2
const NORM_LOW = 0.45
const NORM_MID = 0.72
// If the analyser sees essentially nothing for this long, the source can't
// be measured here (tainted / muted) → fall back to the flap.
const ANALYSER_SILENCE_GIVEUP_MS = 650
const ANALYSER_EPSILON = 0.012

/** One MediaElementSourceNode may be created per <audio> element, EVER — a
 * second call throws InvalidStateError. The controller reuses one element
 * across taps, so cache the source per element. */
const sourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()

function normalizedToMouth(norm: number): MouthShape {
  if (norm < NORM_REST) return 'mouth-rest'
  if (norm < NORM_LOW) return 'mouth-o'
  if (norm < NORM_MID) return 'mouth-e'
  return 'mouth-a'
}

type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext }

export class MascotMouthDriver {
  private readonly setMouth: (m: MouthShape) => void
  private current: MouthShape = 'mouth-rest'
  private lastCommitAt = 0
  private running = false
  private path: VoicePath | null = null

  // Neural (analyser) state
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private timeData: Uint8Array<ArrayBuffer> | null = null
  private rafId = 0
  private smoothed = 0
  private runningMax = GAIN_FLOOR
  private analyserStartedAt = 0
  private analyserMaxSeen = 0

  // Browser flap + boundary state
  private flapTimer: ReturnType<typeof setInterval> | null = null
  private flapIndex = 0
  private openIndex = 0

  constructor(setMouth: (m: MouthShape) => void) {
    this.setMouth = setMouth
  }

  /** Speech is beginning. Called synchronously from the tap handler (a user
   * gesture) so the neural AudioContext is created/resumed under activation. */
  start(path: VoicePath) {
    this.stopMotion()
    this.running = true
    this.path = path
    this.commit('mouth-rest', true)
    if (path === 'browser') {
      // Flap is the PRIMARY clock on the browser path (continuous motion;
      // onboundary only nudges). Robust to sparse/absent Arabic boundaries.
      this.startFlap()
    } else {
      // Neural: prepare the context now (gesture); the <audio> element and
      // the amplitude loop arrive via attachAudio() once the render resolves.
      this.ensureContext()
    }
  }

  /** NEURAL path: the controller's <audio> element is about to play. Wire it
   * through an analyser (once) and start the amplitude loop. */
  attachAudio(audio: HTMLMediaElement) {
    if (!this.running || this.path !== 'neural') return
    const ctx = this.ensureContext()
    if (!ctx) {
      this.startFlap() // no Web Audio at all → generic flap
      return
    }
    try {
      let source = sourceCache.get(audio)
      if (!source) {
        source = ctx.createMediaElementSource(audio)
        sourceCache.set(audio, source)
      }
      if (!this.analyser) {
        this.analyser = ctx.createAnalyser()
        this.analyser.fftSize = 1024
        this.analyser.smoothingTimeConstant = 0.6
        this.timeData = new Uint8Array(this.analyser.fftSize)
        // source → analyser → destination. Connecting to destination is
        // MANDATORY: once an element has a MediaElementSource its normal
        // output is routed through the graph, so skipping this would make
        // the neural voice silent. (Verified live in #366.)
        source.connect(this.analyser)
        this.analyser.connect(ctx.destination)
      }
      void ctx.resume().catch(() => {})
      this.analyserStartedAt = performance.now()
      this.analyserMaxSeen = 0
      this.smoothed = 0
      this.runningMax = GAIN_FLOOR
      this.cancelFlap()
      this.loop()
    } catch {
      this.startFlap()
    }
  }

  /** BROWSER path: the engine reached a spoken word — nudge an open vowel
   * for word-aligned emphasis. The flap keeps the mouth alive between words
   * (and through Arabic's long boundary gaps), so this is emphasis, not the
   * clock; it respects the 80ms hold so it never fights the flap. */
  pushBoundary() {
    if (!this.running || this.path !== 'browser') return
    const shape = BOUNDARY_OPEN_CYCLE[this.openIndex % BOUNDARY_OPEN_CYCLE.length]
    this.openIndex++
    this.commit(shape)
  }

  /** Speech ended / was stopped / errored — settle the mouth closed. */
  stop() {
    this.running = false
    this.path = null
    this.stopMotion()
    this.commit('mouth-rest', true)
  }

  /** Mascot unmount (never happens in practice — mounted once at the shell —
   * but correct to release the AudioContext if it ever does). */
  dispose() {
    this.stop()
    if (this.ctx) {
      void this.ctx.close().catch(() => {})
      this.ctx = null
      this.analyser = null
      this.timeData = null
    }
  }

  // --- internals ---------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!Ctor) return null
    try {
      this.ctx = new Ctor()
      return this.ctx
    } catch {
      return null
    }
  }

  private loop = () => {
    if (!this.running || this.path !== 'neural' || !this.analyser || !this.timeData) return
    this.analyser.getByteTimeDomainData(this.timeData)
    let sumSq = 0
    for (let i = 0; i < this.timeData.length; i++) {
      const x = (this.timeData[i] - 128) / 128
      sumSq += x * x
    }
    const rms = Math.sqrt(sumSq / this.timeData.length)
    // Fast attack, slower release (a soft hysteresis so the mouth doesn't
    // chatter closed between syllables; the 80ms hold guards the rest).
    this.smoothed = rms > this.smoothed ? rms : this.smoothed * 0.6 + rms * 0.4
    if (this.smoothed > this.analyserMaxSeen) this.analyserMaxSeen = this.smoothed
    // Auto-gain: track the loudest recent moment and measure openness
    // relative to it, so a quiet (-16 LUFS) clip still opens the mouth fully
    // while a real pause (smoothed → ~0) still normalises to rest.
    this.runningMax = Math.max(this.smoothed, this.runningMax * RUNNING_MAX_DECAY)
    const norm = this.smoothed / Math.max(this.runningMax, GAIN_FLOOR)

    // If we've read essentially silence for a while, this source can't be
    // measured here (tainted / muted) — flap instead of a frozen mouth.
    if (
      performance.now() - this.analyserStartedAt > ANALYSER_SILENCE_GIVEUP_MS &&
      this.analyserMaxSeen < ANALYSER_EPSILON
    ) {
      this.startFlap()
      return
    }

    this.commit(normalizedToMouth(norm))
    this.rafId = requestAnimationFrame(this.loop)
  }

  private startFlap() {
    if (this.flapTimer || !this.running) return
    this.stopLoop()
    this.flapIndex = 0
    this.commit(FLAP_CYCLE[0], true)
    this.flapTimer = setInterval(() => {
      if (!this.running) return
      this.flapIndex = (this.flapIndex + 1) % FLAP_CYCLE.length
      this.commit(FLAP_CYCLE[this.flapIndex], true)
    }, FLAP_STEP_MS)
  }

  /** Set the mouth, honoring the >=80ms hold unless `force` (start/stop and
   * flap steps, which are already spaced beyond the minimum). */
  private commit(shape: MouthShape, force = false) {
    if (shape === this.current && !force) return
    const now = performance.now()
    if (!force && now - this.lastCommitAt < MIN_HOLD_MS) return
    this.current = shape
    // rest-on-(re)start resets the clock so the first real shape isn't held off.
    this.lastCommitAt = shape === 'mouth-rest' && force ? 0 : now
    this.setMouth(shape)
  }

  private stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  private cancelFlap() {
    if (this.flapTimer) {
      clearInterval(this.flapTimer)
      this.flapTimer = null
    }
  }

  private stopMotion() {
    this.stopLoop()
    this.cancelFlap()
    this.openIndex = 0
    this.smoothed = 0
    this.runningMax = GAIN_FLOOR
  }
}
