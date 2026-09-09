// ===============================
// Config
// ===============================

const API_BASE =
    window.SIDEWALK_API_URL || "https://sidewalk-menu-backend.onrender.com/api";

const STATUSES = [
    "جدید",
    "در حال آماده‌سازی",
    "آماده شد",
    "در حال ارسال",
    "تحویل شد",
    "لغو شد"
];

let orders = [];
let products = [];
let pollTimer = null;
let knownOrderCodes = null; // null = هنوز اولین بار لود نشده
let dailyChartInstance = null;
let weeklyChartInstance = null;
let editingProductId = null;


// ===============================
// Elements
// ===============================

const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmit = document.getElementById("loginSubmit");

const appShell = document.getElementById("appShell");
const logoutBtn = document.getElementById("logoutBtn");
const soundToggle = document.getElementById("soundToggle");

const ordersContainer = document.getElementById("ordersContainer");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const clearDateBtn = document.getElementById("clearDateBtn");
const refreshBtn = document.getElementById("refreshBtn");

const totalOrders = document.getElementById("totalOrders");
const newOrders = document.getElementById("newOrders");
const preparingOrders = document.getElementById("preparingOrders");
const readyOrders = document.getElementById("readyOrders");

const orderModal = document.getElementById("orderModal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

const productsContainer = document.getElementById("productsContainer");
const productsEmptyState = document.getElementById("productsEmptyState");
const productsLoadingState = document.getElementById("productsLoadingState");
const productSearchInput = document.getElementById("productSearchInput");
const addProductBtn = document.getElementById("addProductBtn");

const productModal = document.getElementById("productModal");
const productModalClose = document.getElementById("productModalClose");
const productForm = document.getElementById("productForm");
const productFormTitle = document.getElementById("productFormTitle");
const productCancelBtn = document.getElementById("productCancelBtn");

const pf_name = document.getElementById("pf_name");
const pf_category = document.getElementById("pf_category");
const pf_description = document.getElementById("pf_description");
const pf_price = document.getElementById("pf_price");
const pf_image = document.getElementById("pf_image");
const pf_available = document.getElementById("pf_available");

const printArea = document.getElementById("printArea");
const toast = document.getElementById("toast");

// Manual order entry
const manualOrderBtn = document.getElementById("manualOrderBtn");
const manualOrderModal = document.getElementById("manualOrderModal");
const manualOrderModalClose = document.getElementById("manualOrderModalClose");
const manualOrderForm = document.getElementById("manualOrderForm");
const manualOrderCancelBtn = document.getElementById("manualOrderCancelBtn");
const mo_customerName = document.getElementById("mo_customerName");
const mo_customerPhone = document.getElementById("mo_customerPhone");
const mo_deliveryMethod = document.getElementById("mo_deliveryMethod");
const mo_tableBox = document.getElementById("mo_tableBox");
const mo_tableNumber = document.getElementById("mo_tableNumber");
const mo_addressBox = document.getElementById("mo_addressBox");
const mo_address = document.getElementById("mo_address");
const mo_etaBox = document.getElementById("mo_etaBox");
const mo_pickupEta = document.getElementById("mo_pickupEta");
const mo_itemsPicker = document.getElementById("mo_itemsPicker");
const mo_total = document.getElementById("mo_total");
let manualOrderQuantities = new Map();

// QR codes
const qrSiteUrl = document.getElementById("qrSiteUrl");
const qrFrom = document.getElementById("qrFrom");
const qrTo = document.getElementById("qrTo");
const generateQrBtn = document.getElementById("generateQrBtn");
const printQrBtn = document.getElementById("printQrBtn");
const qrGrid = document.getElementById("qrGrid");
const qrPrintArea = document.getElementById("qrPrintArea");

// Advanced reports
const reportGroup = document.getElementById("reportGroup");
const reportFrom = document.getElementById("reportFrom");
const reportTo = document.getElementById("reportTo");
const runReportBtn = document.getElementById("runReportBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");


// ===============================
// Auth helpers
// ===============================

const ADMIN_TOKEN_KEY = "sidewalk_admin_token";

function getAdminToken() {
    try {
        return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
    } catch (_) {
        return "";
    }
}

function setAdminToken(token) {
    try {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch (error) {
        console.error("Could not save admin token:", error);
    }
}

function clearAdminToken() {
    try {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch (error) {
        console.error("Could not remove admin token:", error);
    }
}

async function authFetch(url, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { ...(options.headers || {}) };
    const token = getAdminToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        method,
        headers
    });

    if (response.status === 401) {
        clearAdminToken();
        showLoginScreen("نشست شما منقضی شده، دوباره وارد شوید.");
        throw new Error("Unauthorized");
    }

    return response;
}

function showLoginScreen(message) {
    stopPolling();

    appShell.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    if (message) {
        loginError.textContent = message;
        loginError.classList.remove("hidden");
    }
}

function showApp() {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");

    loadOrders();
    startPolling();
}

async function checkExistingSession() {
    const token = getAdminToken();

    if (!token) {
        loginScreen.classList.remove("hidden");
        appShell.classList.add("hidden");
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/admin/me`);

        if (!response.ok) {
            clearAdminToken();
            loginScreen.classList.remove("hidden");
            appShell.classList.add("hidden");
            return;
        }

        showApp();
    } catch (error) {
        console.error(error);
        clearAdminToken();
        loginScreen.classList.remove("hidden");
        appShell.classList.add("hidden");
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    loginError.classList.add("hidden");
    loginSubmit.disabled = true;
    loginSubmit.innerHTML = '<span>در حال ورود...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: loginUsername.value.trim(),
                password: loginPassword.value
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !data.token) {
            throw new Error(data.message || "ورود ناموفق بود.");
        }

        setAdminToken(data.token);
        loginPassword.value = "";

        showApp();
    } catch (error) {
        console.error(error);
        clearAdminToken();
        loginError.textContent = error.message || "ورود ناموفق بود.";
        loginError.classList.remove("hidden");
    } finally {
        loginSubmit.disabled = false;
        loginSubmit.innerHTML = '<span>ورود به پنل</span> <i class="fa-solid fa-arrow-left"></i>';
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        const token = getAdminToken();

        if (token) {
            await authFetch(`${API_BASE}/admin/logout`, {
                method: "POST"
            });
        }
    } catch (_) {
        // Token is cleared below even if the server logout fails.
    } finally {
        clearAdminToken();
        showLoginScreen();
    }
});


// ===============================
// View navigation
// ===============================

document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", event => {
        event.preventDefault();

        document.querySelectorAll(".nav-item").forEach(i =>
            i.classList.remove("active")
        );
        item.classList.add("active");

        const view = item.dataset.view;

        document.querySelectorAll(".view").forEach(section =>
            section.classList.add("hidden")
        );
        document.getElementById(`view-${view}`).classList.remove("hidden");

        if (view === "products" && products.length === 0) {
            loadProducts();
        }

        if (view === "reports") {
            renderReports();
            loadAdvancedReport();
        }
    });
});


// ===============================
// Load Orders
// ===============================

async function loadOrders() {
    showLoading();

    try {
        const response = await authFetch(`${API_BASE}/orders`);

        if (!response.ok) {
            throw new Error("خطا در دریافت سفارش‌ها");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "خطا در دریافت سفارش‌ها");
        }

        orders = data.orders || [];

        checkForNewOrders();
        updateStats();
        renderOrders();

    } catch (error) {
        console.error(error);

        if (error.message !== "Unauthorized") {
            showToast("اتصال به سرور با مشکل مواجه شد.");
            ordersContainer.innerHTML = "";
            emptyState.classList.remove("hidden");
        }

    } finally {
        loadingState.classList.add("hidden");
    }
}

function startPolling() {
    stopPolling();
    pollTimer = setInterval(loadOrders, 15000);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function checkForNewOrders() {
    const currentCodes = new Set(orders.map(o => o.orderCode));

    if (knownOrderCodes === null) {
        // اولین بار - فقط لیست رو ثبت کن، آلارم نزن
        knownOrderCodes = currentCodes;
        return;
    }

    const hasNew = [...currentCodes].some(
        code => !knownOrderCodes.has(code)
    );

    knownOrderCodes = currentCodes;

    if (hasNew && soundToggle.checked) {
        playAlertSound();
    }
}

function playAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        [0, 0.2].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = 880;

            gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.35);
        });

    } catch (error) {
        console.error("پخش صدا امکان‌پذیر نبود", error);
    }
}


// ===============================
// Render Orders
// ===============================

function renderOrders() {
    const search = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const from = dateFrom.value ? new Date(dateFrom.value + "T00:00:00") : null;
    const to = dateTo.value ? new Date(dateTo.value + "T23:59:59") : null;

    const filtered = orders.filter(order => {
        const matchesSearch =
            !search ||
            order.orderCode.toLowerCase().includes(search) ||
            order.customerName.toLowerCase().includes(search) ||
            (order.tableNumber || "").toLowerCase().includes(search);

        const matchesStatus = status === "all" || order.status === status;

        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        const matchesFrom = !from || (orderDate && orderDate >= from);
        const matchesTo = !to || (orderDate && orderDate <= to);

        return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });

    ordersContainer.innerHTML = "";

    if (filtered.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    filtered.forEach(order => {
        ordersContainer.insertAdjacentHTML("beforeend", createOrderCard(order));
    });
}

[dateFrom, dateTo].forEach(el =>
    el.addEventListener("change", renderOrders)
);

clearDateBtn.addEventListener("click", () => {
    dateFrom.value = "";
    dateTo.value = "";
    renderOrders();
});


// ===============================
// Order Card
// ===============================

function createOrderCard(order) {
    const statusClass = getStatusClass(order.status);

    const itemsHTML = order.items
        .map(item => `
            <div class="order-item">
                <div>
                    <span class="item-name">${escapeHTML(item.name)}</span>
                    <span class="item-quantity">× ${item.quantity}</span>
                </div>
                <span class="item-price">${formatPrice(item.price * item.quantity)}</span>
            </div>
        `)
        .join("");

    const statusOptionsHTML = STATUSES.map(
        s => `<option value="${escapeHTML(s)}" ${s === order.status ? "selected" : ""}>${escapeHTML(s)}</option>`
    ).join("");

    return `
        <article class="order-card" data-order="${escapeHTML(order.orderCode)}">

            <div class="order-top">
                <div>
                    <div class="order-code">${escapeHTML(order.orderCode)}</div>
                    <div class="order-time">${formatDate(order.createdAt)}</div>
                </div>
                <span class="status-badge ${statusClass}">${escapeHTML(order.status)}</span>
            </div>

            <div class="order-info">
                <div class="info-item">
                    <span>مشتری</span>
                    <strong>${escapeHTML(order.customerName)}</strong>
                </div>
                <div class="info-item">
                    <span>نوع سفارش</span>
                    <strong>${getDeliveryMethodHTML(order)}</strong>
                </div>
                <div class="info-item">
                    <span>تماس</span>
                    <strong>${order.customerPhone ? escapeHTML(order.customerPhone) : "ثبت نشده"}</strong>
                </div>
            </div>

            <div class="order-items">${itemsHTML}</div>

            <div class="order-bottom">
                <div class="total">${formatPrice(order.total)} <small>تومان</small></div>

                <div class="order-actions">
                    <select
                        class="status-select"
                        onchange="changeStatus('${escapeJS(order.orderCode)}', this.value)"
                    >
                        ${statusOptionsHTML}
                    </select>

                    <button class="action-btn" onclick="openOrderDetails('${escapeJS(order.orderCode)}')">
                        جزئیات
                    </button>

                    <button class="action-btn delete-btn" onclick="deleteOrder('${escapeJS(order.orderCode)}')">
                        حذف
                    </button>
                </div>
            </div>

        </article>
    `;
}

function getDeliveryMethodHTML(order) {
    const method = order.deliveryMethod || "restaurant";

    if (method === "delivery") {
        return `
            🛵 ارسال با پیک
            <br><span class="sub-info">${order.address ? escapeHTML(order.address) : "آدرس ثبت نشده"}</span>
        `;
    }

    if (method === "pickup") {
        return `
            🛍️ تحویل حضوری
            <br><span class="sub-info">${order.pickupEta ? `${escapeHTML(order.pickupEta)} دقیقه دیگر` : "زمان ثبت نشده"}</span>
        `;
    }

    return `
        🍽️ صرف در رستوران
        <br><span class="sub-info">میز ${order.tableNumber ? escapeHTML(order.tableNumber) : "—"}</span>
    `;
}


// ===============================
// Change Status (انتخاب مستقیم - نه چرخشی)
// ===============================

async function changeStatus(orderCode, nextStatus) {
    const order = orders.find(item => item.orderCode === orderCode);
    if (!order) return;

    const previousStatus = order.status;

    try {
        const response = await authFetch(
            `${API_BASE}/orders/${encodeURIComponent(orderCode)}/status`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "خطا در تغییر وضعیت");
        }

        order.status = data.order.status;
        updateStats();
        renderOrders();

        showToast(`وضعیت سفارش به «${nextStatus}» تغییر کرد.`);

    } catch (error) {
        console.error(error);

        if (error.message !== "Unauthorized") {
            showToast("تغییر وضعیت انجام نشد.");
        }

        order.status = previousStatus;
        renderOrders();
    }
}


// ===============================
// Order details modal + print
// ===============================

function openOrderDetails(orderCode) {
    const order = orders.find(item => item.orderCode === orderCode);
    if (!order) return;

    const itemsRows = order.items
        .map(item => `
            <tr>
                <td>${escapeHTML(item.name)}</td>
                <td>${item.quantity}</td>
                <td>${formatPrice(item.price)}</td>
                <td>${formatPrice(item.price * item.quantity)}</td>
            </tr>
        `)
        .join("");

    const historyHTML = renderCustomerHistoryHTML(order);

    modalBody.innerHTML = `
        <h2>سفارش ${escapeHTML(order.orderCode)}</h2>
        <p><strong>مشتری:</strong> ${escapeHTML(order.customerName)}</p>
        <p><strong>تماس:</strong> ${order.customerPhone ? escapeHTML(order.customerPhone) : "—"}</p>
        <p><strong>نوع سفارش:</strong> ${getDeliveryMethodHTML(order)}</p>
        <p><strong>وضعیت:</strong> ${escapeHTML(order.status)}</p>
        <p><strong>تاریخ:</strong> ${formatDate(order.createdAt)}</p>

        <table class="invoice-table">
            <thead>
                <tr><th>نام</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr>
            </thead>
            <tbody>${itemsRows}</tbody>
        </table>

        <p class="invoice-total"><strong>جمع کل:</strong> ${formatPrice(order.total)} تومان</p>

        <button type="button" class="action-btn" onclick="printInvoice('${escapeJS(order.orderCode)}')">
            🖨️ چاپ فاکتور
        </button>

        ${historyHTML}
    `;

    orderModal.classList.remove("hidden");
}

// Simple client-side history: same phone number, loaded orders only
// (the admin panel already keeps the last 500 orders in memory).
function renderCustomerHistoryHTML(order) {
    if (!order.customerPhone) return "";

    const others = orders.filter(
        o => o.customerPhone === order.customerPhone && o.orderCode !== order.orderCode
    );

    if (others.length === 0) {
        return `<h3 class="history-title">تاریخچه مشتری</h3><p class="sub-info">سفارش دیگری از این مشتری ثبت نشده.</p>`;
    }

    const rows = others
        .slice(0, 10)
        .map(o => `
            <tr>
                <td>${escapeHTML(o.orderCode)}</td>
                <td>${formatDate(o.createdAt)}</td>
                <td>${formatPrice(o.total)}</td>
                <td><span class="status-badge ${getStatusClass(o.status)}">${escapeHTML(o.status)}</span></td>
            </tr>
        `)
        .join("");

    return `
        <h3 class="history-title">تاریخچه مشتری (${others.length} سفارش قبلی)</h3>
        <table class="invoice-table">
            <thead><tr><th>کد سفارش</th><th>تاریخ</th><th>جمع</th><th>وضعیت</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function printInvoice(orderCode) {
    const order = orders.find(item => item.orderCode === orderCode);
    if (!order) return;

    const itemsRows = order.items
        .map(item => `
            <tr>
                <td>${escapeHTML(item.name)}</td>
                <td>${item.quantity}</td>
                <td>${formatPrice(item.price)}</td>
                <td>${formatPrice(item.price * item.quantity)}</td>
            </tr>
        `)
        .join("");

    printArea.innerHTML = `
        <div class="invoice">
            <h1>SIDE WALK</h1>
            <p>فاکتور سفارش ${escapeHTML(order.orderCode)}</p>
            <p>${formatDate(order.createdAt)}</p>
            <hr>
            <p>مشتری: ${escapeHTML(order.customerName)}</p>
            <p>${getDeliveryMethodHTML(order).replace(/<br>/g, " - ")}</p>
            <table>
                <thead>
                    <tr><th>نام</th><th>تعداد</th><th>واحد</th><th>جمع</th></tr>
                </thead>
                <tbody>${itemsRows}</tbody>
            </table>
            <hr>
            <p class="invoice-total-print">جمع کل: ${formatPrice(order.total)} تومان</p>
            <p class="invoice-thanks">با تشکر از خرید شما 🙏</p>
        </div>
    `;

    window.print();
}


// ===============================
// Delete Order
// ===============================

async function deleteOrder(orderCode) {
    const confirmed = confirm(`آیا از حذف سفارش ${orderCode} مطمئن هستید؟`);
    if (!confirmed) return;

    try {
        const response = await authFetch(
            `${API_BASE}/orders/${encodeURIComponent(orderCode)}`,
            { method: "DELETE" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "خطا در حذف سفارش");
        }

        orders = orders.filter(order => order.orderCode !== orderCode);
        updateStats();
        renderOrders();

        showToast("سفارش با موفقیت حذف شد.");

    } catch (error) {
        console.error(error);

        if (error.message !== "Unauthorized") {
            showToast("حذف سفارش انجام نشد.");
        }
    }
}


// ===============================
// Stats
// ===============================

function updateStats() {
    totalOrders.textContent = orders.length;
    newOrders.textContent = orders.filter(o => o.status === "جدید").length;
    preparingOrders.textContent = orders.filter(o => o.status === "در حال آماده‌سازی").length;
    readyOrders.textContent = orders.filter(o => o.status === "آماده شد").length;
}


// ===============================
// Manual order entry (staff, from the panel)
// ===============================

function updateManualOrderConditionalFields() {
    const method = mo_deliveryMethod.value;
    mo_tableBox.classList.toggle("hidden", method !== "restaurant");
    mo_addressBox.classList.toggle("hidden", method !== "delivery");
    mo_etaBox.classList.toggle("hidden", method !== "pickup");
}

mo_deliveryMethod.addEventListener("change", updateManualOrderConditionalFields);

function renderManualOrderItemsPicker() {
    if (products.length === 0) {
        mo_itemsPicker.innerHTML = `<p class="sub-info">ابتدا از بخش «محصولات» چند آیتم اضافه کنید.</p>`;
        return;
    }

    mo_itemsPicker.innerHTML = products
        .filter(p => p.availableNow !== false)
        .map(product => {
            const qty = manualOrderQuantities.get(product._id) || 0;
            return `
                <div class="mo-item-row" data-product="${escapeHTML(product._id)}">
                    <span class="mo-item-name">${escapeHTML(product.name)}</span>
                    <span class="mo-item-price">${formatPrice(product.price)}</span>
                    <div class="mo-item-qty">
                        <button type="button" onclick="changeManualQty('${escapeJS(product._id)}', -1)">−</button>
                        <span>${qty}</span>
                        <button type="button" onclick="changeManualQty('${escapeJS(product._id)}', 1)">+</button>
                    </div>
                </div>
            `;
        })
        .join("");
}

function changeManualQty(productId, delta) {
    const current = manualOrderQuantities.get(productId) || 0;
    const next = Math.max(0, Math.min(50, current + delta));

    if (next === 0) manualOrderQuantities.delete(productId);
    else manualOrderQuantities.set(productId, next);

    renderManualOrderItemsPicker();
    updateManualOrderTotal();
}

function updateManualOrderTotal() {
    let total = 0;
    for (const [productId, qty] of manualOrderQuantities.entries()) {
        const product = products.find(p => p._id === productId);
        if (product) total += Number(product.price) * qty;
    }
    mo_total.textContent = `${formatPrice(total)} تومان`;
}

manualOrderBtn.addEventListener("click", async () => {
    manualOrderForm.reset();
    manualOrderQuantities = new Map();
    updateManualOrderConditionalFields();

    if (products.length === 0) {
        await loadProducts();
    }

    renderManualOrderItemsPicker();
    updateManualOrderTotal();
    manualOrderModal.classList.remove("hidden");
});

[manualOrderModalClose, manualOrderCancelBtn].forEach(btn =>
    btn.addEventListener("click", () => manualOrderModal.classList.add("hidden"))
);

manualOrderForm.addEventListener("submit", async event => {
    event.preventDefault();

    const items = [...manualOrderQuantities.entries()].map(([productId, quantity]) => ({
        productId,
        quantity
    }));

    if (items.length === 0) {
        showToast("حداقل یک محصول برای سفارش دستی انتخاب کنید.");
        return;
    }

    const payload = {
        customerName: mo_customerName.value.trim(),
        customerPhone: mo_customerPhone.value.trim(),
        deliveryMethod: mo_deliveryMethod.value,
        tableNumber: mo_tableNumber.value.trim(),
        address: mo_address.value.trim(),
        pickupEta: mo_pickupEta.value.trim(),
        items
    };

    try {
        const response = await authFetch(`${API_BASE}/orders/manual`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "ثبت سفارش دستی ناموفق بود.");
        }

        manualOrderModal.classList.add("hidden");
        showToast("سفارش دستی با موفقیت ثبت شد.");
        loadOrders();

    } catch (error) {
        console.error(error);
        if (error.message !== "Unauthorized") {
            showToast(error.message);
        }
    }
});


// ===============================
// Products
// ===============================

async function loadProducts() {
    productsLoadingState.classList.remove("hidden");
    productsEmptyState.classList.add("hidden");

    try {
        const response = await fetch(`${API_BASE}/products`);

        if (!response.ok) {
            throw new Error("خطا در دریافت محصولات");
        }

        products = await response.json();
        renderProducts();

    } catch (error) {
        console.error(error);
        showToast("دریافت محصولات با مشکل مواجه شد.");
    } finally {
        productsLoadingState.classList.add("hidden");
    }
}

function renderProducts() {
    const search = productSearchInput.value.trim().toLowerCase();

    const filtered = products.filter(product =>
        !search ||
        product.name.toLowerCase().includes(search) ||
        (product.category || "").toLowerCase().includes(search)
    );

    productsContainer.innerHTML = "";

    if (filtered.length === 0) {
        productsEmptyState.classList.remove("hidden");
        return;
    }

    productsEmptyState.classList.add("hidden");

    filtered.forEach(product => {
        productsContainer.insertAdjacentHTML("beforeend", createProductCard(product));
    });
}

function createProductCard(product) {
    const soldOutToday = Boolean(product.soldOutToday);

    return `
        <article class="product-card" data-product="${escapeHTML(product._id)}">
            <div class="product-top">
                <strong>${escapeHTML(product.name)}</strong>
                <span class="status-badge ${product.available ? "status-ready" : "status-cancelled"}">
                    ${product.available ? "موجود" : "ناموجود"}
                </span>
            </div>
            <div class="product-category">${escapeHTML(product.category)}</div>
            <div class="product-price">${formatPrice(product.price)} تومان</div>

            ${soldOutToday ? `<div class="sub-info sold-out-today-badge">⛔ امروز موجود نیست</div>` : ""}

            <div class="order-actions">
                <button class="action-btn" onclick="editProduct('${escapeJS(product._id)}')">ویرایش</button>
                <button
                    class="action-btn ${soldOutToday ? "" : "delete-btn"}"
                    onclick="toggleSoldOutToday('${escapeJS(product._id)}', ${!soldOutToday})"
                >
                    ${soldOutToday ? "برگرداندن به موجودی" : "اتمام امروز"}
                </button>
                <button class="action-btn delete-btn" onclick="deleteProduct('${escapeJS(product._id)}')">حذف</button>
            </div>
        </article>
    `;
}

async function toggleSoldOutToday(id, soldOut) {
    try {
        const response = await authFetch(
            `${API_BASE}/products/${encodeURIComponent(id)}/sold-out-today`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ soldOut })
            }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "تغییر وضعیت انجام نشد.");
        }

        const updated = await response.json();
        const index = products.findIndex(p => p._id === id);
        if (index !== -1) products[index] = updated;

        renderProducts();
        showToast(soldOut ? "محصول برای امروز ناموجود شد." : "محصول دوباره موجود شد.");

    } catch (error) {
        console.error(error);
        if (error.message !== "Unauthorized") {
            showToast(error.message);
        }
    }
}

