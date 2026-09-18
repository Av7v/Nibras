import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseFile, type ParsedFile } from '../../lib/fileParsers'
import { focusRingInset } from '../../lib/focus'

/** "Open a file" — accepts PDF/EPUB/Word (.docx)/.txt, parses entirely
 * client-side (the file is never uploaded anywhere) and hands the
 * extracted sections back to the caller. Self-contained: owns its own
 * loading/error state so the Reader page doesn't need to know
 * anything about File objects or parser internals. */
export function FileOpenButton({
  onParsed,
  uiLanguageFallback,
  className = 'mb-6',
}: {
  onParsed: (result: ParsedFile) => void
  /** Used only when a file has no language of its own to detect from
   * (e.g. an all-numeric .txt) — the document's actual script always
   * wins over this once there's real text to judge it from. */
  uiLanguageFallback: 'en' | 'ar'
  /** Wrapper class; defaults to the standalone `mb-6`. The Reader passes
   * '' to place it in a shared row with the "open from Library" button
   * (#260); the Library keeps the default. */
  className?: string
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file next time
    if (!file) return

    setStatus('parsing')
    setErrorMessage('')
    try {
      const result = await parseFile(file, uiLanguageFallback)
      setStatus('idle')
      onParsed(result)
    } catch {
      // Always the translated, generic message (nibras-qa P1-6,
      // 2026-08-13) — the underlying error (`lib/fileParsers/*`) is
      // English-only regardless of UI language, and its exact wording
      // is an implementation detail not meant for the reader (could
      // even end up describing internal parser state). One honest,
      // bilingual "couldn't open this file" covers every failure case
      // the same way in both languages.
      setStatus('error')
      setErrorMessage(t('reader.fileError'))
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub,.docx,.txt,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        onChange={handleFileChange}
        className="sr-only"
        id="file-open-input"
      />
      <label htmlFor="file-open-input" className="sr-only">
        {t('reader.openFile')}
      </label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'parsing'}
        className={`inline-flex items-center gap-2 rounded-control border-[1.5px] border-line-strong bg-card px-4 py-2 text-sm font-semibold text-ink disabled:cursor-wait disabled:opacity-70 ${focusRingInset}`}
      >
        {status === 'parsing' ? t('reader.parsingFile') : t('reader.openFile')}
      </button>
      <span className="ms-2.5 text-[0.8125rem] text-ink-muted">{t('reader.fileTypes')}</span>
      {status === 'error' && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-ink">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
