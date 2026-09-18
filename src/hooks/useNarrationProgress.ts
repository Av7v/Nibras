import { useSyncExternalStore } from 'react'
import {
  getNarrationSnapshot,
  subscribeNarration,
  type NarrationProgress,
} from '../lib/narrationProgress'

/** Task #361 (2026-09-13) — subscribe to the current read-aloud's live
 * progress (see lib/narrationProgress.ts). The word-by-word reading
 * ruler uses this to highlight the word the Reading Buddy voice is
 * speaking; ReadingBuddyPlayer publishes into the same store as it
 * plays. Same `useSyncExternalStore` shape as useVoicePreference. */
export function useNarrationProgress(): NarrationProgress {
  return useSyncExternalStore(subscribeNarration, getNarrationSnapshot)
}
