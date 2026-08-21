/**
 * POST /mindmap — real implementation (task #151, 2026-08-14; was a
 * stub). Returns a tree of nodes representing `text` as a mind map
 * (see src/lib/aiService.ts's `MindMapNode`/`MindMapResult` types —
 * this file's own local interfaces below are kept in sync with them
 * by hand, same convention `voice.ts` already uses for its own
 * request/response shapes).
 *
 * Calls xAI's real chat-completions API (`_xaiChat.ts`, the text
 * counterpart to `_xaiTts.ts`'s voice adapter — same `AI_VOICE_API_KEY`,
 * not the placeholder `AI_TEXT_API_KEY` the original stub referenced;
 * see translate.ts's own comment for why Amal's one xAI key already
 * covers text calls). The model is constrained to a bounded JSON
 * schema (root -> up to 6 branches -> up to 6 leaves, short labels) —
 * this is deliberately NOT what the reference nibrasapp.com/mindmaps
 * page's own live output does (full-sentence-fragment children, which
 * is exactly what produced its truncated/overlapping nodes — see
 * teamlead's own #151 approval: recreate the design, not its bugs).
 * Even with xAI's schema enforcement, the parsed result is still
 * independently shape-validated here before ever being trusted
 * (`validateRawTree`) — the provider's own "strict" guarantee is not a
 * substitute for this backend's normal defense-in-depth.
 */
import { generateStructuredJson, type XaiUsage } from './_xaiChat.ts'
import { stripDashes } from './_text.ts'

interface MindMapRequest {
  text: string
  lang: 'en' | 'ar'
}

interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
}

interface MindMapResponse {
  root: MindMapNode
  demo: false
}

/** What the handler returns to `server/index.ts`: the client-facing
 * response PLUS the provider's real token usage, so index.ts can true up
 * the spend cap to ACTUAL tokens (task #148) rather than the conservative
 * pre-auth estimate. `usage` is null if xAI omitted it (index.ts then
 * falls back to the estimate). The client only ever receives `response`. */
export interface MindMapHandlerResult {
  response: MindMapResponse
  usage: XaiUsage | null
}

/** "Paste A PARAGRAPH" (the reference page's own copy) — a tighter cap
 * than the 15,000-char ceiling `_xaiTts.ts`/`server/index.ts` use for
 * a reader's own document text. A mind map from an arbitrarily long
 * document doesn't make UX sense for this feature (the reference
 * site's own copy: "shorter, focused paragraphs produce sharper
 * maps"), and a smaller cap keeps generation latency/cost predictable. */
const MAX_MINDMAP_CHARS = 4000

const MAX_LABEL_LENGTH = 40
const MAX_BRANCHES = 6
const MAX_LEAVES_PER_BRANCH = 6

// Raw shape requested from the model — NO `id` field (the model has no
// business inventing ids; this file assigns them itself once the
// shape is validated, so a malformed/adversarial id can never reach
// the client either).
const LEAF_SCHEMA = {
  type: 'object',
  properties: { label: { type: 'string', maxLength: MAX_LABEL_LENGTH } },
  required: ['label'],
  additionalProperties: false,
}
const BRANCH_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', maxLength: MAX_LABEL_LENGTH },
    children: { type: 'array', maxItems: MAX_LEAVES_PER_BRANCH, items: LEAF_SCHEMA },
  },
  required: ['label', 'children'],
  additionalProperties: false,
}
// Exported (with buildSystemPrompt) only so a real-generation proof can
// call xAI with the EXACT schema + prompt the server uses, to measure the
// true token magnitude for spend-cap accounting (#148) rather than a
// re-implemented approximation that could drift. Same test-support
// rationale as the exported validateRawTree below.
export const ROOT_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', maxLength: MAX_LABEL_LENGTH },
    children: { type: 'array', minItems: 2, maxItems: MAX_BRANCHES, items: BRANCH_SCHEMA },
  },
  required: ['label', 'children'],
  additionalProperties: false,
}

