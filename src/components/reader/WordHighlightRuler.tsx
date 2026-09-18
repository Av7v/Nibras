import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNarrationProgress } from '../../hooks/useNarrationProgress'
import { useSpeechVoices } from '../../hooks/useSpeechVoices'

// Splits on runs of whitespace while KEEPING the whitespace itself as
// its own array entries (the regex's capture group) — re-joining every
// token verbatim reproduces the original text exactly, including
// whatever spacing/line breaks the document already had, never
// collapsed or renormalized.
function tokenize(text: string): string[] {
  return text.split(/(\s+)/)
}

// Same fixed-alpha-over-any-hue approach as ReadingRuler.tsx's own
// hexToRgba (duplicated rather than shared — two small, independently
// tuned constants, not one function worth a new shared module for).
// Markedly higher alpha than the line ruler's 16%: that band washes
// over a whole line so it must stay faint enough not to obscure text
// UNDER it; this highlights a single, already-isolated word, so a
// bolder "highlighter pen" look reads better and is still comfortably
// legible against the word's own text colour.
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface RenderToken {
  key: number
  tok: string
  /** null for whitespace tokens; the running word number otherwise. */
  wordNumber: number | null
}

interface WordStart {
  wordNumber: number
  /** Char offset of this word's first character within the full text. */
  startOffset: number
}

/** Which word contains `charIndex` — the last word whose start offset is
 * at or before it (word starts are ascending, so a binary search).
 * charIndex comes from the speech engine's real per-word boundary event
 * (see lib/textToSpeech.ts), measured against the SAME string rendered
 * here, so it lands exactly on a word start on the engines Nibras
 * targets; the search is robust either way. Returns -1 before the first
 * word (e.g. a boundary reported inside leading whitespace). */
