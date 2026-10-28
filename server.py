import csv
import io
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


DATA = json.loads(Path(__file__).with_name("dashboard-data.json").read_text(encoding="utf-8"))
ORDERS = DATA["orders"]


class DashboardHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/dashboard":
            self.send_json(DATA)
            return
        if path == "/api/orders.csv":
            self.send_orders_csv()
            return
        super().do_GET()

    def send_json(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_orders_csv(self):
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["ऑर्डर आईडी", "ग्राहक", "तारीख", "राशि (INR)", "स्थिति"])
        for order in ORDERS:
            writer.writerow([order["id"], order["name"], order["date"], order["amount"], order["status"]])
        body = ("\ufeff" + output.getvalue()).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="khatu-universal-orders.csv"')
        self.send_header("Content-Length", str(len(body)))
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