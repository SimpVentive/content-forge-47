"""Offline checks for ELEVEN_OUTPUT_FORMAT: the cache key, the format handling, and the WAV wrap of raw PCM.
No ElevenLabs call is made: urlopen is replaced by a fake that returns a known response. No spend.

Run: python tools/test_eleven_output_format.py
"""
import base64, io, json, os, sys, unittest, wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_module as mm  # noqa: E402

VOICE = {"voice_id": "voice-abc", "settings": {"stability": 0.5, "similarity_boost": 0.75}, "model_id": "eleven_multilingual_v2"}
SCRIPT = "Hello there. This is a test."


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf8")


class OutputFormatTests(unittest.TestCase):
    def setUp(self):
        self.saved = os.environ.pop("ELEVEN_OUTPUT_FORMAT", None)

    def tearDown(self):
        os.environ.pop("ELEVEN_OUTPUT_FORMAT", None)
        if self.saved is not None:
            os.environ["ELEVEN_OUTPUT_FORMAT"] = self.saved

    # The format setting
    def test_default_format_when_unset(self):
        self.assertEqual(mm.eleven_output_format(), "mp3_44100_128")

    def test_format_from_the_environment(self):
        os.environ["ELEVEN_OUTPUT_FORMAT"] = "pcm_44100"
        self.assertEqual(mm.eleven_output_format(), "pcm_44100")

    def test_unsupported_format_is_refused(self):
        for bad in ("ogg_vorbis", "mp3", "pcm_", "mp3_44100_128; rm -rf", "../x"):
            os.environ["ELEVEN_OUTPUT_FORMAT"] = bad
            with self.assertRaises(SystemExit):
                mm.eleven_output_format()

    # The cache key
    def test_default_format_key_is_the_old_key(self):
        legacy = mm.sha(SCRIPT, VOICE["voice_id"], VOICE["settings"], VOICE["model_id"])
        self.assertEqual(mm.narration_key(SCRIPT, VOICE, "mp3_44100_128"), legacy,
                         "existing narrations must still be reused under the default format")

    def test_a_format_change_makes_a_new_key(self):
        default = mm.narration_key(SCRIPT, VOICE, "mp3_44100_128")
        self.assertNotEqual(mm.narration_key(SCRIPT, VOICE, "pcm_44100"), default)
        self.assertNotEqual(mm.narration_key(SCRIPT, VOICE, "mp3_22050_32"), default)
        self.assertNotEqual(mm.narration_key(SCRIPT, VOICE, "pcm_44100"), mm.narration_key(SCRIPT, VOICE, "pcm_22050"))

    def test_the_key_is_stable_for_the_same_inputs(self):
        self.assertEqual(mm.narration_key(SCRIPT, VOICE, "pcm_44100"), mm.narration_key(SCRIPT, VOICE, "pcm_44100"))

    def test_the_script_and_voice_still_change_the_key(self):
        self.assertNotEqual(mm.narration_key("Other text.", VOICE, "pcm_44100"), mm.narration_key(SCRIPT, VOICE, "pcm_44100"))
        other = dict(VOICE, voice_id="voice-xyz")
        self.assertNotEqual(mm.narration_key(SCRIPT, other, "pcm_44100"), mm.narration_key(SCRIPT, VOICE, "pcm_44100"))

    # The file name
    def test_the_narration_file_extension(self):
        self.assertEqual(mm.narration_ext("pcm_44100"), ".wav")
        self.assertEqual(mm.narration_ext("mp3_44100_128"), ".mp3")

    # The WAV wrap of raw PCM
    def test_raw_pcm_becomes_a_wav_with_the_same_samples(self):
        samples = (b"\x01\x00" * 4410)  # 0.1 s of 16-bit mono at 44.1 kHz
        wav_bytes = mm.pcm_to_wav(samples, 44100)
        with wave.open(io.BytesIO(wav_bytes), "rb") as w:
            self.assertEqual(w.getnchannels(), 1)
            self.assertEqual(w.getsampwidth(), 2)
            self.assertEqual(w.getframerate(), 44100)
            self.assertEqual(w.readframes(w.getnframes()), samples)

    def test_an_odd_byte_is_dropped_so_the_samples_stay_whole(self):
        wav_bytes = mm.pcm_to_wav(b"\x01\x00\x02", 44100)
        with wave.open(io.BytesIO(wav_bytes), "rb") as w:
            self.assertEqual(w.getnframes(), 1)

    # The request and the response, with the network replaced
    def run_tts(self, fmt, returned_bytes):
        os.environ["ELEVEN_OUTPUT_FORMAT"] = fmt
        seen = {}

        def fake_urlopen(req, timeout=None):
            seen["url"] = req.full_url
            return FakeResponse({"audio_base64": base64.b64encode(returned_bytes).decode(), "alignment": {"characters": []}})

        real = mm.urllib.request.urlopen
        mm.urllib.request.urlopen = fake_urlopen
        try:
            audio, alignment = mm.eleven_tts(SCRIPT, VOICE, "test-key")
        finally:
            mm.urllib.request.urlopen = real
        return seen["url"], audio, alignment

    def test_pcm_request_asks_for_pcm_and_returns_wav(self):
        raw = b"\x10\x00" * 2205  # 0.05 s
        url, audio, alignment = self.run_tts("pcm_44100", raw)
        self.assertIn("output_format=pcm_44100", url)
        self.assertEqual(audio[:4], b"RIFF", "PCM must come back wrapped as WAV")
        with wave.open(io.BytesIO(audio), "rb") as w:
            self.assertEqual(w.getframerate(), 44100)
            self.assertEqual(w.readframes(w.getnframes()), raw)
        self.assertEqual(alignment, {"characters": []})

    def test_default_request_asks_for_mp3_and_returns_it_unchanged(self):
        mp3_like = b"ID3" + b"\x00" * 100
        url, audio, _ = self.run_tts("mp3_44100_128", mp3_like)
        self.assertIn("output_format=mp3_44100_128", url)
        self.assertEqual(audio, mp3_like)


if __name__ == "__main__":
    unittest.main(verbosity=2)