function charIndexToWordIndex(wordStarts: WordStart[], charIndex: number): number {
  let lo = 0
  let hi = wordStarts.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (wordStarts[mid].startOffset <= charIndex) {
      found = wordStarts[mid].wordNumber
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/**
 * Task #361 — the reading ruler's second mode: instead of a pointer-
 * following band (ReadingRuler.tsx), this highlights ONE WORD at a
 * time as the Reading Buddy voice reads the passage aloud, an aid some
 * readers find easier to track than a whole line.
 *
 * REAL voice sync, not a guessed pace (this replaced webeng's honest
 * placeholder timer): there is ONE voice transport — ReadingBuddyPlayer,
 * the play/pause/speed control that sits just above the reading text —
 * and this component is a pure SUBSCRIBER to its live playback progress
 * (lib/narrationProgress.ts, via useNarrationProgress). Pressing play up
 * there makes the words highlight along, which is exactly what Amal
 * asked for («تظليل الكلام متزامن مع سرعة الصوت»); there is deliberately
 * no second play button here to fight the player for the single voice
 * channel. Pausing the voice freezes the highlight in place.
 *
 * Two voice paths, two honesty levels (both driven by the REAL voice,
 * neither faked):
 *  - Browser voice (Web Speech): the engine's own native per-word
 *    boundary events drive the highlight — TRUE word-level sync.
 *  - Enhanced neural voice (xAI): the provider returns audio with NO
 *    per-word timestamps (server/api/_xaiTts.ts), so the highlight
 *    advances at an APPROXIMATE pace derived from the real audio's
 *    playback position ÷ its duration. Labelled as approximate whenever
 *    that voice is active — never presented as exact.
 *
 * Renders as a DROP-IN REPLACEMENT for the Reader's plain reading
 * paragraph (same `dir`/`style`/visual position), not an overlay like
 * ReadingRuler — marking individual words means the text itself must be
 * split into spans, which a floating band never needed. Every word gets
 * its own (unstyled, visually invisible) span so double-click word
 * selection still works everywhere else; only the CURRENT word's span
 * gets the highlight style, swapped in/out as playback advances (see
 * displayChildren below — #398 review P2), and there is no animation/
 * transition (instant marking is both clearest for tracking and
 * inherently reduce-motion safe).
 */
export function WordHighlightRuler({
  text,
  dir,
  style,
  color,
}: {
  text: string
  dir: 'ltr' | 'rtl'
  style: CSSProperties
  /** A RulerColor hex value, same closed palette the line mode's colour
   * picker offers — rendered as a solid-ish highlight chip regardless of
   * hue (see hexToRgba's own comment on why this mode's alpha is
   * deliberately higher than the line ruler's). */
  color: string
}) {
  const { t } = useTranslation()
  const narration = useNarrationProgress()
  // dir maps 1:1 to the content language here (Reader passes dir='rtl'
  // exactly when the content is Arabic), so it's a safe proxy for the
  // voice-availability check without threading a second prop.
  const { hasVoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(dir === 'rtl' ? 'ar' : 'en')

  const tokens = useMemo(() => tokenize(text), [text])

  // Precomputed once per `tokens` change: the render list (a running
  // "word number" alongside each non-whitespace token, so the render is
  // a plain map with no counter juggling in JSX), the ascending
  // word-start offsets the char→word mapping binary-searches, AND (for
  // the #398 review P2 perf fix below) wordIndexInTokens — word number
  // -> its own position within renderTokens/baseChildren, so finding
  // "the array slot for word N" is an O(1) lookup instead of a scan.
  const { renderTokens, wordStarts, wordCount, wordIndexInTokens } = useMemo(() => {
    const renderTokens: RenderToken[] = []
    const wordStarts: WordStart[] = []
    const wordIndexInTokens: number[] = []
    let wordNumber = -1
    let offset = 0
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      const isWhitespace = i % 2 === 1 || tok === ''
      if (isWhitespace) {
        renderTokens.push({ key: i, tok, wordNumber: null })
      } else {
        wordNumber++
        wordStarts.push({ wordNumber, startOffset: offset })
        wordIndexInTokens.push(i)
        renderTokens.push({ key: i, tok, wordNumber })
      }
      offset += tok.length
    }
    return { renderTokens, wordStarts, wordCount: wordNumber + 1, wordIndexInTokens }
  }, [tokens])

  // #398 review P2 (2026-09-14) — the STABLE (narration-independent)
  // rendered node for every token, built ONCE per `renderTokens` change
  // (i.e. only when the text itself changes), never per narration tick.
  // Every word becomes its own <span> unconditionally now (previously
  // only the highlighted one was wrapped, and a bare string otherwise) —
  // purely cosmetic-neutral (an unstyled span renders identically to
  // plain text, and double-click word selection is unaffected either
  // way), but it gives every word a STABLE element identity to swap the
  // highlight style on below, instead of the highlighted word's type
  // flipping between "plain string" and "<span>" on every tick.
  const baseChildren = useMemo<ReactNode[]>(
    () =>
      renderTokens.map(({ key, tok, wordNumber }) =>
        wordNumber === null ? tok : <span key={key}>{tok}</span>,
      ),
    [renderTokens],
  )

  // The current word to highlight, derived PURELY from the real voice's
  // live progress — never a local timer. -1 = nothing highlighted.
  const currentWordIndex = useMemo(() => {
    if (narration.status === 'idle') return -1
    if (narration.source === 'browser' && narration.charIndex !== null) {
      return charIndexToWordIndex(wordStarts, narration.charIndex)
    }
    if (narration.source === 'neural' && narration.fraction !== null && wordCount > 0) {
      // Weight by CHARACTER position, not an equal time-slice per word:
      // longer words take proportionally longer to say, so mapping the
      // playback fraction onto cumulative characters (then to the word at
      // that char, reusing the browser path's binary search) tracks the
      // real voice far more closely than floor(fraction × wordCount),
      // which assumed every word took an equal share of the clip and so
      // drifted ahead on long words / behind on short ones. No per-word
      // timestamps exist (xAI returns audio only), so this is the closest
      // honest pace. (Amal 2026-09-14: the word highlight was not keeping
      // pace with the voice.) fraction is already playback-rate-correct
      // (currentTime÷duration), so this holds at any speed.
      const i = charIndexToWordIndex(wordStarts, narration.fraction * text.length)
      return i < 0 ? 0 : i > wordCount - 1 ? wordCount - 1 : i
    }
    return -1
  }, [narration, wordStarts, wordCount, text])

  // Honest status line, in the slot the placeholder's play button used
  // to occupy: idle -> how to start; enhanced (neural) voice playing ->
  // the highlight is approximate; browser voice playing -> nothing (it
  // is exact, so no note is warranted). The "press play above" hint only
  // shows when a voice actually exists — otherwise ReadingBuddyPlayer
  // renders its own "no voice available" message with no play button, so
  // pointing at a button that isn't there would be dishonest.
  const showIdleHint = narration.status === 'idle' && voiceAvailable
  const showApproxNote = narration.status !== 'idle' && narration.source === 'neural'

  // Memoized on `color` alone (oxlint's exhaustive-deps flagged the
  // plain-literal version below as changing every render, which would
  // have made displayChildren's own memo below recompute every render
  // too, not just when the highlight actually needs to move — #398
  // review P2's whole point).
  const highlightStyle = useMemo<CSSProperties>(
    () => ({ backgroundColor: hexToRgba(color, 0.45), borderRadius: 3 }),
    [color],
  )

  // #398 review P2 — swap only the ONE array slot that needs the
  // highlight style, reusing baseChildren's OTHER entries by REFERENCE
  // unchanged. This is what actually cuts the per-tick cost: the neural
  // voice path re-derives currentWordIndex on every <audio> `timeupdate`
  // (which can fire several times a second), and re-mapping every token
  // in the passage through this ternary on each of those ticks (the
  // previous shape) made React re-diff the whole paragraph every tick
  // instead of just the one word that actually moved. `.slice()` is a
  // shallow copy (cheap pointer copying, not a deep rebuild); only the
  // single replaced index is a genuinely new element.
  const displayChildren = useMemo(() => {
    if (currentWordIndex < 0) return baseChildren
    const tokenIndex = wordIndexInTokens[currentWordIndex]
    if (tokenIndex === undefined) return baseChildren
    const next = baseChildren.slice()
    next[tokenIndex] = (
      <span key={renderTokens[tokenIndex].key} style={highlightStyle}>
        {renderTokens[tokenIndex].tok}
      </span>
    )
    return next
  }, [baseChildren, currentWordIndex, wordIndexInTokens, renderTokens, highlightStyle])

  return (
    <div>
      {showIdleHint && (
        <p className="mb-2.5 text-[0.8125rem] text-ink-muted">{t('reader.wordSyncIdleHint')}</p>
      )}
      {showApproxNote && (
        <p className="mb-2.5 text-[0.8125rem] text-ink-muted">{t('reader.wordSyncApproxNote')}</p>
      )}
      {/* Same classes/dir/style the plain reading paragraph elsewhere in
          Reader.tsx uses — switching modes must never change the font,
          size, spacing, or colour the reader already chose, only how the
          current word is marked. */}
      <p className="m-0 text-start text-ink" dir={dir} style={style}>
        {displayChildren}
      </p>
    </div>
  )
}
