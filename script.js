let orders = [];
let inventory = [];
let customers = [];

const views = {
	overview: { title: "डैशबोर्ड", heading: "नमस्ते, Khatu Universal", subtitle: "आज आपके बिज़नेस में क्या चल रहा है, यहाँ देखें।", tableTitle: "हाल के ऑर्डर", kind: "orders" },
	orders: { title: "ऑर्डर", heading: "आपके ऑर्डर", subtitle: "सभी ऑर्डर की स्थिति और जानकारी एक जगह।", tableTitle: "सभी ऑर्डर", kind: "orders" },
	inventory: { title: "इन्वेंटरी", heading: "आपकी इन्वेंटरी", subtitle: "उत्पाद और स्टॉक की मौजूदा स्थिति।", tableTitle: "कम स्टॉक वाले उत्पाद", kind: "inventory" },
	customers: { title: "ग्राहक", heading: "आपके ग्राहक", subtitle: "ग्राहक संबंध और खरीदारी की जानकारी।", tableTitle: "हाल के ग्राहक", kind: "customers" },
	reports: { title: "रिपोर्ट", heading: "बिज़नेस रिपोर्ट", subtitle: "बिक्री और ऑर्डर के प्रदर्शन का सारांश।", tableTitle: "बिक्री के ऑर्डर", kind: "orders" },
};

const tableHead = document.querySelector("#table-head");
const tableBody = document.querySelector("#table-body");
const tableSearch = document.querySelector("#table-search");
const globalSearch = document.querySelector("#global-search");
const toast = document.querySelector("#toast");
let activeView = "overview";
let toastTimer;

function formatCurrency(value) {
	return `₹${value.toLocaleString("en-IN")}`;
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add("is-visible");
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function renderStock() {
	const stockList = document.querySelector("#low-stock-list");
	stockList.innerHTML = inventory.map((item) => `
		<div class="stock-item">
			<span class="product-thumb ${item.tone}">${item.mark}</span>
			<span class="product-info"><strong>${item.name}</strong><small>${item.sku}</small></span>
			<span class="stock-pill">${item.stock} बचे</span>
		</div>
	`).join("");
}

function getTableRows(kind, query) {
	const normalizedQuery = query.trim().toLocaleLowerCase("hi");
	if (kind === "inventory") {
		const filtered = inventory.filter((item) => `${item.name} ${item.sku}`.toLocaleLowerCase("hi").includes(normalizedQuery));
		return {
			header: "<tr><th>उत्पाद</th><th>SKU</th><th>उपलब्ध स्टॉक</th><th>स्थिति</th></tr>",
			rows: filtered.map((item) => `<tr><td><span class="customer-cell"><span class="product-thumb ${item.tone}">${item.mark}</span><strong>${item.name}</strong></span></td><td>${item.sku}</td><td>${item.stock} यूनिट</td><td><span class="stock-pill">कम स्टॉक</span></td></tr>`),
			total: filtered.length,
			noun: "उत्पाद",
		};
	}
	if (kind === "customers") {
		const filtered = customers.filter((customer) => `${customer.name} ${customer.email}`.toLocaleLowerCase("hi").includes(normalizedQuery));
		return {
			header: "<tr><th>ग्राहक</th><th>कुल ऑर्डर</th><th>कुल खरीदारी</th><th>जुड़ने की तारीख</th></tr>",
			rows: filtered.map((customer) => `<tr><td><span class="customer-cell"><span class="customer-initial ${customer.tone}">${customer.initials}</span><span><strong>${customer.name}</strong><br><small>${customer.email}</small></span></span></td><td>${customer.orders}</td><td>${formatCurrency(customer.spent)}</td><td>${customer.joined}</td></tr>`),
			total: filtered.length,
			noun: "ग्राहक",
		};
	}
	const filtered = orders.filter((order) => `${order.id} ${order.name} ${order.status}`.toLocaleLowerCase("hi").includes(normalizedQuery));
	return {
		header: "<tr><th>ऑर्डर आईडी</th><th>ग्राहक</th><th>तारीख</th><th>राशि</th><th>स्थिति</th></tr>",
		rows: filtered.map((order) => `<tr><td class="order-id">${order.id}</td><td><span class="customer-cell"><span class="customer-initial ${order.tone}">${order.initials}</span>${order.name}</span></td><td>${order.date}</td><td>${formatCurrency(order.amount)}</td><td><span class="status status-${order.statusKey}">${order.status}</span></td></tr>`),
		total: filtered.length,
		noun: "ऑर्डर",
	};
}

function renderTable() {
	const view = views[activeView];
	const result = getTableRows(view.kind, tableSearch.value || globalSearch.value);
	tableHead.innerHTML = result.header;
	tableBody.innerHTML = result.rows.length ? result.rows.join("") : `<tr><td class="empty-state" colspan="5">कोई परिणाम नहीं मिला।</td></tr>`;
	document.querySelector("#table-title").textContent = view.tableTitle;
	document.querySelector("#table-count").textContent = `${result.total} ${result.noun} मिले`;
}

function setView(viewName) {
	if (!views[viewName]) return;
	activeView = viewName;
	const view = views[viewName];
	document.querySelectorAll(".nav-link").forEach((link) => {
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
	document.querySelector(".sales-panel").hidden = viewName === "reports";
	document.querySelector(".stock-panel").hidden = viewName === "orders" || viewName === "reports";
	tableSearch.value = "";
	renderTable();
	window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => setView(link.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.openView)));
tableSearch.addEventListener("input", renderTable);
globalSearch.addEventListener("input", () => {
	if (activeView !== "orders") setView("orders");
	tableSearch.value = globalSearch.value;
	renderTable();
});

document.querySelector("#period-select").addEventListener("change", (event) => {
	const period = event.target.value;
	const labels = { week: "इस हफ़्ते", month: "इस महीने", year: "इस साल" };
	const sales = { week: 248560, month: 934820, year: 7826410 };
	const count = { week: "1,284", month: "4,892", year: "38,416" };
	document.querySelector("#sales-value").textContent = formatCurrency(sales[period]);
	document.querySelector("#chart-total").textContent = formatCurrency(sales[period]);
	document.querySelector("#orders-value").textContent = count[period];
	document.querySelector(".legend-current").parentElement.lastChild.textContent = labels[period];
	showToast(`${labels[period]} का सारांश दिखाया जा रहा है।`);
});

document.querySelector("#export-button").addEventListener("click", () => {
	const headings = ["ऑर्डर आईडी", "ग्राहक", "तारीख", "राशि (INR)", "स्थिति"];
	const lines = [headings, ...orders.map((order) => [order.id, order.name, order.date, order.amount, order.status])];
	const csv = `\uFEFF${lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
	link.download = "khatu-universal-orders.csv";
	link.click();
	URL.revokeObjectURL(link.href);
	showToast("ऑर्डर रिपोर्ट डाउनलोड हो गई।");
});

document.querySelector(".notification-button").addEventListener("click", () => showToast("आपके पास 3 नई सूचनाएं हैं।"));
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
		orders = Array.isArray(data.orders) ? data.orders : [];
		inventory = Array.isArray(data.inventory) ? data.inventory : [];
		customers = Array.isArray(data.customers) ? data.customers : [];
		renderStock();
		renderTable();
	} catch (error) {
		console.error("Could not load dashboard data:", error);
		showToast("डैशबोर्ड डेटा लोड नहीं हुआ। पेज रीफ़्रेश करके फिर कोशिश करें।");
	}
}

renderStock();
renderTable();
loadDashboardData();
