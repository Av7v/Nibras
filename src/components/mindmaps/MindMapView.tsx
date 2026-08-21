import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MindMapTreeNode } from '../../content/demoMindMaps'
import { useMindMapNotes } from '../../hooks/useMindMapNotes'
import { useMindMapEdits } from '../../hooks/useMindMapEdits'
import { useMindMapColors } from '../../hooks/useMindMapColors'
import { useSpeakingController } from '../../hooks/useSpeakingController'
import { useSpeechVoices } from '../../hooks/useSpeechVoices'
import { useVoicePreference } from '../../hooks/useVoicePreference'
import { applyMindMapEdits } from '../../lib/mindMapEdits'
import { assignBranchIndices, layoutMindMap, NODE_H, NODE_W } from '../../lib/mindMapLayout'
import { exportSvgAsPng } from '../../lib/exportSvg'
import { isAiBackendConfigured } from '../../lib/aiService'
import { hexToHsl, hslToHex } from '../../lib/color'
import { focusRing } from '../../lib/focus'
import { AddIcon, ChevronIcon, DownloadIcon, EditIcon, NoteIcon, PaletteIcon, SpeakerIcon, StopIcon } from '../icons'
import { SpeakerButton } from '../techniques/SpeakerButton'
import { ColorWheelField } from '../reader/SettingsFields'

// A sentinel id for useSpeakingController's speakingId, distinct from
// any real node id (all real ids come from content/demoMindMaps.ts or
// mindMapEdits.ts's generated ids) — lets one shared controller track
// BOTH "reading one selected node" and "reading the whole map" as
// separate, mutually-exclusive speaking states.
const WHOLE_MAP_SPEAKING_ID = '__whole_map__'

// NODE_W/NODE_H now live in mindMapLayout.ts, imported from there
// rather than redeclared here — see that file's own comment for why
// (nibras-qa interim review, 2026-08-13: the layout math needs these
// same dimensions to size its own margins correctly, and two
// independently-hardcoded copies is exactly what let them drift out of
// sync before).
const LINE_HEIGHT = 15.5

// Matches --color-card in index.css. Not read live via getComputedStyle
// (which can return an oklch()/color-mix() string an <img>-rasterized
// export can't use) — a plain hex is simplest and this token changes
// rarely; if index.css's --color-card ever changes, update this too.
const EXPORT_BACKGROUND = '#FBF8F0'

// The diagram's own shape/text colors, as literal hex — deliberately
// NOT Tailwind classes (fill-accent, stroke-line-strong, font-bold),
// unlike everywhere else in this app. Reason, found by actually
// opening an exported file rather than assuming: exportSvg.ts
// serializes this <svg> standalone (XMLSerializer -> blob URL -> Image)
// for the PNG-export button, completely detached from this page's
// stylesheet — a className only resolves a color while the element is
// still attached to the document, so the export rendered every shape
// with SVG's own fallback (solid black fill), text included, making
// labels invisible black-on-black. Literal fill/stroke/font-weight
// values on the elements themselves travel with the serialized markup,
// so both the on-screen render and the export show the same thing.
// Values duplicate index.css's --color-accent/-card/-ink/-line-strong
// tokens (see that file's own palette comment) — update both places
// together if the palette changes.
const ACCENT = '#004aad'
const ACCENT_INK = '#ffffff'
const CARD = '#fbf8f0'
const INK = '#37312b'
const LINE_STRONG = '#947e52'
const NOTE_DOT = '#f7a062'

// Branch-color palette (task #204, 2026-08-18) — ONLY applied when the
// caller passes `colorByBranch` (the AI generator's output AND, since
// 2026-08-19, the Reading Techniques example — see that prop's own doc
// comment below). Amal's reference
// screenshot colors each top-level branch of a generated map
// distinctly (blue/orange/green) so the structure reads at a glance;
// every node inherits its OWN top-level ancestor's color regardless of
// depth (assignBranchIndices in mindMapLayout.ts), root stays the
// existing solid ACCENT unconditionally (it isn't part of any branch,
// it's what the branches come FROM). Deliberately light TINT fills
// (not the reference's own more saturated ones) paired with the SAME
// `INK` text color already used everywhere else in this component —
// keeps one text-color rule instead of computing per-swatch contrast,
// and still verified: 10.2-10.7:1 against INK (WCAG relative-luminance
// formula, this project's established check — see index.css's own
// palette-derivation comments for the same method), comfortably past
// the CARD baseline's own 12.09:1 rather than just scraping the 4.5:1
// AA floor. Border shades are a plain, more-saturated step of the same
// hue, no contrast requirement (not text).
const BRANCH_PALETTE: { fill: string; border: string }[] = [
  { fill: '#dbe6fb', border: '#5b84c4' }, // blue
  { fill: '#fbe6d1', border: '#d97a3d' }, // orange
  { fill: '#dcf0df', border: '#4f9d63' }, // green
]

