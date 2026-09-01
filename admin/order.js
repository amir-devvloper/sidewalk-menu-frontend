const API_URL =
    "https://sidewalk-menu-backend.onrender.com/api/orders";


let orders = [];


// ===============================
// Elements
// ===============================

const ordersContainer =
    document.getElementById("ordersContainer");

const loadingState =
    document.getElementById("loadingState");

const emptyState =
    document.getElementById("emptyState");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const refreshBtn =
    document.getElementById("refreshBtn");

const totalOrders =
    document.getElementById("totalOrders");

const newOrders =
    document.getElementById("newOrders");

const preparingOrders =
    document.getElementById("preparingOrders");

const readyOrders =
    document.getElementById("readyOrders");

const orderModal =
    document.getElementById("orderModal");

const modalBody =
    document.getElementById("modalBody");

const modalClose =
    document.getElementById("modalClose");

const toast =
    document.getElementById("toast");


// ===============================
// Load Orders
// ===============================

async function loadOrders() {

    showLoading();

    try {

        const response =
            await fetch(API_URL);

        if (!response.ok) {
            throw new Error(
                "خطا در دریافت سفارش‌ها"
            );
        }

        const data =
            await response.json();

        if (!data.success) {
            throw new Error(
                data.message ||
                "خطا در دریافت سفارش‌ها"
            );
        }

        orders = data.orders || [];

        updateStats();

        renderOrders();

    } catch (error) {

        console.error(error);

        showToast(
            "اتصال به سرور با مشکل مواجه شد."
        );

        ordersContainer.innerHTML = "";

        emptyState.classList.remove(
            "hidden"
        );

    } finally {

        loadingState.classList.add(
            "hidden"
        );

    }

}


// ===============================
// Render
// ===============================

function renderOrders() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const status =
        statusFilter.value;


    const filtered =
        orders.filter(order => {

            const matchesSearch =
                !search ||

                order.orderCode
                    .toLowerCase()
                    .includes(search) ||

                order.customerName
                    .toLowerCase()
                    .includes(search) ||

                order.tableNumber
                    .toLowerCase()
                    .includes(search);


            const matchesStatus =
                status === "all" ||
                order.status === status;


            return (
                matchesSearch &&
                matchesStatus
            );

        });


    ordersContainer.innerHTML = "";


    if (filtered.length === 0) {

        emptyState.classList.remove(
            "hidden"
        );

        return;

    }


    emptyState.classList.add(
        "hidden"
    );


    filtered.forEach(order => {

        ordersContainer.insertAdjacentHTML(
            "beforeend",
            createOrderCard(order)
        );

    });

}


// ===============================
// Order Card
// ===============================

function createOrderCard(order) {

    const statusClass =
        getStatusClass(order.status);


    const itemsHTML =
        order.items
            .map(item => `
                <div class="order-item">

                    <div>
                        <span class="item-name">
                            ${escapeHTML(item.name)}
                        </span>

                        <span class="item-quantity">
                            × ${item.quantity}
                        </span>
                    </div>

                    <span class="item-price">
                        ${formatPrice(
                            item.price *
                            item.quantity
                        )}
                    </span>

                </div>
            `)
            .join("");


    return `
        <article
            class="order-card"
            data-order="${escapeHTML(
                order.orderCode
            )}"
        >

            <div class="order-top">

                <div>
                    <div class="order-code">
                        ${escapeHTML(
                            order.orderCode
                        )}
                    </div>

                    <div class="order-time">
                        ${formatDate(
                            order.createdAt
                        )}
                    </div>
                </div>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHTML(
                        order.status
                    )}
                </span>

            </div>


            <div class="order-info">

                <div class="info-item">

                    <span>
                        مشتری
                    </span>

                    <strong>
                        ${escapeHTML(
                            order.customerName
                        )}
                    </strong>

                </div>


                <div class="info-item">

                    <span>
                        شماره میز
                    </span>

                    <strong>
                        میز ${escapeHTML(
                            order.tableNumber
                        )}
                    </strong>

                </div>


                <div class="info-item">

                    <span>
                        تماس
                    </span>

                    <strong>
                        ${order.customerPhone
                            ? escapeHTML(
                                order.customerPhone
                              )
                            : "ثبت نشده"}
                    </strong>

                </div>

            </div>


            <div class="order-items">

                ${itemsHTML}

            </div>


            <div class="order-bottom">

                <div class="total">

                    ${formatPrice(order.total)}

                    <small>
                        تومان
                    </small>

                </div>


                <div class="order-actions">

                    <button
                        class="action-btn status-btn"
                        onclick="changeStatus(
                            '${escapeJS(
                                order.orderCode
                            )}'
                        )"
                    >
                        تغییر وضعیت
                    </button>


                    <button
                        class="action-btn delete-btn"
                        onclick="deleteOrder(
                            '${escapeJS(
                                order.orderCode
                            )}'
                        )"
                    >
                        حذف
                    </button>

                </div>

            </div>

        </article>
    `;

}