productSearchInput.addEventListener("input", renderProducts);

addProductBtn.addEventListener("click", () => {
    editingProductId = null;
    productFormTitle.textContent = "افزودن محصول";
    productForm.reset();
    pf_available.checked = true;
    productModal.classList.remove("hidden");
});

function editProduct(id) {
    const product = products.find(p => p._id === id);
    if (!product) return;

    editingProductId = id;
    productFormTitle.textContent = "ویرایش محصول";

    pf_name.value = product.name || "";
    pf_category.value = product.category || "";
    pf_description.value = product.description || "";
    pf_price.value = product.price || 0;
    pf_image.value = product.image || "";
    pf_available.checked = !!product.available;

    productModal.classList.remove("hidden");
}

productCancelBtn.addEventListener("click", () => {
    productModal.classList.add("hidden");
});

productModalClose.addEventListener("click", () => {
    productModal.classList.add("hidden");
});

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
        name: pf_name.value.trim(),
        category: pf_category.value.trim(),
        description: pf_description.value.trim(),
        price: Number(pf_price.value),
        image: pf_image.value.trim(),
        available: pf_available.checked
    };

    try {
        const url = editingProductId
            ? `${API_BASE}/products/${encodeURIComponent(editingProductId)}`
            : `${API_BASE}/products`;

        const response = await authFetch(url, {
            method: editingProductId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "ذخیره محصول با خطا مواجه شد.");
        }

        productModal.classList.add("hidden");
        showToast("محصول با موفقیت ذخیره شد.");
        loadProducts();

    } catch (error) {
        console.error(error);

        if (error.message !== "Unauthorized") {
            showToast(error.message);
        }
    }
});

