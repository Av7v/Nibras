/**
 * Ambient types for the Web Speech API's `SpeechRecognition` (task
 * #150, 2026-08-14) — confirmed, by grepping the installed
 * `node_modules/typescript/lib/lib.dom.d.ts` directly (not assumed),
 * that TypeScript's own bundled DOM lib declares the SATELLITE types
 * (`SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`,
 * `SpeechRecognitionResult(List)`, `SpeechRecognitionAlternative`) but
 * NOT the `SpeechRecognition` interface/constructor itself, nor
 * `webkitSpeechRecognition`, nor the newer `available()`/`install()`
 * static methods — so this file declares the whole thing, reusing
 * lib.dom.d.ts's own already-correct satellite types rather than
 * redeclaring those too.
 *
 * `available`/`install` are real, MDN-documented, currently-
 * experimental additions (see
 * https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static
 * and .../install_static) — confirmed genuinely present and working in
 * this project's own real installed Chrome via a direct Playwright
 * test: `available({langs:['en-US'], processLocally:true})` ->
 * `"downloadable"`, then `install(...)` -> `true`, then a follow-up
 * `available()` -> `"available"`.
 *
 * Everything here lives INSIDE `declare global` deliberately — this
 * file has a top-level `export {}` (needed so it's treated as a
 * module, the standard way to safely augment `Window` without
 * clobbering the ambient global scope), and TypeScript only lets
 * declarations inside `declare global {}` escape that module's own
 * private scope; anything declared OUTSIDE it in a file that also has
 * a top-level `export`/`import` becomes module-private instead of
 * truly global (a real mistake caught by `npx tsc -b` on the first
 * pass of writing this file — every consumer needs these as bare
 * global names, not an import).
 *
 * Scoped to exactly the members `lib/speechRecognition.ts` actually
 * uses — not a complete spec-accurate declaration of every optional
 * SpeechRecognition property.
 */

declare global {
  type SpeechRecognitionAvailabilityStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable'

  interface SpeechRecognitionAvailabilityOptions {
    langs: string[]
    processLocally?: boolean
    quality?: 'command' | 'dictation' | 'conversation'
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    abort(): void
    onstart: (() => void) | null
    onend: (() => void) | null
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition
    available(options: SpeechRecognitionAvailabilityOptions): Promise<SpeechRecognitionAvailabilityStatus>
    install(options: SpeechRecognitionAvailabilityOptions): Promise<boolean>
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export {}
