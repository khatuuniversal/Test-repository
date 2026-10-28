const DEFAULT_METRICS = { sales: 248560, orders: 1284, customers: 186, average: 1936 };
const PERIOD_METRICS = {
	week: { sales: 248560, orders: 1284, customers: 186, average: 1936 },
	month: { sales: 934820, orders: 4892, customers: 624, average: 1911 },
	year: { sales: 7826410, orders: 38416, customers: 4820, average: 2037 },
};
const STORAGE_KEY = "khatu-universal-dashboard-v1";
const ALLOWED_TONES = new Set(["", "initial-coral", "initial-blue", "initial-yellow", "thumb-coral", "thumb-blue"]);
const views = {
	overview: { title: "Dashboard", heading: "Welcome, Khatu Universal", subtitle: "Here is what is happening in your business today.", tableTitle: "Recent orders", kind: "orders" },
	orders: { title: "Orders", heading: "Your orders", subtitle: "Track every order and its current status.", tableTitle: "All orders", kind: "orders" },
	inventory: { title: "Inventory", heading: "Your inventory", subtitle: "Review your products and current stock levels.", tableTitle: "Low-stock products", kind: "inventory" },
	customers: { title: "Customers", heading: "Your customers", subtitle: "Keep track of customer relationships and purchases.", tableTitle: "Recent customers", kind: "customers" },
	reports: { title: "Reports", heading: "Business reports", subtitle: "A summary of sales and order performance.", tableTitle: "Sales orders", kind: "orders" },
};

const tableHead = document.querySelector("#table-head");
const tableBody = document.querySelector("#table-body");
const tableSearch = document.querySelector("#table-search");
const globalSearch = document.querySelector("#global-search");
const toast = document.querySelector("#toast");
const editDialog = document.querySelector("#edit-dialog");
const editorForm = document.querySelector("#editor-form");
let activeView = "overview";
let toastTimer;
let metrics = { ...DEFAULT_METRICS };
let orders = [];
let inventory = [];
let customers = [];
let dashboardDefaults = { orders: [], inventory: [], customers: [] };

function escapeHTML(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}

function safeTone(value) {
	return ALLOWED_TONES.has(value) ? value : "";
}

