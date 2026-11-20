"""Cleans a narration script before it is sent to text-to-speech. Standard library only.

The Voice Agent writes pacing cues in brackets ([PAUSE 1s], [EMPHASIZE], [SLOW DOWN] and so on). ElevenLabs does not
act on them, so it either reads them aloud or ignores them. This module:
  - turns a pause cue into an ellipsis, so the voice pauses where the cue was;
  - removes the other pacing cues and the video markers (VIDEO CUE, ACTION, WHITEBOARD, DIAGRAM TYPE);
  - leaves any other bracketed text as written, because it may be spoken text.
Punctuation that the script already has is kept: it sets the pauses and the sentence breaks.
"""
import re

CUE = re.compile(r"\[[^\[\]\n]{1,80}\]")
PAUSE = re.compile(r"^PAUSE\b", re.I)
DROP = re.compile(r"^(EMPHASIZE|SLOW DOWN|SPEED UP|WHISPER|EXCITED|VIDEO CUE|ACTION|WHITEBOARD|DIAGRAM TYPE)\b", re.I)


def _replace(match):
    inner = match.group(0)[1:-1].strip()
    if PAUSE.match(inner):
        return " ... "
    if DROP.match(inner):
        return " "
    return match.group(0)


def clean_for_speech(text):
    out = CUE.sub(_replace, text)
    out = re.sub(r"[ \t]{2,}", " ", out)           # collapse the spaces the removals leave behind
    out = re.sub(r" +(?!\.\.)([.,;:!?])", r"\1", out)  # no space before punctuation (but keep the space before an ellipsis)
    out = re.sub(r"\n[ \t]+", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()