async function deleteProduct(id) {
    const confirmed = confirm("آیا از حذف این محصول مطمئن هستید؟");
    if (!confirmed) return;

    try {
        const response = await authFetch(
            `${API_BASE}/products/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "حذف محصول با خطا مواجه شد.");
        }

        products = products.filter(p => p._id !== id);
        renderProducts();
        showToast("محصول حذف شد.");

    } catch (error) {
        console.error(error);

        if (error.message !== "Unauthorized") {
            showToast(error.message);
        }
    }
}


// ===============================
// Reports
// ===============================

function renderReports() {
    const activeOrders = orders.filter(o => o.status !== "لغو شد");

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todaySalesValue = activeOrders
        .filter(o => new Date(o.createdAt) >= startOfToday)
        .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const lastWeekOrders = activeOrders.filter(
        o => new Date(o.createdAt) >= sevenDaysAgo
    );

    document.getElementById("todaySales").textContent = `${formatPrice(todaySalesValue)} تومان`;
    document.getElementById("weekSales").textContent =
        `${formatPrice(lastWeekOrders.reduce((s, o) => s + Number(o.total || 0), 0))} تومان`;
    document.getElementById("weekOrderCount").textContent = lastWeekOrders.length;

    renderDailyChart(activeOrders, startOfToday);
    renderWeeklyChart(activeOrders, startOfToday);
}

function renderDailyChart(activeOrders, startOfToday) {
    const days = [];
    const totals = [];

    for (let i = 13; i >= 0; i--) {
        const day = new Date(startOfToday);
        day.setDate(day.getDate() - i);

        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayTotal = activeOrders
            .filter(o => {
                const created = new Date(o.createdAt);
                return created >= day && created < nextDay;
            })
            .reduce((sum, o) => sum + Number(o.total || 0), 0);

        days.push(day.toLocaleDateString("fa-IR", { month: "2-digit", day: "2-digit" }));
        totals.push(dayTotal);
    }

    if (dailyChartInstance) dailyChartInstance.destroy();

    dailyChartInstance = new Chart(document.getElementById("dailyChart"), {
        type: "bar",
        data: {
            labels: days,
            datasets: [{ label: "فروش (تومان)", data: totals, backgroundColor: "#d6a85f" }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderWeeklyChart(activeOrders, startOfToday) {
    const labels = [];
    const totals = [];

    for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(startOfToday);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekEndExclusive = new Date(weekEnd);
        weekEndExclusive.setDate(weekEndExclusive.getDate() + 1);

        const weekTotal = activeOrders
            .filter(o => {
                const created = new Date(o.createdAt);
                return created >= weekStart && created < weekEndExclusive;
            })
            .reduce((sum, o) => sum + Number(o.total || 0), 0);

        labels.push(
            `${weekStart.toLocaleDateString("fa-IR", { month: "2-digit", day: "2-digit" })} تا ` +
            `${weekEnd.toLocaleDateString("fa-IR", { month: "2-digit", day: "2-digit" })}`
        );
        totals.push(weekTotal);
    }

    if (weeklyChartInstance) weeklyChartInstance.destroy();

    weeklyChartInstance = new Chart(document.getElementById("weeklyChart"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "فروش (تومان)",
                data: totals,
                borderColor: "#d6a85f",
                backgroundColor: "rgba(214,168,95,0.18)",
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}


// ===============================
// QR codes per table
// ===============================

const QR_SITE_URL_KEY = "sidewalk_qr_site_url";

function loadSavedQrSiteUrl() {
    try {
        qrSiteUrl.value = localStorage.getItem(QR_SITE_URL_KEY) || window.location.origin.replace("/admin", "") || "";
    } catch (_) {
        // ignore
    }
}

generateQrBtn.addEventListener("click", () => {
    const baseUrl = qrSiteUrl.value.trim().replace(/\/+$/, "");
    const from = Math.max(1, Number(qrFrom.value) || 1);
    const to = Math.max(from, Number(qrTo.value) || from);

    if (!baseUrl) {
        showToast("لطفاً آدرس سایت مشتری را وارد کنید.");
        return;
    }

    if (to - from > 200) {
        showToast("تعداد میزها بیش از حد مجاز است.");
        return;
    }

    try {
        localStorage.setItem(QR_SITE_URL_KEY, baseUrl);
    } catch (_) {
        // ignore
    }

    qrGrid.innerHTML = "";

    for (let table = from; table <= to; table++) {
        const cardId = `qr-card-${table}`;
        qrGrid.insertAdjacentHTML(
            "beforeend",
            `<div class="qr-card" id="${cardId}">
                <div class="qr-canvas"></div>
                <strong>میز ${table}</strong>
            </div>`
        );

        const url = `${baseUrl}/?table=${encodeURIComponent(table)}`;
        const container = document.querySelector(`#${cardId} .qr-canvas`);

        // eslint-disable-next-line no-undef
        new QRCode(container, {
            text: url,
            width: 160,
            height: 160,
            colorDark: "#1c1208",
            colorLight: "#ffffff"
        });
    }

    showToast(`${to - from + 1} کد QR ساخته شد.`);
});