function formatCurrency(value) {
	return `₹${Number(value).toLocaleString("en-IN")}`;
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add("is-visible");
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function renderMetrics() {
	document.querySelector("#sales-value").textContent = formatCurrency(metrics.sales);
	document.querySelector("#orders-value").textContent = Number(metrics.orders).toLocaleString("en-IN");
	document.querySelector("#customers-value").textContent = `+${Number(metrics.customers).toLocaleString("en-IN")}`;
	document.querySelector("#average-value").textContent = formatCurrency(metrics.average);
}

function renderStock() {
	const stockList = document.querySelector("#low-stock-list");
	stockList.innerHTML = inventory.slice(0, 3).map((item) => `
		<div class="stock-item">
			<span class="product-thumb ${safeTone(item.tone)}">${escapeHTML(item.mark)}</span>
			<span class="product-info"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.sku)}</small></span>
			<span class="stock-pill">${Number(item.stock).toLocaleString("en-IN")} left</span>
		</div>
	`).join("");
}

function getTableRows(kind, query) {
	const normalizedQuery = query.trim().toLocaleLowerCase("en");
	if (kind === "inventory") {
		const filtered = inventory.filter((item) => `${item.name} ${item.sku}`.toLocaleLowerCase("en").includes(normalizedQuery));
		return {
			header: "<tr><th>Product</th><th>SKU</th><th>Available stock</th><th>Status</th></tr>",
			rows: filtered.map((item) => `<tr><td><span class="customer-cell"><span class="product-thumb ${safeTone(item.tone)}">${escapeHTML(item.mark)}</span><strong>${escapeHTML(item.name)}</strong></span></td><td>${escapeHTML(item.sku)}</td><td>${Number(item.stock).toLocaleString("en-IN")} units</td><td><span class="stock-pill">Low stock</span></td></tr>`),
			total: filtered.length,
			noun: filtered.length === 1 ? "product" : "products",
		};
	}
	if (kind === "customers") {
		const filtered = customers.filter((customer) => `${customer.name} ${customer.email}`.toLocaleLowerCase("en").includes(normalizedQuery));
		return {
			header: "<tr><th>Customer</th><th>Total orders</th><th>Total spent</th><th>Joined</th></tr>",
			rows: filtered.map((customer) => `<tr><td><span class="customer-cell"><span class="customer-initial ${safeTone(customer.tone)}">${escapeHTML(customer.initials)}</span><span><strong>${escapeHTML(customer.name)}</strong><br><small>${escapeHTML(customer.email)}</small></span></span></td><td>${Number(customer.orders).toLocaleString("en-IN")}</td><td>${formatCurrency(customer.spent)}</td><td>${escapeHTML(customer.joined)}</td></tr>`),
			total: filtered.length,
			noun: filtered.length === 1 ? "customer" : "customers",
		};
	}
	const filtered = orders.filter((order) => `${order.id} ${order.name} ${order.status}`.toLocaleLowerCase("en").includes(normalizedQuery));
	return {
		header: "<tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr>",
		rows: filtered.map((order) => `<tr><td class="order-id">${escapeHTML(order.id)}</td><td><span class="customer-cell"><span class="customer-initial ${safeTone(order.tone)}">${escapeHTML(order.initials)}</span>${escapeHTML(order.name)}</span></td><td>${escapeHTML(order.date)}</td><td>${formatCurrency(order.amount)}</td><td><span class="status status-${order.statusKey}">${escapeHTML(order.status)}</span></td></tr>`),
		total: filtered.length,
		noun: filtered.length === 1 ? "order" : "orders",
	};
}

function renderTable() {
	const view = views[activeView];
	const result = getTableRows(view.kind, tableSearch.value || globalSearch.value);
	tableHead.innerHTML = result.header;
	tableBody.innerHTML = result.rows.length ? result.rows.join("") : '<tr><td class="empty-state" colspan="5">No results found.</td></tr>';
	document.querySelector("#table-title").textContent = view.tableTitle;
	document.querySelector("#table-count").textContent = `${result.total} ${result.noun} found`;
	document.querySelector("[data-view='orders'] .nav-count").textContent = orders.length;
}

function setView(viewName) {
	if (!views[viewName]) return;
	activeView = viewName;
	const view = views[viewName];
	document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
		const isActive = link.dataset.view === viewName;
		link.classList.toggle("is-active", isActive);
		if (isActive) link.setAttribute("aria-current", "page");
		else link.removeAttribute("aria-current");
	});
	document.querySelector("#breadcrumb-current").textContent = view.title;
	document.querySelector("#page-title").textContent = view.heading;
	document.querySelector("#page-subtitle").textContent = view.subtitle;
	document.querySelector(".metric-grid").hidden = viewName === "customers" || viewName === "inventory";
	document.querySelector(".content-grid").hidden = viewName === "customers" || viewName === "inventory";
	document.querySelector(".stock-panel").hidden = viewName === "orders" || viewName === "reports";
	tableSearch.value = "";
	renderTable();
	window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillEditor() {
	for (const [key, value] of Object.entries(metrics)) editorForm.elements.namedItem(key).value = value;
	renderEditorRecords("orders", orders);
	renderEditorRecords("inventory", inventory);
	renderEditorRecords("customers", customers);
}

