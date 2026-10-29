const DEFAULT_METRICS = { orders: 1284, average: 1936 };
const PERIOD_METRICS = {
	week: { orders: 1284, average: 1936 },
	month: { orders: 4892, average: 1911 },
	year: { orders: 38416, average: 2037 },
};
const STORAGE_KEY = "khatu-universal-dashboard-v1";
const REPOSITORY_API_URL = "https://api.github.com/repos/khatuuniversal/Test-repository/commits/main";
const ALLOWED_TONES = new Set(["", "initial-coral", "initial-blue", "initial-yellow", "thumb-coral", "thumb-blue"]);
const views = {
	overview: { title: "Dashboard", heading: "Welcome, Khatu Universal", subtitle: "Here is what is happening in your business today.", tableTitle: "Recent orders", kind: "orders" },
	orders: { title: "Orders", heading: "Your orders", subtitle: "Track every order and its current status.", tableTitle: "All orders", kind: "orders" },
	finance: { title: "Finance", heading: "Payments and finance", subtitle: "Review and manage payment records.", tableTitle: "Payment records", kind: "payments" },
	tools: { title: "Tools", heading: "Connected tools", subtitle: "Manage tool details and track connection setup.", tableTitle: "Tool connections", kind: "tools" },
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
let payments = [];
let tools = [];
let dashboardDefaults = { orders: [], payments: [], tools: [] };

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

async function updateRepositoryStatus() {
	const status = document.querySelector("#repository-status");
	const value = document.querySelector("#repository-status-value");
	try {
		const response = await fetch(REPOSITORY_API_URL, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
		if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
		const commit = await response.json();
		const shortSha = commit.sha.slice(0, 7);
		status.classList.remove("is-offline");
		status.classList.add("is-online");
		status.href = `https://github.com/khatuuniversal/Test-repository/commit/${commit.sha}`;
		status.title = `Latest commit on Test-repository main: ${shortSha}`;
		value.textContent = `Latest ${shortSha}`;
	} catch {
		status.classList.remove("is-online");
		status.classList.add("is-offline");
		status.href = "https://github.com/khatuuniversal/Test-repository";
		status.title = "GitHub main branch status is unavailable";
		value.textContent = "Unavailable";
	}
}

async function fetchWithTimeout(url, timeout = 5000) {
	const controller = new AbortController();
	const timeoutId = window.setTimeout(() => controller.abort(), timeout);
	try {
		return await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
	} finally {
		window.clearTimeout(timeoutId);
	}
}

function renderMetrics() {
	document.querySelector("#orders-value").textContent = Number(metrics.orders).toLocaleString("en-IN");
	document.querySelector("#average-value").textContent = formatCurrency(metrics.average);
}

function renderTools(query = "") {
	const normalizedQuery = query.trim().toLocaleLowerCase("en");
	const filteredTools = tools
		.map((tool, index) => ({ tool, index }))
		.filter(({ tool }) => `${tool.name} ${tool.category} ${tool.endpoint} ${tool.status}`.toLocaleLowerCase("en").includes(normalizedQuery));
	const grid = document.querySelector("#tools-grid");
	if (!filteredTools.length) {
		grid.innerHTML = `<div class="tools-empty"><p>${normalizedQuery ? "No matching tools found." : "No ecosystem tools are configured yet."}</p>${normalizedQuery ? "" : '<button class="text-button" type="button" data-add-tool>Add your first tool <span aria-hidden="true">↗</span></button>'}</div>`;
		return;
	}
	grid.innerHTML = filteredTools.map(({ tool, index }) => `<article class="tool-card"><span class="tool-mark" aria-hidden="true">${escapeHTML(tool.name.trim().charAt(0).toUpperCase() || "T")}</span><div class="tool-copy"><strong>${escapeHTML(tool.name)}</strong><small>${escapeHTML(tool.category)}</small><span class="status status-${escapeHTML(tool.statusKey)}">${escapeHTML(tool.status)}</span></div><details class="section-menu"><summary aria-label="${escapeHTML(tool.name)} options" title="Tool options">···</summary><button type="button" data-edit-tool="${index}">Edit</button></details></article>`).join("");
}

function getTableRows(kind, query) {
	const normalizedQuery = query.trim().toLocaleLowerCase("en");
	if (kind === "payments") {
		const filtered = payments.filter((payment) => `${payment.id} ${payment.orderId} ${payment.customer} ${payment.method} ${payment.status}`.toLocaleLowerCase("en").includes(normalizedQuery));
		return {
			header: "<tr><th>Payment ID</th><th>Order</th><th>Customer</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th></tr>",
			rows: filtered.map((payment) => `<tr><td class="order-id">${escapeHTML(payment.id)}</td><td>${escapeHTML(payment.orderId)}</td><td>${escapeHTML(payment.customer)}</td><td>${escapeHTML(payment.date)}</td><td>${escapeHTML(payment.method)}</td><td>${formatCurrency(payment.amount)}</td><td><span class="status status-${payment.statusKey}">${escapeHTML(payment.status)}</span></td></tr>`),
			total: filtered.length,
			noun: filtered.length === 1 ? "payment" : "payments",
		};
	}
	if (kind === "tools") {
		const filtered = tools.filter((tool) => `${tool.name} ${tool.category} ${tool.endpoint} ${tool.status}`.toLocaleLowerCase("en").includes(normalizedQuery));
		return {
			header: "<tr><th>Tool</th><th>Category</th><th>Endpoint</th><th>Connection status</th></tr>",
			rows: filtered.map((tool) => `<tr><td><strong>${escapeHTML(tool.name)}</strong></td><td>${escapeHTML(tool.category)}</td><td>${escapeHTML(tool.endpoint || "Not configured")}</td><td><span class="status status-${tool.statusKey}">${escapeHTML(tool.status)}</span></td></tr>`),
			total: filtered.length,
			noun: filtered.length === 1 ? "tool" : "tools",
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
	const columnCount = (result.header.match(/<th>/g) || []).length;
	tableBody.innerHTML = result.rows.length ? result.rows.join("") : `<tr><td class="empty-state" colspan="${columnCount}">No results found.</td></tr>`;
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
	document.querySelector("#table-menu-summary").setAttribute("aria-label", `${view.title} options`);
	document.querySelector("#table-edit-action").dataset.editSection = view.kind;
	document.querySelector(".metric-grid").hidden = viewName !== "overview";
	document.querySelector(".tools-panel").hidden = viewName !== "overview";
	document.querySelector(".orders-panel").hidden = viewName === "overview";
	document.querySelector(".period-select").hidden = viewName !== "overview";
	tableSearch.value = "";
	renderTools(globalSearch.value);
	renderTable();
	window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillEditor() {
	for (const [key, value] of Object.entries(metrics)) editorForm.elements.namedItem(key).value = value;
	renderEditorRecords("orders", orders);
	renderEditorRecords("payments", payments);
	renderEditorRecords("tools", tools);
}

function openEditor(section, toolIndex) {
	fillEditor();
	editDialog.showModal();
	document.querySelector(`[data-editor-section="${section}"]`)?.scrollIntoView({ block: "start" });
	if (Number.isInteger(toolIndex)) {
		const record = document.querySelector(`#tools-editor .editor-record[data-source-index="${toolIndex}"]`);
		if (record) {
			record.open = true;
			record.scrollIntoView({ block: "nearest" });
		}
	}
}

const editorFields = {
	orders: [
		{ key: "id", label: "Order ID" },
		{ key: "name", label: "Customer" },
		{ key: "date", label: "Date" },
		{ key: "amount", label: "Amount (INR)", type: "number" },
		{ key: "status", label: "Status", type: "status" },
	],
	payments: [
		{ key: "id", label: "Payment ID" },
		{ key: "orderId", label: "Order ID" },
		{ key: "customer", label: "Customer" },
		{ key: "date", label: "Date" },
		{ key: "method", label: "Payment method" },
		{ key: "amount", label: "Amount (INR)", type: "number" },
		{ key: "status", label: "Status", type: "status" },
	],
	tools: [
		{ key: "name", label: "Tool name" },
		{ key: "category", label: "Category" },
		{ key: "endpoint", label: "Endpoint URL", type: "url", required: false },
		{ key: "status", label: "Connection status", type: "status" },
	],
};

const editorDefaults = {
	orders: { id: "", name: "", initials: "", tone: "", date: "", amount: 0, status: "Pending", statusKey: "pending" },
	payments: { id: "", orderId: "", customer: "", date: "", method: "", amount: 0, status: "Pending", statusKey: "pending" },
	tools: { name: "", category: "", endpoint: "", status: "Not connected", statusKey: "not-connected" },
};

function renderEditorField(collection, field, value) {
	const inputType = ["number", "email", "url"].includes(field.type) ? field.type : "text";
	const statusOptions = collection === "orders"
		? ["Delivered", "Processing", "Pending", "Cancelled"]
		: collection === "payments"
			? ["Paid", "Pending", "Failed", "Refunded"]
			: ["Connected", "Setup required", "Not connected"];
	const required = field.required === false ? "" : " required";
	const control = field.type === "status"
		? `<select data-editor-field="${field.key}"${required}>${statusOptions.map((status) => `<option${value === status ? " selected" : ""}>${status}</option>`).join("")}</select>`
		: `<input data-editor-field="${field.key}" type="${inputType}" value="${escapeHTML(value)}"${inputType === "number" ? ' min="0" step="1"' : ""}${required} />`;
	return `<label class="editor-field">${field.label}${control}</label>`;
}

function renderEditorRecord(collection, record, sourceIndex) {
	const fields = editorFields[collection].map((field) => renderEditorField(collection, field, record[field.key] ?? "")).join("");
	const title = collection === "orders" || collection === "payments" ? record.id || `New ${collection === "orders" ? "order" : "payment"}` : record.name || "New tool";
	const detail = collection === "orders" ? record.name : collection === "payments" ? record.customer : record.category;
	const singular = { orders: "order", payments: "payment", tools: "tool" }[collection];
	return `<details class="editor-record" data-source-index="${sourceIndex}"><summary><span class="record-summary-title">${escapeHTML(title)}</span><span class="record-summary-detail">${escapeHTML(detail || "Edit details")}</span><span class="record-chevron" aria-hidden="true">⌄</span></summary><div class="editor-record-fields">${fields}<button class="record-remove" type="button" aria-label="Remove ${singular}">Remove</button></div></details>`;
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
		} else if (collection === "payments") {
			record.statusKey = record.status.toLowerCase();
		} else {
			record.statusKey = record.status.toLowerCase().replaceAll(" ", "-");
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
		if ("tone" in record && !ALLOWED_TONES.has(record.tone)) throw new Error(`Record ${index + 1} has an unsupported display tone.`);
		if (id === "orders" && !["delivered", "processing", "pending", "cancelled"].includes(record.statusKey)) throw new Error(`Record ${index + 1} has an unsupported statusKey.`);
		if (id === "payments" && !["paid", "pending", "failed", "refunded"].includes(record.statusKey)) throw new Error(`Record ${index + 1} has an unsupported payment status.`);
		if (id === "tools" && !["connected", "setup-required", "not-connected"].includes(record.statusKey)) throw new Error(`Record ${index + 1} has an unsupported connection status.`);
	}
	return records.map((record) => ({
		...record,
		...Object.fromEntries(numericFields.map((field) => [field, Number(record[field])])),
	}));
}

function saveDashboard(state = { metrics, orders, payments, tools }) {
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
	payments = JSON.parse(JSON.stringify(dashboardDefaults.payments));
	tools = JSON.parse(JSON.stringify(dashboardDefaults.tools));
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (error) {
		console.error("Could not remove saved dashboard data:", error);
		showToast("Could not clear saved edits in this browser.");
		return;
	}
	renderMetrics();
	renderTools(globalSearch.value);
	renderTable();
	fillEditor();
	showToast("Dashboard restored to default data.");
}

document.querySelectorAll(".nav-link[data-view]").forEach((link) => link.addEventListener("click", () => setView(link.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.openView)));
document.addEventListener("click", (event) => {
	const sectionEdit = event.target.closest("[data-edit-section]");
	if (sectionEdit) {
		sectionEdit.closest("details")?.removeAttribute("open");
		openEditor(sectionEdit.dataset.editSection);
		return;
	}
	const toolEdit = event.target.closest("[data-edit-tool]");
	if (toolEdit) {
		toolEdit.closest("details")?.removeAttribute("open");
		openEditor("tools", Number(toolEdit.dataset.editTool));
		return;
	}
	if (event.target.closest("[data-add-tool]")) {
		openEditor("tools");
		document.querySelector('[data-add-record="tools"]').click();
	}
});
tableSearch.addEventListener("input", renderTable);
globalSearch.addEventListener("input", () => {
	tableSearch.value = globalSearch.value;
	renderTools(globalSearch.value);
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
	const exportData = activeView === "finance"
		? { filename: "khatu-universal-payments.csv", headings: ["Payment ID", "Order ID", "Customer", "Date", "Method", "Amount (INR)", "Status"], records: payments.map((payment) => [payment.id, payment.orderId, payment.customer, payment.date, payment.method, payment.amount, payment.status]) }
		: activeView === "tools"
			? { filename: "khatu-universal-tools.csv", headings: ["Tool", "Category", "Endpoint", "Status"], records: tools.map((tool) => [tool.name, tool.category, tool.endpoint, tool.status]) }
			: { filename: "khatu-universal-orders.csv", headings: ["Order ID", "Customer", "Date", "Amount (INR)", "Status"], records: orders.map((order) => [order.id, order.name, order.date, order.amount, order.status]) };
	const lines = [exportData.headings, ...exportData.records];
	const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
	link.download = exportData.filename;
	link.click();
	URL.revokeObjectURL(link.href);
	showToast(`${views[activeView].title} report downloaded.`);
});

document.querySelector("#edit-zone-button").addEventListener("click", () => {
	openEditor("summary");
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
		const nextMetrics = Object.fromEntries(["orders", "average"].map((key) => [key, Number(formData.get(key))]));
		if (Object.values(nextMetrics).some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Metrics must be non-negative numbers.");
		const nextOrders = validateRecordList(collectEditorRecords("orders", orders), "orders", ["id", "name", "initials", "tone", "date", "amount", "status", "statusKey"], ["amount"]);
		const nextPayments = validateRecordList(collectEditorRecords("payments", payments), "payments", ["id", "orderId", "customer", "date", "method", "amount", "status", "statusKey"], ["amount"]);
		const nextTools = validateRecordList(collectEditorRecords("tools", tools), "tools", ["name", "category", "endpoint", "status", "statusKey"], []);
		if (!saveDashboard({ metrics: nextMetrics, orders: nextOrders, payments: nextPayments, tools: nextTools })) return;
		metrics = nextMetrics;
		orders = nextOrders;
		payments = nextPayments;
		tools = nextTools;
		renderMetrics();
		renderTools(globalSearch.value);
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
		let data;
		for (const source of ["api/dashboard", "dashboard-data.json"]) {
			try {
				const response = await fetchWithTimeout(source);
				if (response.ok) {
					data = await response.json();
					break;
				}
			} catch {
				continue;
			}
		}
		if (!data) throw new Error("Dashboard data sources are unavailable.");
		dashboardDefaults = {
			orders: Array.isArray(data.orders) ? data.orders : [],
			payments: Array.isArray(data.payments) ? data.payments : [],
			tools: Array.isArray(data.tools) ? data.tools : [],
		};
		orders = JSON.parse(JSON.stringify(dashboardDefaults.orders));
		payments = validateRecordList(JSON.parse(JSON.stringify(dashboardDefaults.payments)), "payments", ["id", "orderId", "customer", "date", "method", "amount", "status", "statusKey"], ["amount"]);
		tools = validateRecordList(JSON.parse(JSON.stringify(dashboardDefaults.tools)), "tools", ["name", "category", "endpoint", "status", "statusKey"], []);
		const saved = readSavedDashboard();
		if (saved && typeof saved === "object") {
			if (saved.metrics && ["orders", "average"].every((key) => Number.isFinite(Number(saved.metrics[key])) && Number(saved.metrics[key]) >= 0)) {
				metrics = Object.fromEntries(["orders", "average"].map((key) => [key, Number(saved.metrics[key])]));
			}
			try {
				if (Array.isArray(saved.orders)) orders = validateRecordList(saved.orders, "orders", ["id", "name", "initials", "tone", "date", "amount", "status", "statusKey"], ["amount"]);
				if (Array.isArray(saved.payments)) payments = validateRecordList(saved.payments, "payments", ["id", "orderId", "customer", "date", "method", "amount", "status", "statusKey"], ["amount"]);
				if (Array.isArray(saved.tools)) tools = validateRecordList(saved.tools, "tools", ["name", "category", "endpoint", "status", "statusKey"], []);
			} catch (error) {
				console.warn("Some saved dashboard records were invalid; defaults will be used:", error);
				orders = JSON.parse(JSON.stringify(dashboardDefaults.orders));
				payments = JSON.parse(JSON.stringify(dashboardDefaults.payments));
				tools = JSON.parse(JSON.stringify(dashboardDefaults.tools));
			}
		}
		renderMetrics();
		renderTools(globalSearch.value);
		renderTable();
	} catch (error) {
		console.warn("Could not load dashboard data:", error);
		showToast("Dashboard data could not be loaded. Refresh the page and try again.");
	} finally {
		document.querySelector("#app-loader").classList.add("is-hidden");
	}
}

renderMetrics();
renderTools();
renderTable();
updateRepositoryStatus();
window.setInterval(updateRepositoryStatus, 300000);
loadDashboardData();