// A user's colour-wheel choice (task #211) can be ANY hue/lightness —
// unlike BRANCH_PALETTE's hand-picked pastel pairs, there's no fixed
// fill/border pair to look up. Derives a readable border the same way
// this project already derives hover/active shades from one brand hex
// (hold hue+saturation, only vary lightness — see index.css's own
// palette-derivation comments): -20% lightness, clamped so a
// near-black or near-white user pick still gets a border that reads as
// "a border," not the exact same colour as the fill (0) or an
// out-of-gamut value.
function deriveNodeBorder(fillHex: string): string {
  const { h, s, l } = hexToHsl(fillHex)
  return hslToHex({ h, s, l: Math.max(5, Math.min(95, l - 20)) })
}

// Same reasoning, for typography: <text> was inheriting font-family
// from `body` (index.css's --font-sans/--font-arabic, chosen by
// html[dir]) — also an external-stylesheet value, so the export fell
// back to the renderer's own generic default (serif) instead of the
// app's brand font. Matches index.css's font stacks minus their
// system-font fallback tail (kept short — this is a small label, not
// body reading text, so a missing web font just shows the platform
// sans/serif default rather than needing OpenDyslexic-grade fallback
// care).
const FONT_LATIN = "'Lexend', system-ui, sans-serif"
const FONT_ARABIC = "'Tajawal', system-ui, sans-serif"

// A user-typed node label has no length control the way the
// hand-authored demo content did — capped so a very long typed label
// can't overflow the fixed NODE_H the layout budgets for (see
// wrapLabel below: NODE_H=60 comfortably fits 3 wrapped lines at this
// component's charsPerLine, not 4+). 46 chars is close to the longest
// hand-authored demo label ("Choose the task that matters most", 34
// chars) with headroom, still a short mind-map-style phrase rather
// than a full sentence.
const MAX_LABEL_LENGTH = 46

// Toggle badge diameter — a small circle attached to a collapsible
// node's edge, distinct from (and not overlapping) the note-indicator
// dot the node's own <rect> already draws in its opposite corner.
// 24, not 22 (nibras-qa P1-8, 2026-08-13): WCAG 2.5.8 Target Size
// (Minimum) requires interactive targets to be at least 24x24 CSS
// pixels — this was the only sub-24 control found anywhere in the app.
// QA measured the rendered button at exactly 24.00×24.00 (getBoundingClientRect,
// not just this constant) — clears the floor with ZERO margin. If this
// button's own padding/border/box-sizing ever changes, re-measure the
// RENDERED size, not just this number — it could silently drop back
// under 24 without this constant itself ever changing.
// Position is computed FROM this constant (TOGGLE_SIZE/2 offsets below)
// so the toggle stays correctly centered on its node automatically,
// no separate position recalculation needed.
const TOGGLE_SIZE = 24

/** Default collapsed state (2026-08-13, Amal: «ابغى العائلات الثلاثة
 * داخل الخريطة» — wants to see all 3 families together at once, not
 * scroll past one to find the next): every non-root node that HAS
 * children starts collapsed, so the very first view is just the root
 * + the 3 families — small enough to need no scrolling — with each
 * family (and, once expanded, each technique) independently
 * expandable. Computed from the STABLE `root` prop, not the
 * edit-merged `effectiveRoot` — a user-added node can never itself
 * gain further rendered children (see mindMapEdits.ts's `rebuild()`,
 * which only recurses into the base tree's own `children`), so it
 * would never need a toggle either way; using `root` just means this
 * never has to recompute as edits accumulate. */
function collectDefaultCollapsedIds(node: MindMapTreeNode, depth: number, out: Set<string>) {
  if (node.children && node.children.length > 0) {
    if (depth > 0) out.add(node.id)
    for (const child of node.children) collectDefaultCollapsedIds(child, depth + 1, out)
  }
}

