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


if __name__ == "__main__":
    unittest.main()
