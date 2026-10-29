# Khatu Universal Dashboard

Open the live dashboard: https://khatuuniversal.github.io/Test-repository/

The dashboard uses JavaScript in the browser and sample records in `dashboard-data.json`. It works as a static GitHub Pages site. The optional Python server provides the same data through a small local API.

Use **Edit dashboard** to update metrics, orders, inventory, customers, finance payments, and tool connection records. Saved edits are stored in the current browser only; they do not change the public sample data for other visitors. Tool records track setup details and status; they do not authenticate with external services or store credentials. Use **Reset to defaults** to restore the original sample records.

## Run locally

```sh
python3 server.py
```

Then open http://localhost:8000. Python 3 is required; no third-party packages are needed.

All orders, inventory, customer, and payment records are sample data and are not saved to a database.