/**
 * Renders one mind map as SVG (edges + node shapes — decorative only)
 * with an HTML button overlaid on each node for the actual click/focus
 * target, plus a below-diagram panel for reading/adding a note on the
 * selected node and an export-to-PNG button.
 *
 * Why an HTML overlay instead of making the SVG shapes themselves
 * focusable: this app's `focusRing` utility, keyboard handling, and
 * screen-reader conventions are all built on plain HTML buttons
 * everywhere else — reusing that exactly here is more reliably
 * accessible than depending on cross-browser SVG focus-outline
 * rendering. It also keeps the *exported* PNG clean (button chrome
 * isn't part of the rasterized SVG). The SVG is rendered at its true
 * pixel size (not stretched to 100% width), so the overlay's raw pixel
 * coordinates always line up with it exactly — see mindMapLayout.ts.
 *
 * RTL: node x-positions are already mirrored by layoutMindMap(...,
 * rtl) — this component positions the overlay buttons with physical
 * `left`/`top` (not logical inset-inline-*), deliberately, so the
 * already-computed mirrored coordinates aren't flipped a second time
 * by the browser's own dir-handling.
 *
 * Editing (2026-08-13, Amal): an "Edit map" toggle reveals per-node
 * text editing + "add a branch" once a node is selected — on top of,
 * not instead of, the existing per-node notes. `root` (the base demo
 * tree) is never mutated; persisted edits are merged onto it fresh
 * every render via applyMindMapEdits(), so the SAME effective tree
 * drives the on-screen diagram AND the PNG export automatically.
 */
