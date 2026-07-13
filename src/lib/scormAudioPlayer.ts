/**
 * SCORM Audio Player - Handles audio playback with text highlighting
 * Coordinates narration timing with on-screen text for synchronized learning
 */

export interface AudioCue {
  startMs: number;
  endMs: number;
  sentenceIndex: number;
  text: string;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  currentSentenceIndex: number;
}

/**
 * Parses narration text into sentences for synchronized highlighting
 */
export function parseSentences(text: string): Array<{ index: number; text: string }> {
  if (!text) return [];

  // Split by sentence-ending punctuation, preserving punctuation
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences.map((text, index) => ({ index, text }));
}

/**
 * Generates audio cues for synchronized highlighting
 * Distributes sentence timing evenly across audio duration
 */
export function generateAudioCues(
  narrationText: string,
  audioDurationMs: number
): AudioCue[] {
  const sentences = parseSentences(narrationText);
  if (sentences.length === 0) return [];

  const cues: AudioCue[] = [];
  const msPerSentence = Math.max(1000, audioDurationMs / sentences.length);

  sentences.forEach((sentence, index) => {
    const startMs = index * msPerSentence;
    const endMs = Math.min((index + 1) * msPerSentence, audioDurationMs);

    cues.push({
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      sentenceIndex: index,
      text: sentence.text,
    });
  });

  return cues;
}

/**
 * Finds the active sentence at given playback time
 */
export function findActiveSentence(cues: AudioCue[], currentTimeMs: number): AudioCue | undefined {
  return cues.find((cue) => currentTimeMs >= cue.startMs && currentTimeMs < cue.endMs);
}

/**
 * Creates HTML with sentence-level highlighting markup
 * Each sentence gets a unique ID for highlight targeting
 */
export function wrapSentencesInMarkup(
  text: string,
  sentenceClass: string = "scorm-sentence"
): string {
  const sentences = parseSentences(text);

  const wrapped = sentences
    .map(
      (sentence, index) =>
        `<span class="${sentenceClass}" data-sentence-index="${index}" id="sentence-${index}">${escapeHtml(sentence.text)}</span>`
    )
    .join(" ");

  return `<div class="scorm-narration-text">${wrapped}</div>`;
}

/**
 * Highlights active sentence(s) in the UI
 * Call this from audio timeupdate event
 */
export function highlightSentence(sentenceIndex: number): void {
  // Remove previous highlight
  document.querySelectorAll(".scorm-sentence.active").forEach((el) => {
    el.classList.remove("active");
  });

  // Add highlight to current sentence
  const currentSentence = document.getElementById(`sentence-${sentenceIndex}`);
  if (currentSentence) {
    currentSentence.classList.add("active");
    // Smooth scroll into view
    currentSentence.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/**
 * Creates CSS for sentence highlighting
 */
export function createSentenceHighlightingCss(): string {
  return `
    .scorm-narration-text {
      line-height: 1.8;
      font-size: 1rem;
      color: #334155;
    }

    .scorm-sentence {
      transition: all 200ms ease-in-out;
      padding: 2px 4px;
      border-radius: 3px;
    }

    .scorm-sentence.active {
      background-color: #fef08a;
      color: #714c06;
      font-weight: 600;
      box-shadow: 0 0 0 2px #facc15;
    }

    .scorm-audio-player {
      margin: 1.5rem 0;
      padding: 1rem;
      background-color: #f1f5f9;
      border-radius: 0.5rem;
      border-left: 4px solid #4f46e5;
    }

    .scorm-audio-player audio {
      width: 100%;
      height: 44px;
      margin-bottom: 0.5rem;
    }

    .scorm-playback-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 0.5rem;
    }

    .scorm-progress-bar {
      width: 100%;
      height: 6px;
      background-color: #e2e8f0;
      border-radius: 3px;
      margin-top: 0.5rem;
      overflow: hidden;
    }

    .scorm-progress-fill {
      height: 100%;
      background-color: #4f46e5;
      transition: width 0.1s linear;
    }
  `;
}

/**
 * Formats milliseconds to MM:SS display
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Creates audio player HTML element
 */
export function createAudioPlayerHtml(
  audioUrl: string,
  narrationText: string,
  playerId: string = "scorm-audio-player"
): string {
  const sentenceMarkup = wrapSentencesInMarkup(narrationText);

  return `
    <div class="scorm-audio-player" id="${playerId}">
      <audio controls style="width: 100%;">
        <source src="${escapeHtml(audioUrl)}" type="audio/mpeg">
        Your browser does not support the audio element.
      </audio>
      <div class="scorm-playback-info">
        <span class="scorm-current-time">0:00</span>
        <span class="scorm-duration">0:00</span>
      </div>
      <div class="scorm-progress-bar">
        <div class="scorm-progress-fill" style="width: 0%"></div>
      </div>
      ${sentenceMarkup}
    </div>
  `;
}

/**
 * Initializes audio player with sentence highlighting
 * Call this after DOM is ready
 */
export function initializeAudioPlayer(
  playerId: string = "scorm-audio-player",
  narrationText?: string
): {
  cleanup: () => void;
  updateState: (state: AudioPlaybackState) => void;
} {
  const playerEl = document.getElementById(playerId);
  if (!playerEl) {
    console.warn(`[Audio Player] Player element not found: ${playerId}`);
    return { cleanup: () => {}, updateState: () => {} };
  }

  const audioEl = playerEl.querySelector("audio") as HTMLAudioElement | null;
  if (!audioEl) {
    console.warn(`[Audio Player] Audio element not found in player`);
    return { cleanup: () => {}, updateState: () => {} };
  }

  let cues: AudioCue[] = [];

  // Generate cues when metadata loads
  const handleLoadedMetadata = () => {
    if (narrationText) {
      cues = generateAudioCues(narrationText, audioEl.duration * 1000);
      console.log("[Audio Player] Generated cues:", cues.length);
    }
  };

  // Update progress and highlight
  const handleTimeUpdate = () => {
    const currentTimeMs = audioEl.currentTime * 1000;
    const activeCue = findActiveSentence(cues, currentTimeMs);

    if (activeCue) {
      highlightSentence(activeCue.sentenceIndex);
    }

    // Update progress bar
    const progressFill = playerEl.querySelector(".scorm-progress-fill") as HTMLElement | null;
    if (progressFill) {
      const percent = (audioEl.currentTime / audioEl.duration) * 100;
      progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    // Update time display
    const currentTimeEl = playerEl.querySelector(".scorm-current-time");
    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(currentTimeMs);
    }
  };

  // Update duration display
  const handleLoadedData = () => {
    const durationEl = playerEl.querySelector(".scorm-duration");
    if (durationEl) {
      durationEl.textContent = formatTime(audioEl.duration * 1000);
    }
  };

  // Listen to audio events
  audioEl.addEventListener("loadedmetadata", handleLoadedMetadata);
  audioEl.addEventListener("timeupdate", handleTimeUpdate);
  audioEl.addEventListener("loadeddata", handleLoadedData);

  // Trigger metadata load if already cached
  if (audioEl.duration) {
    handleLoadedMetadata();
  }

  // Cleanup function
  const cleanup = () => {
    audioEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
    audioEl.removeEventListener("timeupdate", handleTimeUpdate);
    audioEl.removeEventListener("loadeddata", handleLoadedData);
  };

  return {
    cleanup,
    updateState: (state: AudioPlaybackState) => {
      if (state.isPlaying) {
        audioEl.play();
      } else {
        audioEl.pause();
      }
      audioEl.currentTime = state.currentTimeMs / 1000;
    },
  };
}

/**
 * Helper to escape HTML in strings
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