export function buildSystemPrompt(lang: 'en' | 'ar'): string {
  const languageRule =
    lang === 'ar'
      ? 'Write every label in Modern Standard Arabic (الفصحى) only — never a regional dialect.'
      : 'Write every label in English.'
  return [
    'You turn a short paragraph into a mind map for a reading-accessibility app used by people with dyslexia — someone who thinks visually/spatially, not in lines of text.',
    'Rules:',
    '- Every "label" must be a SHORT phrase (2-5 words) — never a full sentence, never truncated or cut off mid-word.',
    "- The root label is the paragraph's own central topic, in a word or short phrase.",
    '- Provide 2 to 6 top-level branches: distinct themes, steps, or aspects of the topic. Never repeat the root label or any sibling label.',
    '- Each branch may have 0 to 6 short child labels giving one concrete supporting detail each.',
    languageRule,
    'Output only the structured data — no commentary.',
  ].join('\n')
}

/** Independent shape check on the parsed JSON before trusting it AT
 * ALL — depth/branch/leaf caps mirror the schema above but are
 * re-enforced here rather than assumed, exactly the same "don't just
 * trust the provider's own guarantee" posture `_xaiChat.ts`'s header
 * comment states. Returns the validated raw tree, or throws.
 *
 * Exported (only this one function, everything else here stays
 * private) so a real, deterministic malformed-input test can call the
 * ACTUAL validation code directly rather than either re-implementing
 * it in a test file (drifts out of sync silently) or depending on a
 * live LLM call misbehaving on demand (flaky, unreliable) — see
 * _verify/proof-151-mindmap-generator.mjs. */
export function validateRawTree(value: unknown): { label: string; children: { label: string; children: { label: string }[] }[] } {
  function isNonEmptyShortString(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_LABEL_LENGTH
  }
  if (typeof value !== 'object' || value === null) throw new Error('mindmap: root is not an object')
  const root = value as Record<string, unknown>
  if (!isNonEmptyShortString(root.label)) throw new Error('mindmap: root label invalid')
  if (!Array.isArray(root.children) || root.children.length === 0) throw new Error('mindmap: root has no branches')
  const branches = root.children.slice(0, MAX_BRANCHES).map((rawBranch, i) => {
    if (typeof rawBranch !== 'object' || rawBranch === null) throw new Error(`mindmap: branch ${i} is not an object`)
    const branch = rawBranch as Record<string, unknown>
    if (!isNonEmptyShortString(branch.label)) throw new Error(`mindmap: branch ${i} label invalid`)
    const rawLeaves = Array.isArray(branch.children) ? branch.children.slice(0, MAX_LEAVES_PER_BRANCH) : []
    const leaves = rawLeaves.map((rawLeaf, j) => {
      if (typeof rawLeaf !== 'object' || rawLeaf === null) throw new Error(`mindmap: leaf ${i}.${j} is not an object`)
      const leaf = rawLeaf as Record<string, unknown>
      if (!isNonEmptyShortString(leaf.label)) throw new Error(`mindmap: leaf ${i}.${j} label invalid`)
      return { label: leaf.label }
    })
    return { label: branch.label, children: leaves }
  })
  return { label: root.label, children: branches }
}

/** Assigns simple, collision-free ids depth-first — the model never
 * invents ids (see the schema above), so there is nothing to trust or
 * sanitize here, just a plain counter. */
function toMindMapNode(
  raw: { label: string; children?: { label: string; children?: { label: string }[] }[] },
  counter: { n: number },
  lang: 'en' | 'ar',
): MindMapNode {
  const id = `aigen-${counter.n++}`
  // Deterministic no-em-dash strip on every user-facing label (Amal's
  // standing rule, app-wide — the prompt also forbids it, this guarantees it).
  const label = stripDashes(raw.label, lang)
  const children = raw.children?.map((child) => toMindMapNode(child, counter, lang))
  return children && children.length > 0 ? { id, label, children } : { id, label }
}

export async function handleMindMapRequest(body: MindMapRequest): Promise<MindMapHandlerResult> {
  const text = (body.text ?? '').slice(0, MAX_MINDMAP_CHARS)
  if (!text.trim()) {
    throw new Error('mindmap: empty text')
  }

  const { data: rawResult, usage } = await generateStructuredJson({
    systemPrompt: buildSystemPrompt(body.lang),
    userText: text,
    schemaName: 'nibras_mind_map',
    schema: ROOT_SCHEMA,
  })
  const validated = validateRawTree(rawResult)
  const root = toMindMapNode(validated, { n: 0 }, body.lang)

  return { response: { root, demo: false }, usage }
}