// ===============================
// Change Status
// ===============================

async function changeStatus(orderCode) {

    const order =
        orders.find(
            item =>
                item.orderCode === orderCode
        );

    if (!order) return;


    const statuses = [
        "جدید",
        "در حال آماده‌سازی",
        "آماده شد",
        "تحویل شد",
        "لغو شد"
    ];


    const currentIndex =
        statuses.indexOf(order.status);


    const nextIndex =
        (currentIndex + 1) %
        statuses.length;


    const nextStatus =
        statuses[nextIndex];


    try {

        const response =
            await fetch(
                `${API_URL}/${encodeURIComponent(
                    orderCode
                )}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status: nextStatus
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "خطا در تغییر وضعیت"
            );

        }


        order.status =
            data.order.status;


        updateStats();

        renderOrders();


        showToast(
            `وضعیت سفارش به «${nextStatus}» تغییر کرد.`
        );


    } catch (error) {

        console.error(error);

        showToast(
            "تغییر وضعیت انجام نشد."
        );

    }

}


// ===============================
// Delete
// ===============================

async function deleteOrder(orderCode) {

    const confirmed =
        confirm(
            `آیا از حذف سفارش ${orderCode} مطمئن هستید؟`
        );


    if (!confirmed) return;


    try {

        const response =
            await fetch(
                `${API_URL}/${encodeURIComponent(
                    orderCode
                )}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "خطا در حذف سفارش"
            );

        }


        orders =
            orders.filter(
                order =>
                    order.orderCode !==
                    orderCode
            );


        updateStats();

        renderOrders();


        showToast(
            "سفارش با موفقیت حذف شد."
        );


    } catch (error) {

        console.error(error);

        showToast(
            "حذف سفارش انجام نشد."
        );

    }

}


// ===============================
// Stats
// ===============================

function updateStats() {

    totalOrders.textContent =
        orders.length;


    newOrders.textContent =
        orders.filter(
            order =>
                order.status === "جدید"
        ).length;


    preparingOrders.textContent =
        orders.filter(
            order =>
                order.status ===
                "در حال آماده‌سازی"
        ).length;


    readyOrders.textContent =
        orders.filter(
            order =>
                order.status ===
                "آماده شد"
        ).length;

}


// ===============================
// Helpers
// ===============================

function getStatusClass(status) {

    switch (status) {

        case "جدید":
            return "status-new";

        case "در حال آماده‌سازی":
            return "status-preparing";

        case "آماده شد":
            return "status-ready";

        case "تحویل شد":
            return "status-delivered";

        case "لغو شد":
            return "status-cancelled";

        default:
            return "";

    }

}


function formatPrice(price) {

    return Number(price)
        .toLocaleString("fa-IR");

}


function formatDate(date) {

    if (!date) return "";

    return new Date(date)
        .toLocaleString(
            "fa-IR",
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

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

    loadingState.classList.remove(
        "hidden"
    );

    emptyState.classList.add(
        "hidden"
    );

}


function showToast(message) {

    toast.textContent =
        message;

    toast.classList.add("show");


    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 3000);

}


// ===============================
// Events
// ===============================

searchInput.addEventListener(
    "input",
    renderOrders
);


statusFilter.addEventListener(
    "change",
    renderOrders
);


refreshBtn.addEventListener(
    "click",
    loadOrders
);


modalClose.addEventListener(
    "click",
    () => {
        orderModal.classList.add(
            "hidden"
        );
    }
);


// ===============================
// Start
// ===============================

loadOrders();

