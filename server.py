import csv
import io
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


DATA_PATH = Path(__file__).with_name("dashboard-data.json")
REPORT_FIELDS = {
    "orders": (("Order ID", "id"), ("Customer", "name"), ("Date", "date"), ("Amount (INR)", "amount"), ("Status", "status")),
    "payments": (("Payment ID", "id"), ("Order ID", "orderId"), ("Customer", "customer"), ("Date", "date"), ("Method", "method"), ("Amount (INR)", "amount"), ("Status", "status")),
    "tools": (("Tool", "name"), ("Category", "category"), ("Endpoint", "endpoint"), ("Status", "status")),
}


def load_dashboard_data():
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def build_analytics(data):
    orders = data.get("orders", [])
    payments = data.get("payments", [])
    return {
        "orders": {
            "total": len(orders),
            "by_status": {status: sum(order.get("status") == status for order in orders) for status in ("Pending", "Processing", "Delivered", "Cancelled")},
        },
        "payments": {
            "paid_total": sum(payment.get("amount", 0) for payment in payments if payment.get("status") == "Paid"),
            "pending_total": sum(payment.get("amount", 0) for payment in payments if payment.get("status") == "Pending"),
            "by_status": {status: sum(payment.get("status") == status for payment in payments) for status in ("Paid", "Pending", "Failed", "Refunded")},
        },
    }


def render_csv(kind, records):
    fields = REPORT_FIELDS[kind]
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow([label for label, _ in fields])
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("Every report record must be an object.")
        values = [record.get(key, "") for _, key in fields]
        writer.writerow([f"\t{value}" if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")) else value for value in values])
    return ("\ufeff" + output.getvalue()).encode("utf-8")


class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/dashboard":
            self.send_json(load_dashboard_data())
            return
        if path == "/api/analytics":
            self.send_json(build_analytics(load_dashboard_data()))
            return
        if path == "/api/orders.csv":
            self.send_csv("orders", load_dashboard_data()["orders"])
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        prefix = "/api/reports/"
        if not path.startswith(prefix) or not path.endswith(".csv"):
            self.send_error(404)
            return
        kind = path[len(prefix):-4]
        if kind not in REPORT_FIELDS:
            self.send_error(404)
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 2_000_000:
                raise ValueError("Request body must be between 1 byte and 2 MB.")
            payload = json.loads(self.rfile.read(content_length))
            records = payload.get("records") if isinstance(payload, dict) else None
            if not isinstance(records, list) or len(records) > 10_000:
                raise ValueError("Records must be a list of at most 10,000 items.")
            body = render_csv(kind, records)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self.send_json({"error": str(error)}, status=400)
            return
        self.send_csv(kind, body=body)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_csv(self, kind, records=None, body=None):
        if body is None:
            body = render_csv(kind, records)
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="khatu-universal-{kind}.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), DashboardHandler)
    print(f"Khatu Universal dashboard running at http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDashboard server stopped.")
    finally:
        server.server_close()