const editorFields = {
	orders: [
		{ key: "id", label: "Order ID" },
		{ key: "name", label: "Customer" },
		{ key: "date", label: "Date" },
		{ key: "amount", label: "Amount (INR)", type: "number" },
		{ key: "status", label: "Status", type: "status" },
	],
	inventory: [
		{ key: "name", label: "Product name" },
		{ key: "sku", label: "SKU" },
		{ key: "stock", label: "Available stock", type: "number" },
	],
	customers: [
		{ key: "name", label: "Customer name" },
		{ key: "email", label: "Email", type: "email" },
		{ key: "orders", label: "Total orders", type: "number" },
		{ key: "spent", label: "Total spent (INR)", type: "number" },
		{ key: "joined", label: "Joined" },
	],
};

const editorDefaults = {
	orders: { id: "", name: "", initials: "", tone: "", date: "", amount: 0, status: "Pending", statusKey: "pending" },
	inventory: { name: "", sku: "", stock: 0, tone: "", mark: "" },
	customers: { name: "", initials: "", tone: "", email: "", orders: 0, spent: 0, joined: "" },
};

function renderEditorField(collection, field, value) {
	const inputType = field.type === "number" || field.type === "email" ? field.type : "text";
	const control = field.type === "status"
		? `<select data-editor-field="${field.key}" required>${["Delivered", "Processing", "Pending", "Cancelled"].map((status) => `<option${value === status ? " selected" : ""}>${status}</option>`).join("")}</select>`
		: `<input data-editor-field="${field.key}" type="${inputType}" value="${escapeHTML(value)}"${inputType === "number" ? ' min="0" step="1"' : ""} required />`;
	return `<label class="editor-field">${field.label}${control}</label>`;
}

function renderEditorRecord(collection, record, sourceIndex) {
	const fields = editorFields[collection].map((field) => renderEditorField(collection, field, record[field.key] ?? "")).join("");
	const title = collection === "orders" ? record.id || "New order" : record.name || (collection === "inventory" ? "New product" : "New customer");
	const detail = collection === "orders" ? record.name : collection === "inventory" ? record.sku : record.email;
	return `<details class="editor-record" data-source-index="${sourceIndex}"><summary><span class="record-summary-title">${escapeHTML(title)}</span><span class="record-summary-detail">${escapeHTML(detail || "Edit details")}</span><span class="record-chevron" aria-hidden="true">⌄</span></summary><div class="editor-record-fields">${fields}<button class="record-remove" type="button" aria-label="Remove ${collection === "orders" ? "order" : collection === "inventory" ? "product" : "customer"}">Remove</button></div></details>`;
}

function renderEditorRecords(collection, records) {
	const container = document.querySelector(`#${collection}-editor`);
	container.innerHTML = records.map((record, index) => renderEditorRecord(collection, record, index)).join("");
}

function collectEditorRecords(collection, currentRecords) {
	const container = document.querySelector(`#${collection}-editor`);
	return [...container.querySelectorAll(".editor-record")].map((row) => {
		const sourceIndex = Number(row.dataset.sourceIndex);
		const source = sourceIndex >= 0 ? currentRecords[sourceIndex] : editorDefaults[collection];
		const record = { ...source };
		row.querySelectorAll("[data-editor-field]").forEach((input) => {
			record[input.dataset.editorField] = input.type === "number" ? Number(input.value) : input.value.trim();
		});
		if (collection === "orders") {
			record.initials = record.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
			record.statusKey = record.status.toLowerCase();
		} else if (collection === "inventory") {
			record.mark = record.name.trim().charAt(0).toUpperCase();
		} else {
			record.initials = record.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
		}
		return record;
	});
}

