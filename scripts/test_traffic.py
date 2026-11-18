import unittest

from traffic import percentile


class TrafficTests(unittest.TestCase):
    def test_nearest_rank_percentile(self):
        self.assertEqual(percentile([30, 10, 20, 40], 0.5), 20)
        self.assertEqual(percentile([30, 10, 20, 40], 0.95), 40)


if __name__ == "__main__":
    unittest.main()
