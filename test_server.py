import csv
import io
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class DashboardApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.DashboardHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def test_dashboard_endpoint_returns_records(self):
        with urlopen(f"{self.base_url}/api/dashboard") as response:
            data = json.load(response)
        self.assertIn("orders", data)
        self.assertIn("payments", data)
        self.assertIn("tools", data)

    def test_analytics_endpoint_returns_order_and_payment_totals(self):
        with urlopen(f"{self.base_url}/api/analytics") as response:
            analytics = json.load(response)
        self.assertEqual(analytics["orders"]["total"], len(server.load_dashboard_data()["orders"]))
        self.assertGreater(analytics["payments"]["paid_total"], 0)
        self.assertIn("Failed", analytics["payments"]["by_status"])

    def test_report_endpoint_returns_formatted_csv(self):
        payload = {"records": [{"id": "KU-1", "name": "Asha, Rao", "date": "2026-10-29", "amount": 1250, "status": "Paid"}]}
        request = Request(
            f"{self.base_url}/api/reports/orders.csv",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request) as response:
            body = response.read().decode("utf-8-sig")
            self.assertEqual(response.headers.get_content_type(), "text/csv")
            self.assertIn("khatu-universal-orders.csv", response.headers["Content-Disposition"])
        rows = list(csv.reader(io.StringIO(body)))
        self.assertEqual(rows[1][1], "Asha, Rao")

    def test_csv_neutralizes_spreadsheet_formulas(self):
        body = server.render_csv("orders", [{"id": "=1+1", "name": "Asha", "date": "2026-10-29", "amount": 1250, "status": "Pending"}])
        rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
        self.assertEqual(rows[1][0], "\t=1+1")

    def test_report_endpoint_rejects_malformed_records(self):
        request = Request(
            f"{self.base_url}/api/reports/orders.csv",
            data=b'{"records":[null]}',
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as error:
            urlopen(request)
        self.assertEqual(error.exception.code, 400)
        error.exception.close()


if __name__ == "__main__":
    unittest.main()