function validateRecordList(records, id, requiredFields, numericFields) {
	if (!Array.isArray(records)) throw new Error(`${id.replace("#", "")} must contain a JSON array.`);
	for (const [index, record] of records.entries()) {
		if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Record ${index + 1} is not an object.`);
		for (const field of requiredFields) {
			if (!(field in record)) throw new Error(`Record ${index + 1} is missing the "${field}" field.`);
			if (numericFields.includes(field) && (typeof record[field] !== "number" || !Number.isFinite(record[field]) || record[field] < 0)) throw new Error(`Record ${index + 1}: "${field}" must be a non-negative number.`);
			if (!numericFields.includes(field) && typeof record[field] !== "string") throw new Error(`Record ${index + 1}: "${field}" must be text.`);
		}
		if (!ALLOWED_TONES.has(record.tone)) throw new Error(`Record ${index + 1} has an unsupported display tone.`);
		if (id === "orders" && !["delivered", "processing", "pending", "cancelled"].includes(record.statusKey)) throw new Error(`Record ${index + 1} has an unsupported statusKey.`);
	}
	return records.map((record) => ({
		...record,
		...Object.fromEntries(numericFields.map((field) => [field, Number(record[field])])),
	}));
}

function saveDashboard(state = { metrics, orders, inventory, customers }) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		return true;
	} catch (error) {
		console.error("Could not save dashboard settings:", error);
		showToast("Could not save changes in this browser.");
		return false;
	}
}

function readSavedDashboard() {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
	} catch (error) {
		console.warn("Saved dashboard data could not be read:", error);
		return null;
	}
}

function restoreDefaults() {
	metrics = { ...DEFAULT_METRICS };
	orders = JSON.parse(JSON.stringify(dashboardDefaults.orders));
	inventory = JSON.parse(JSON.stringify(dashboardDefaults.inventory));
	customers = JSON.parse(JSON.stringify(dashboardDefaults.customers));
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (error) {
		console.error("Could not remove saved dashboard data:", error);
		showToast("Could not clear saved edits in this browser.");
		return;
	}
	renderMetrics();
	renderStock();
	renderTable();
	fillEditor();
	showToast("Dashboard restored to default data.");
}

document.querySelectorAll(".nav-link[data-view]").forEach((link) => link.addEventListener("click", () => setView(link.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.openView)));
tableSearch.addEventListener("input", renderTable);
globalSearch.addEventListener("input", () => {
	if (activeView !== "orders") setView("orders");
	tableSearch.value = globalSearch.value;
	renderTable();
});

document.querySelector("#period-select").addEventListener("change", (event) => {
	const period = event.target.value;
	const labels = { week: "This week", month: "This month", year: "This year" };
	metrics = { ...PERIOD_METRICS[period] };
	renderMetrics();
	saveDashboard();
	showToast(`${labels[period]} summary selected.`);
});

document.querySelector("#export-button").addEventListener("click", () => {
	const headings = ["Order ID", "Customer", "Date", "Amount (INR)", "Status"];
	const lines = [headings, ...orders.map((order) => [order.id, order.name, order.date, order.amount, order.status])];
	const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
	link.download = "khatu-universal-orders.csv";
	link.click();
	URL.revokeObjectURL(link.href);
	showToast("Orders report downloaded.");
});

document.querySelector("#edit-zone-button").addEventListener("click", () => {
	fillEditor();
	editDialog.showModal();
});
document.querySelector("#close-editor").addEventListener("click", () => editDialog.close());
document.querySelector("#reset-editor").addEventListener("click", restoreDefaults);
document.querySelector(".editor-scroll").addEventListener("click", (event) => {
	const addButton = event.target.closest("[data-add-record]");
	if (addButton) {
		const collection = addButton.dataset.addRecord;
		const container = document.querySelector(`#${collection}-editor`);
		const row = document.createElement("div");
		row.innerHTML = renderEditorRecord(collection, editorDefaults[collection], -1);
		const newRecord = row.firstElementChild;
		newRecord.open = true;
		container.append(newRecord);
		newRecord.querySelector("input, select").focus();
		return;
	}
	const removeButton = event.target.closest(".record-remove");
	if (removeButton) removeButton.closest(".editor-record").remove();
});
editorForm.addEventListener("submit", (event) => {
	event.preventDefault();
	try {
		const formData = new FormData(editorForm);
		const nextMetrics = Object.fromEntries(["sales", "orders", "customers", "average"].map((key) => [key, Number(formData.get(key))]));
		if (Object.values(nextMetrics).some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Metrics must be non-negative numbers.");
		const nextOrders = validateRecordList(collectEditorRecords("orders", orders), "orders", ["id", "name", "initials", "tone", "date", "amount", "status", "statusKey"], ["amount"]);
		const nextInventory = validateRecordList(collectEditorRecords("inventory", inventory), "inventory", ["name", "sku", "stock", "tone", "mark"], ["stock"]);
		const nextCustomers = validateRecordList(collectEditorRecords("customers", customers), "customers", ["name", "initials", "tone", "email", "orders", "spent", "joined"], ["orders", "spent"]);
		if (!saveDashboard({ metrics: nextMetrics, orders: nextOrders, inventory: nextInventory, customers: nextCustomers })) return;
		metrics = nextMetrics;
		orders = nextOrders;
		inventory = nextInventory;
		customers = nextCustomers;
		renderMetrics();
		renderStock();
		renderTable();
		editDialog.close();
		showToast("Dashboard changes saved in this browser.");
	} catch (error) {
		showToast(error instanceof SyntaxError ? "Check the JSON syntax in the editor." : error.message);
	}
});

document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		globalSearch.focus();
	}
	if (event.key === "Escape" && document.activeElement === globalSearch) {
		globalSearch.value = "";
		globalSearch.blur();
		renderTable();
	}
});