export function MindMapView({
  mapId,
  title,
  root,
  lang,
  isExample,
  colorByBranch,
}: {
  mapId: string
  title: string
  root: MindMapTreeNode
  lang: 'en' | 'ar'
  /** Marks this render as Nibras's own canned demo content (reuses the
   * same profile.sourceExample "مثال/Example" pill the Reader already
   * shows on its example texts — not a new badge) rather than a map
   * generated from the reader's own document, so a future real
   * AI-generated map is never mislabeled as an example. Defaults to
   * false/unset. */
  isExample?: boolean
  /** Colors each top-level branch's whole subtree distinctly (see
   * BRANCH_PALETTE above) instead of the default single-accent
   * styling. Task #204 (2026-08-18) — team-lead's explicit scope: ONLY
   * the AI generator passes this; the Reading Techniques example and
   * any other existing map keep their already-approved look unchanged
   * (this defaults to false/unset everywhere else, on purpose — do not
   * flip the default here, opt individual callers IN). */
  colorByBranch?: boolean
}) {
  const { t } = useTranslation()
  const rtl = lang === 'ar'
  const { notes, setNote } = useMindMapNotes(mapId)
  const { edits, setLabel, addNode } = useMindMapEdits(mapId)
  const { speakingId, preparingId, errorId, toggle: toggleSpeaking, stop: stopSpeakingHere } = useSpeakingController()
  const { hasVoiceFor } = useSpeechVoices()
  const voiceAvailable = hasVoiceFor(lang)
  // Task #127 — ONE voice/speed choice controls BOTH per-node listen
  // and "Listen to map" (they already shared one useSpeakingController
  // instance). Task #145 — gender+rate come from the GLOBAL,
  // live-reactive voice preference, set from the header's own voice
  // popover, not a local per-page one. Task #211 (2026-08-19): this
  // card USED to also render its OWN local Voice1/Voice2+speed picker
  // (task #127) — removed, not moved, once "voice control at the top"
  // turned out to mean two UI surfaces for the exact same global
  // preference #145 already sets app-wide (flagged this reasoning to
  // team-lead rather than just relocating the redundant picker).
  // `gender`/`voiceRate` still get read here, just no longer have a
  // local SETTER UI — speakWholeMap/speakNode below still use them to
  // actually drive playback.
  const { gender, rate: voiceRate } = useVoicePreference()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [draftLabel, setDraftLabel] = useState('')
  const [editMode, setEditMode] = useState(false)
  // Task #211 — Amal's "colour the boxes" control, mirrors editMode's
  // own shape exactly (a toggle + a selected-node-gated panel below).
  const [colorMode, setColorMode] = useState(false)
  const { colors, setColor } = useMindMapColors(mapId)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  const [exporting, setExporting] = useState(false)
  // Lazy initializer — runs once at mount only, from the stable `root`
  // prop (see collectDefaultCollapsedIds' own comment for why `root`
  // and not `effectiveRoot`, and why once-at-mount is safe even though
  // MindMaps.tsx passes a freshly-built `root` object every render).
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    collectDefaultCollapsedIds(root, 0, ids)
    return ids
  })

  const effectiveRoot = useMemo(() => applyMindMapEdits(root, edits), [root, edits])
  const { nodes, edges, width, height } = layoutMindMap(effectiveRoot, rtl, collapsedIds)
  const charsPerLine = rtl ? 15 : 18
  // Cheap on these tree sizes (a few dozen nodes at most) — no need to
  // gate this behind `colorByBranch` itself, simpler to always compute
  // and just not consult it when the prop is off.
  const branchIndices = useMemo(() => assignBranchIndices(effectiveRoot), [effectiveRoot])
  function branchColors(nodeId: string) {
    const idx = branchIndices.get(nodeId)
    return idx === undefined ? undefined : BRANCH_PALETTE[idx % BRANCH_PALETTE.length]
  }

  /** Task #211 — a user's colour-wheel choice for a specific node
   * OVERRIDES whatever it would otherwise show (the #204 branch colour,
   * or the plain default), without touching any OTHER node — team-lead's
   * own proposed interaction, confirmed as the cleanest fit: it doesn't
   * fight #204's automatic branch colouring, it just wins for the one
   * "idea" the reader explicitly picked a colour for. Gated behind the
   * SAME `colorByBranch` prop as automatic branch colouring (one flag
   * for the whole #211 feature set, not a second prop that would always
   * be set identically) — so, like branch colouring, this applies
   * wherever `colorByBranch` is passed: the AI generator's output and
   * (since 2026-08-19, Amal's request) the Reading Techniques example.
   * Never used
   * for the root (root stays the fixed solid ACCENT identity colour
   * unconditionally — the colour panel itself is also never offered for
   * the root, see the panel's own `!isRoot` gate below). */
  function effectiveFill(nodeId: string, isRoot: boolean): { fill: string; border: string } {
    if (colorByBranch && !isRoot) {
      const userHex = colors[nodeId]
      if (userHex) return { fill: userHex, border: deriveNodeBorder(userHex) }
      const branch = branchColors(nodeId)
      if (branch) return branch
    }
    return isRoot ? { fill: ACCENT, border: 'none' } : { fill: CARD, border: LINE_STRONG }
  }

  function toggleCollapse(nodeId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  function selectNode(id: string) {
    // Any selection change (including deselecting) means whatever was
    // being read — a specific node OR the whole map — no longer
    // matches what's now in focus; stop rather than let stale audio
    // keep playing over a different selection.
    stopSpeakingHere()
    if (selectedNodeId === id) {
      setSelectedNodeId(null)
      return
    }
    setSelectedNodeId(id)
    setDraftNote(notes[id] ?? '')
    setDraftLabel(nodes.find((n) => n.id === id)?.label ?? '')
  }

  /** Reads one node aloud: its label, plus its note if the reader added
   * one (a period between them — the only pause control Web Speech
   * offers here, same technique as the Guide's title+body). */
  function speakNode(node: { id: string; label: string }) {
    const note = notes[node.id]
    const text = note ? `${node.label}. ${note}` : node.label
    toggleSpeaking(node.id, text, lang, { gender, rate: voiceRate })
  }

  /** Reads the whole map in genuine root -> branches -> children
   * reading order. Deliberately NOT reusing the `nodes` array from
   * layoutMindMap: that array is built POST-order (a node is pushed
   * only after all its own children are, so a diagram's ROOT ends up
   * LAST — correct for the layout math's own row-averaging, wrong for
   * a human listener) — confirmed by reading layoutMindMap's `visit()`
   * before assuming its order was usable here. This walks
   * `effectiveRoot` itself in real pre-order instead, respecting
   * `collapsedIds` the same way the layout does (a collapsed node's
   * children are skipped entirely) so the spoken content always
   * matches what's actually visible on screen — never reads into a
   * branch the reader hasn't chosen to expand. */
  function speakWholeMap() {
    const parts: string[] = []
    function visit(node: MindMapTreeNode) {
      const note = notes[node.id]
      parts.push(note ? `${node.label}. ${note}` : node.label)
      const isCollapsed = Boolean(node.children?.length) && collapsedIds.has(node.id)
      if (!isCollapsed) {
        for (const child of node.children ?? []) visit(child)
      }
    }
    visit(effectiveRoot)
    toggleSpeaking(WHOLE_MAP_SPEAKING_ID, parts.join('. '), lang, { gender, rate: voiceRate })
  }

  function saveDraftNote() {
    if (!selectedNodeId) return
    setNote(selectedNodeId, draftNote)
  }

  function saveDraftLabel() {
    if (!selectedNodeId || !draftLabel.trim()) return
    setLabel(selectedNodeId, draftLabel.trim().slice(0, MAX_LABEL_LENGTH))
  }

  function handleAddBranch() {
    if (!selectedNodeId) return
    const defaultLabel = t('mindMaps.newNodeDefaultLabel')
    const newId = addNode(selectedNodeId, defaultLabel)
    setSelectedNodeId(newId)
    setDraftNote('')
    setDraftLabel(defaultLabel)
    // Focus + select the text so typing a real name immediately
    // replaces the placeholder — the new node is already visible and
    // selected, this just saves an extra click into the field.
    requestAnimationFrame(() => {
      labelInputRef.current?.focus()
      labelInputRef.current?.select()
    })
  }

  async function handleExport() {
    if (!svgRef.current) return
    setExporting(true)
    try {
      await exportSvgAsPng(svgRef.current, `${mapId}-mind-map.png`, EXPORT_BACKGROUND)
    } catch {
      // Rasterization can fail in unusual environments (e.g. a
      // browser that blocks canvas export) — fails silently into a
      // no-op rather than throwing past this handler; the button
      // simply doesn't produce a file, no broken UI state either way.
    } finally {
      setExporting(false)
    }
  }

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined

  return (
    <div className="rounded-card border border-line bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <h2 className="text-[1.0625rem] font-bold text-ink">{title}</h2>
          {/* Same pill + class as the Reader's own example badges (not a
              new one) — stays visible for as long as this map is open,
              not just on the picker card you clicked to get here, same
              "always clear this is a provided example" reasoning. */}
          {isExample && (
            <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
              {t('profile.sourceExample')}
            </span>
          )}
        </span>
      </div>

      {/* Task #211 (2026-08-19), Amal's control reorg — first pass,
          pending her confirmation on the screenshot (team-lead): voice
          at the TOP of the controls (its own row), then a second row
          grouping Download + Edit + the new Colour toggle together
          ("beside" each other, a tidy utility row below voice).
          The LOCAL Voice1/Voice2+speed picker that used to render here
          (task #127) is REMOVED, not moved — #145's header control
          already sets this exact global preference app-wide, so a
          second picker in this card was two UI surfaces for one piece
          of state; flagged this reasoning to team-lead rather than
          just relocating the redundant picker to satisfy "voice at the
          top" literally. "Listen to map" (the one control that's
          actually specific to THIS card, not a duplicate of anything
          global) is what now occupies that top position. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Whole-map listen — a text+icon pill matching Edit/Export's
            own shape (not the round SpeakerButton used per-node below:
            that component is built for a compact card affordance, not
            this row's pill-button language) even though it drives the
            exact same TTS mechanism underneath (useSpeakingController
            + useSpeechVoices, no parallel system). Honestly disabled,
            not hidden, when no voice exists for `lang` — same
            convention SpeakerButton itself uses. */}
        <button
          type="button"
          onClick={speakWholeMap}
          disabled={!voiceAvailable || preparingId === WHOLE_MAP_SPEAKING_ID}
          aria-pressed={speakingId === WHOLE_MAP_SPEAKING_ID}
          aria-busy={preparingId === WHOLE_MAP_SPEAKING_ID}
          title={voiceAvailable ? undefined : t('techniques.noVoice')}
          className={`inline-flex items-center gap-2 rounded-control border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 ${
            speakingId === WHOLE_MAP_SPEAKING_ID ? '' : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent'
          } ${focusRing}`}
        >
          {preparingId === WHOLE_MAP_SPEAKING_ID ? (
            <SpeakerIcon className="size-4 motion-safe:animate-pulse" />
          ) : speakingId === WHOLE_MAP_SPEAKING_ID ? (
            <StopIcon className="size-4" />
          ) : (
            <SpeakerIcon className="size-4" />
          )}
          {preparingId === WHOLE_MAP_SPEAKING_ID
            ? t('techniques.preparing')
            : speakingId === WHOLE_MAP_SPEAKING_ID
              ? t('techniques.stopListening')
              : t('mindMaps.listenToMap')}
        </button>
        {!isAiBackendConfigured() && voiceAvailable && (
          <span className="rounded-full bg-accent-tint px-2.5 py-1 text-[0.6875rem] font-semibold text-accent">
            {t('readingBuddy.demoVoiceBadge')}
          </span>
        )}
      </div>
      {errorId !== null && (
        <p role="alert" className="mb-4 text-[0.8125rem] text-ink-muted">
          {t('techniques.voiceUnavailable')}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong px-3.5 py-2 text-sm font-semibold text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          <DownloadIcon className="size-4" />
          {t('mindMaps.export')}
        </button>
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
          className={`inline-flex items-center gap-2 rounded-control border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${
            editMode ? '' : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent'
          } ${focusRing}`}
        >
          <EditIcon className="size-4" />
          {t('mindMaps.editButton')}
        </button>
        {/* Colour (task #211) — same toggle shape as Edit map right next
            to it, and the SAME gate as automatic branch colouring
            (colorByBranch): both are part of one #211/#204 feature set.
            Originally scoped to the AI generator's output only (team-lead's
            call — "default to the generator's interactive map... flag if
            the technique maps should get it too"); on 2026-08-19 Amal
            asked for the colouring on the Reading Techniques example too,
            so that call now passes colorByBranch and this button renders
            there as well. */}
        {colorByBranch && (
          <button
            type="button"
            onClick={() => setColorMode((v) => !v)}
            aria-pressed={colorMode}
            className={`inline-flex items-center gap-2 rounded-control border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent ${
              colorMode ? '' : 'border-line-strong text-ink-muted hover:border-accent hover:text-accent'
            } ${focusRing}`}
          >
            <PaletteIcon className="size-4" />
            {t('mindMaps.colorButton')}
          </button>
        )}
      </div>

      <div
        className="relative max-h-[70vh] overflow-auto rounded-control border border-line bg-cream/50"
        dir="ltr"
      >
        {/* dir="ltr" pinned here deliberately: the SVG's own coordinate
            space is not dir-aware (see mindMapLayout.ts) — the mirroring
            is already baked into node.x by layoutMindMap, so this
            wrapper must NOT also flip under the page's ambient RTL
            direction, or the diagram would be mirrored twice.

            max-h + overflow-auto (added for the 4-level ~50-node
            Reading Techniques example, 2026-08-13): a tree that size is
            taller than any single viewport, so the diagram now scrolls
            within its own contained box, both axes, instead of forcing
            the whole page to be one huge scroll — a lighter-weight
            stand-in for pan/zoom that needs no new interaction model
            (native scroll is already fully keyboard/trackpad/touch
            accessible). Harmless for the smaller maps this component
            also renders — the max-height only ever engages once content
            actually exceeds it. */}
        {/* Align the map to the reading-start side within its scroll box:
            RTL pushes it to the RIGHT so the root sits flush to the box's
            right edge with no empty gap on its right (Amal, 2026-08-19);
            LTR stays left (root flush left, unchanged). A block wrapper
            sized to the map (not the SVG alone) so the absolutely-
            positioned node/toggle buttons, which sit relative to this box,
            move WITH the SVG. `ml-auto` only shifts when the map is
            NARROWER than the box; a wide/expanded map fills it and still
            scrolls normally (auto margin resolves to 0 when overflowing). */}
        <div className={`relative ${rtl ? 'ml-auto' : ''}`} style={{ width }}>
        <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('mindMaps.diagramAlt', { title })} className="block">
          <g>
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.fromId)
              const to = nodes.find((n) => n.id === edge.toId)
              if (!from || !to) return null
              const midX = (from.x + to.x) / 2
              // Colored by the edge's DESTINATION node's effective
              // colour (branch colour, or a user override if the reader
              // gave that specific idea its own colour) — every edge's
              // `toId` is a non-root node (root has no incoming edge),
              // so this naturally colors root->branch edges too, using
              // whatever colour the branch it's entering resolves to.
              const edgeColor = colorByBranch ? effectiveFill(edge.toId, false).border : undefined
              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={`M${from.x},${from.y} C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`}
                  fill="none"
                  stroke={edgeColor ?? LINE_STRONG}
                  strokeWidth={1.5}
                />
              )
            })}
          </g>
          <g>
            {nodes.map((node) => {
              const lines = wrapLabel(node.label, charsPerLine)
              const isRoot = node.depth === 0
              const hasNote = Boolean(notes[node.id])
              const { fill: nodeFill, border: nodeBorder } = effectiveFill(node.id, isRoot)
              return (
                <g key={node.id}>
                  <rect
                    x={node.x - NODE_W / 2}
                    y={node.y - NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={12}
                    fill={nodeFill}
                    stroke={isRoot ? 'none' : nodeBorder}
                    strokeWidth={isRoot ? 0 : 1.5}
                  />
                  {selectedNodeId === node.id && (
                    <rect
                      x={node.x - NODE_W / 2 - 3}
                      y={node.y - NODE_H / 2 - 3}
                      width={NODE_W + 6}
                      height={NODE_H + 6}
                      rx={14}
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth={2}
                    />
                  )}
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    fill={isRoot ? ACCENT_INK : INK}
                    // #258: the SVG wrapper is pinned dir="ltr" (so the
                    // diagram isn't mirrored), which made the Arabic <text>
                    // inherit direction:ltr — that garbles any Arabic label
                    // with punctuation/parentheses or mixed number ordering
                    // (e.g. «(بصوتٍ عالٍ)», «صفحة 12 من 40»), the «مكسرة»
                    // break. Pin the text's OWN base direction rtl + isolate
                    // its bidi so each label resolves right-to-left. Node
                    // positions are explicit x + textAnchor:middle, so this
                    // is bidi-only and does NOT move anything.
                    style={{
                      fontSize: 12.5,
                      fontWeight: isRoot ? 700 : 600,
                      fontFamily: rtl ? FONT_ARABIC : FONT_LATIN,
                      direction: rtl ? 'rtl' : 'ltr',
                      unicodeBidi: 'isolate',
                    }}
                  >
                    {lines.map((line, i) => (
                      <tspan key={i} x={node.x} y={node.y + (i - (lines.length - 1) / 2) * LINE_HEIGHT}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  {hasNote && <circle cx={node.x + NODE_W / 2 - 9} cy={node.y - NODE_H / 2 + 9} r={5} fill={NOTE_DOT} />}
                </g>
              )
            })}
          </g>
        </svg>

        {nodes.map((node) => {
          const hasNote = Boolean(notes[node.id])
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => selectNode(node.id)}
              aria-pressed={selectedNodeId === node.id}
              aria-label={hasNote ? t('mindMaps.nodeWithNoteLabel', { label: node.label }) : node.label}
              style={{ left: node.x - NODE_W / 2, top: node.y - NODE_H / 2, width: NODE_W, height: NODE_H }}
              className={`absolute rounded-[12px] ${focusRing}`}
            />
          )
        })}

        {/* Expand/collapse toggles (2026-08-13) — a separate sibling
            button per collapsible node, not nested inside the select
            button above (a <button> can't contain another <button>).
            Sits on the edge facing where its children would appear —
            the node's own x is already RTL-mirrored by layoutMindMap,
            so "which edge" is a simple rtl check, same pattern as
            everywhere else coordinate math happens in this file. */}
        {nodes
          // depth > 0: the root never gets a toggle — its children
          // (the 3 families) must always stay visible, the one part
          // of the default view that isn't optional (Amal's ask).
          .filter((node) => node.hasChildren && node.depth > 0)
          .map((node) => (
            <button
              key={`toggle-${node.id}`}
              type="button"
              onClick={() => toggleCollapse(node.id)}
              aria-expanded={!node.collapsed}
              aria-label={
                node.collapsed
                  ? t('mindMaps.expandNode', { label: node.label })
                  : t('mindMaps.collapseNode', { label: node.label })
              }
              style={{
                left: (rtl ? node.x - NODE_W / 2 : node.x + NODE_W / 2) - TOGGLE_SIZE / 2,
                top: node.y - TOGGLE_SIZE / 2,
                width: TOGGLE_SIZE,
                height: TOGGLE_SIZE,
              }}
              className={`absolute flex items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
            >
              <ChevronIcon
                aria-hidden="true"
                className="size-3"
                style={{ transform: `rotate(${node.collapsed ? (rtl ? 180 : 0) : 90}deg)` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {editMode && selectedNode && (
          <div className="rounded-control border border-line bg-cream/50 p-3.5">
            <label htmlFor="mindmap-label" className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
              {t('mindMaps.editNodeLabel', { label: selectedNode.label })}
            </label>
            <input
              ref={labelInputRef}
              id="mindmap-label"
              type="text"
              value={draftLabel}
              maxLength={MAX_LABEL_LENGTH}
              onChange={(e) => setDraftLabel(e.target.value)}
              dir={rtl ? 'rtl' : 'ltr'}
              className={`w-full rounded-control border-[1.5px] border-line-strong bg-card p-2 text-[0.8125rem] text-ink ${focusRing}`}
            />
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleAddBranch}
                className={`inline-flex items-center gap-1.5 rounded-control border-[1.5px] border-line-strong px-3.5 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
              >
                <AddIcon className="size-3.5" />
                {t('mindMaps.addBranch')}
              </button>
              <button
                type="button"
                onClick={saveDraftLabel}
                disabled={!draftLabel.trim()}
                className={`inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                <EditIcon className="size-3.5" />
                {t('mindMaps.saveText')}
              </button>
            </div>
          </div>
        )}

        {/* Colour panel (task #211) — same "toggle + selected-node-gated
            panel" shape as the edit panel just above, independently so
            both can be open together (they touch different attributes,
            text vs colour, no conflict). Root is never colourable (it
            keeps its fixed solid ACCENT identity colour, same rule as
            #204's branch colouring), so this checks depth explicitly
            rather than reusing a generic "a node is selected" gate. */}
        {colorMode && selectedNode && selectedNode.depth > 0 && (
          <div className="rounded-control border border-line bg-cream/50 p-3.5">
            <ColorWheelField
              idPrefix={`mindmap-color-${mapId}`}
              legend={t('mindMaps.colorLegend', { label: selectedNode.label })}
              caption={t('mindMaps.colorCaption')}
              value={effectiveFill(selectedNode.id, false).fill}
              onChange={(hex) => setColor(selectedNode.id, hex)}
              backgroundHex={INK}
              lightnessLabel={t('settings.textColorLightness')}
              hexLabel={t('settings.textColorHexLabel')}
              previewLabel={t('settings.textColorPreviewLabel')}
              wheelAriaLabel={(hex) => t('mindMaps.colorWheelLabel', { hex })}
              formatContrastLabel={(ratio) => t('settings.contrastRatioLabel', { ratio })}
              contrastGoodLabel={t('settings.contrastGood')}
              contrastWarningLabel={t('settings.contrastWarningLow')}
              sampleText={rtl ? 'أب' : 'Aa'}
            />
            {colors[selectedNode.id] && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setColor(selectedNode.id, null)}
                  className={`inline-flex items-center gap-1.5 rounded-control border-[1.5px] border-line-strong px-3.5 py-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:border-accent hover:text-accent ${focusRing}`}
                >
                  {t('mindMaps.resetColorButton')}
                </button>
              </div>
            )}
          </div>
        )}
        {colorMode && (!selectedNode || selectedNode.depth === 0) && (
          <div className="rounded-control border border-line bg-cream/50 p-3.5">
            <p className="m-0 text-[0.8125rem] text-ink-muted">{t('mindMaps.selectNodeToColorHint')}</p>
          </div>
        )}

        <div className="rounded-control border border-line bg-cream/50 p-3.5">
          {selectedNode ? (
            <>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="mindmap-note" className="text-[0.8125rem] font-semibold text-ink">
                  {t('mindMaps.noteForNode', { label: selectedNode.label })}
                </label>
                <span className="flex flex-none items-center gap-2">
                  {!isAiBackendConfigured() && voiceAvailable && (
                    <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[0.6875rem] font-semibold text-accent">
                      {t('readingBuddy.demoVoiceBadge')}
                    </span>
                  )}
                  <SpeakerButton lang={lang} isActive={speakingId === selectedNode.id} isPreparing={preparingId === selectedNode.id} onToggle={() => speakNode(selectedNode)} size="sm" />
                </span>
              </div>
              <textarea
                id="mindmap-note"
                rows={2}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={t('mindMaps.notePlaceholder')}
                className={`w-full resize-y rounded-control border-[1.5px] border-line-strong bg-card p-2 text-[0.8125rem] text-ink placeholder:text-ink-muted ${focusRing}`}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={saveDraftNote}
                  className={`inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-accent-ink hover:bg-accent-hover ${focusRing}`}
                >
                  <NoteIcon className="size-3.5" />
                  {t('mindMaps.saveNote')}
                </button>
              </div>
            </>
          ) : (
            <p className="m-0 text-[0.8125rem] text-ink-muted">
              {editMode ? t('mindMaps.selectNodeToEditHint') : t('mindMaps.selectNodeHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Naive greedy word-wrap by character count (not measured pixel width)
// — a reasonable approximation given labels are either hand-authored
// demo content sized with this budget in mind, or a user-typed label
// capped at MAX_LABEL_LENGTH above. Real LLM-generated labels (once an
// AI backend is keyed) should be kept short by the generation prompt
// itself rather than this function growing a true text-measurement
// fallback.
function wrapLabel(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}
