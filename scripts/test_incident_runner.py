import json
import pathlib
import tempfile
import unittest

from incident_runner import (
    PHASES,
    check_transitions,
    set_provider_mode,
    validate_local_url,
)


class IncidentRunnerTests(unittest.TestCase):
    def test_rejects_nonlocal_urls_and_credentials(self):
        for value in (
            "https://localhost:3000",
            "http://example.com:3000",
            "http://127.0.0.1:3000/something",
            "http://user:password@localhost:3000",
            "http://localhost:3000?token=x",
            "http://localhost",
        ):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_local_url(value)
        self.assertEqual(validate_local_url("http://127.0.0.1:3000"), "http://127.0.0.1:3000")

    def test_atomic_control_file_allows_only_known_modes(self):
        with tempfile.TemporaryDirectory() as root:
            control = pathlib.Path(root) / "state" / "fault.json"
            for _, mode in PHASES:
                set_provider_mode(mode, control)
                self.assertEqual(json.loads(control.read_text())["mode"], mode)
            with self.assertRaises(ValueError):
                set_provider_mode("dangerous_mode", control)
            self.assertEqual(json.loads(control.read_text())["mode"], "healthy")
            self.assertEqual(sorted(control.parent.iterdir()), [control])

    def test_transition_checks_require_real_outage_and_latency_shift(self):
        values = {
            0: [{"http_status": 200, "duration_ms": 15} for _ in range(4)],
            1: [{"http_status": 200, "duration_ms": 185} for _ in range(4)],
            2: [{"http_status": 200, "duration_ms": 320} for _ in range(4)],
            3: [{"http_status": 502, "duration_ms": 110} for _ in range(4)],
            4: [{"http_status": 200, "duration_ms": 15} for _ in range(4)],
        }
        check_transitions(values)
        values[3] = [{"http_status": 200, "duration_ms": 15} for _ in range(4)]
        with self.assertRaises(AssertionError):
            check_transitions(values)
        values[3] = [{"http_status": 502, "duration_ms": 110} for _ in range(4)]
        values[1] = [{"http_status": 200, "duration_ms": 20} for _ in range(4)]
        with self.assertRaises(AssertionError):
            check_transitions(values)


if __name__ == "__main__":
    unittest.main()