async function loadDashboardData() {
	try {
		let response = await fetch("api/dashboard", { headers: { Accept: "application/json" } });
		if (!response.ok) response = await fetch("dashboard-data.json", { headers: { Accept: "application/json" } });
		if (!response.ok) throw new Error(`Dashboard data returned ${response.status}`);
		const data = await response.json();
		dashboardDefaults = {
			orders: Array.isArray(data.orders) ? data.orders : [],
			inventory: Array.isArray(data.inventory) ? data.inventory : [],
			customers: Array.isArray(data.customers) ? data.customers : [],
		};
		orders = JSON.parse(JSON.stringify(dashboardDefaults.orders));
		inventory = JSON.parse(JSON.stringify(dashboardDefaults.inventory));
		customers = JSON.parse(JSON.stringify(dashboardDefaults.customers));
		const saved = readSavedDashboard();
		if (saved && typeof saved === "object") {
			if (saved.metrics && ["sales", "orders", "customers", "average"].every((key) => Number.isFinite(Number(saved.metrics[key])) && Number(saved.metrics[key]) >= 0)) {
				metrics = Object.fromEntries(["sales", "orders", "customers", "average"].map((key) => [key, Number(saved.metrics[key])]));
			}
			try {
				if (Array.isArray(saved.orders)) orders = validateRecordList(saved.orders, "orders", ["id", "name", "initials", "tone", "date", "amount", "status", "statusKey"], ["amount"]);
				if (Array.isArray(saved.inventory)) inventory = validateRecordList(saved.inventory, "inventory", ["name", "sku", "stock", "tone", "mark"], ["stock"]);
				if (Array.isArray(saved.customers)) customers = validateRecordList(saved.customers, "customers", ["name", "initials", "tone", "email", "orders", "spent", "joined"], ["orders", "spent"]);
			} catch (error) {
				console.warn("Some saved dashboard records were invalid; defaults will be used:", error);
				orders = JSON.parse(JSON.stringify(dashboardDefaults.orders));
				inventory = JSON.parse(JSON.stringify(dashboardDefaults.inventory));
				customers = JSON.parse(JSON.stringify(dashboardDefaults.customers));
			}
		}
		renderMetrics();
		renderStock();
		renderTable();
	} catch (error) {
		console.error("Could not load dashboard data:", error);
		showToast("Dashboard data could not be loaded. Refresh the page and try again.");
	} finally {
		document.querySelector("#app-loader").classList.add("is-hidden");
	}
}

renderMetrics();
renderStock();
renderTable();
loadDashboardData();
