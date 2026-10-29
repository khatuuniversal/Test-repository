# Khatu Universal Dashboard

Open the live dashboard: https://khatuuniversal.github.io/Test-repository/

The dashboard has separate Dashboard, Orders, Finance, and Tools workspaces. The local Python server provides dashboard data, derived order and payment analytics, and formatted CSV report endpoints. On GitHub Pages, the browser uses the checked-in sample data, calculates summaries locally, and falls back to browser-generated CSV. The PDF option opens the browser print dialog so a report can be saved as PDF.

Use the three-dot menus to edit the relevant summary, order, or payment records. Tool connection metadata is managed only in Tools. Edits are stored in the current browser and do not change the public sample data. Tool records do not execute external actions or store credentials; live integrations require an authenticated backend with an explicit service allowlist. Use **Reset to defaults** to restore the original sample records.

The local Python API exposes `GET /api/dashboard`, `GET /api/analytics`, and `POST /api/reports/{orders,payments,tools}.csv`. Report requests contain a `records` array; report output is generated with Python's CSV writer and includes spreadsheet-formula cell protection. GitHub Pages cannot run Python, so it uses the documented browser fallbacks instead.

## Run locally

```sh
python3 server.py
```

Then open http://localhost:8000. Python 3 is required; no third-party packages are needed.

Orders and payment records are sample data and are not saved to a database.

## Run backend checks

```sh
python3 -m unittest -v test_server
```