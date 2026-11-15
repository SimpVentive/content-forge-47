"""The worker and the shared provider config agree on billing and estimates. No fal, no ElevenLabs, no spend.

Reads supabase/functions/_shared/lipsync-provider.json (the one config) and tools/fixtures/lipsync_billing_cases.json
(the expected values). The TypeScript side is checked against the same fixture in src/test/lipsyncProvider.test.ts.

Run: python tools/test_lipsync_provider.py
"""
import json, pathlib, sys, unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_module as mm  # noqa: E402

CONFIG = HERE.parent / "supabase" / "functions" / "_shared" / "lipsync-provider.json"
FIXTURE = HERE / "fixtures" / "lipsync_billing_cases.json"
PRICE_WORDS_PER_MINUTE = 150  # NARRATION_WORDS_PER_MINUTE in module-jobs.ts and moduleJobs.ts


class ProviderConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads(CONFIG.read_text("utf8"))
        cls.cases = json.loads(FIXTURE.read_text("utf8"))

    def test_worker_reads_the_shared_config(self):
        self.assertEqual(mm.LIPSYNC_ENDPOINT, self.config["endpoint"])
        self.assertEqual(mm.PRICE_PER_SECOND, self.config["price_per_second_usd"])
        self.assertEqual(mm.BILLING_MINIMUM_S, self.config["minimum_seconds"])

    def test_config_has_one_provider_with_the_four_fields(self):
        self.assertEqual(set(self.config), {"name", "endpoint", "price_per_second_usd", "minimum_seconds"})

    def test_billing_per_clip_matches_fixture(self):
        for case in self.cases["billing"]:
            with self.subTest(seconds=case["seconds"]):
                self.assertAlmostEqual(mm.clip_cost(case["seconds"]), case["usd"], places=4)

    def test_estimate_matches_fixture(self):
        for case in self.cases["estimates"]:
            with self.subTest(words=case["words"]):
                seconds = case["words"] / PRICE_WORDS_PER_MINUTE * 60
                self.assertAlmostEqual(mm.estimate_for_seconds(seconds), case["usd"], places=2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