printQrBtn.addEventListener("click", () => {
    if (!qrGrid.children.length) {
        showToast("ابتدا کد QR بساز.");
        return;
    }

    qrPrintArea.innerHTML = `
        <div class="qr-print-sheet">
            ${qrGrid.innerHTML}
        </div>
    `;

    window.print();
});

loadSavedQrSiteUrl();


// ===============================
// Advanced reports (backend aggregation)
// ===============================

function defaultReportRange() {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10)
    };
}

function initReportDateInputs() {
    const range = defaultReportRange();
    if (!reportFrom.value) reportFrom.value = range.from;
    if (!reportTo.value) reportTo.value = range.to;
}

function buildReportQuery() {
    const params = new URLSearchParams();
    params.set("group", reportGroup.value || "day");
    if (reportFrom.value) params.set("from", new Date(`${reportFrom.value}T00:00:00`).toISOString());
    if (reportTo.value) params.set("to", new Date(`${reportTo.value}T23:59:59`).toISOString());
    return params.toString();
}

const DELIVERY_METHOD_LABELS = {
    restaurant: "🍽️ صرف در رستوران",
    delivery: "🛵 ارسال با پیک",
    pickup: "🛍️ دریافت حضوری"
};

async function loadAdvancedReport() {
    initReportDateInputs();

    try {
        const response = await authFetch(`${API_BASE}/admin/reports?${buildReportQuery()}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "دریافت گزارش پیشرفته ناموفق بود.");
        }

        const report = data.report;

        document.getElementById("rpOrderCount").textContent = report.totalOrders;
        document.getElementById("rpTotalSales").textContent = `${formatPrice(report.totalSales)} تومان`;
        document.getElementById("rpAvgOrder").textContent = `${formatPrice(report.averageOrder)} تومان`;
        document.getElementById("rpCancelled").textContent = report.cancelledCount;

        const topProductsBody = document.querySelector("#topProductsTable tbody");
        topProductsBody.innerHTML = report.topProducts
            .map(p => `<tr><td>${escapeHTML(p.name)}</td><td>${p.quantity}</td><td>${formatPrice(p.revenue)}</td></tr>`)
            .join("") || `<tr><td colspan="3" class="sub-info">داده‌ای برای این بازه نیست</td></tr>`;

        const deliveryBody = document.querySelector("#deliveryBreakdownTable tbody");
        deliveryBody.innerHTML = Object.keys(report.byDeliveryMethod)
            .map(method => `
                <tr>
                    <td>${DELIVERY_METHOD_LABELS[method] || method}</td>
                    <td>${report.byDeliveryMethod[method]}</td>
                    <td>${formatPrice(report.byDeliveryMethodSales[method])}</td>
                </tr>
            `)
            .join("");

    } catch (error) {
        console.error(error);
        if (error.message !== "Unauthorized") {
            showToast(error.message);
        }
    }
}

runReportBtn.addEventListener("click", loadAdvancedReport);

exportCsvBtn.addEventListener("click", async () => {
    try {
        const response = await authFetch(`${API_BASE}/admin/reports/export.csv?${buildReportQuery()}`);

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "خروجی CSV ناموفق بود.");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "orders-report.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error(error);
        if (error.message !== "Unauthorized") {
            showToast(error.message);
        }
    }
});


// ===============================
// Helpers
// ===============================

function getStatusClass(status) {
    switch (status) {
        case "جدید": return "status-new";
        case "در حال آماده‌سازی": return "status-preparing";
        case "آماده شد": return "status-ready";
        case "در حال ارسال": return "status-shipping";
        case "تحویل شد": return "status-delivered";
        case "لغو شد": return "status-cancelled";
        default: return "";
    }
}

function formatPrice(price) {
    return Number(price || 0).toLocaleString("fa-IR");
}

function formatDate(date) {
    if (!date) return "";
    return new Date(date).toLocaleString("fa-IR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
    });
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeJS(value) {
    return String(value ?? "")
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll("\n", "\\n")
        .replaceAll("\r", "\\r");
}

function showLoading() {
    loadingState.classList.remove("hidden");
    emptyState.classList.add("hidden");
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}


// ===============================
// Events
// ===============================

searchInput.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);
refreshBtn.addEventListener("click", loadOrders);

modalClose.addEventListener("click", () => {
    orderModal.classList.add("hidden");
});


// ===============================
// Start
// ===============================

checkExistingSession();