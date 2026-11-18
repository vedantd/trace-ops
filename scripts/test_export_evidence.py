import unittest

from export_evidence import parse_safe_events


class EvidenceExportTests(unittest.TestCase):
    def test_redacts_unknown_fields_and_ignores_non_json_logs(self):
        raw = (
            'api-1 | {"service":"orders-api","event":"request_completed",'
            '"request_id":"abc","route":"/orders/:id","http_status":503,'
            '"authorization":"Bearer secret","customer_email":"private@example.com"}\n'
            "api-1 | not json\n"
        )
        records = parse_safe_events(raw)
        self.assertEqual(len(records), 1)
        self.assertNotIn("authorization", records[0])
        self.assertNotIn("customer_email", records[0])
        self.assertEqual(records[0]["http_status"], 503)

    def test_provider_event_is_sanitized(self):
        raw = (
            'mock-provider-1 | {"service":"mock-provider","event":"provider_request_completed",'
            '"request_id":"abc","http_status":503,"operation":"verify","attempt":1,'
            '"provider_token":"not-for-export"}\n'
        )
        records = parse_safe_events(raw)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["attempt"], 1)
        self.assertNotIn("provider_token", records[0])


if __name__ == "__main__":
    unittest.main()
