let cart =
    JSON.parse(localStorage.getItem("sideWalkCart")) || [];

let favorites =
    JSON.parse(localStorage.getItem("sideWalkFavorites")) || [];

let currentCategory = "all";
let searchTerm = "";

// Backend URL
const API_BASE_URL =
    window.SIDEWALK_API_URL || "https://sidewalk-menu-backend.onrender.com/api";

/* =========================================================
   TABLE QR CODE (?table=N in the URL)
========================================================= */

const qrTableNumber =
    new URLSearchParams(window.location.search).get("table") || "";

/* =========================================================
   PRODUCT CARD QUANTITY STATE (before add to cart)
========================================================= */

const cardQuantities = new Map();

/* =========================================================
   ORDER TRACKING STATE
========================================================= */

let trackPollInterval = null;

const orderStatusMap = {
    "جدید":              { label: "در حال بررسی سفارش", icon: "fa-hourglass-half" },
    "در حال آماده‌سازی": { label: "در حال آماده‌سازی",   icon: "fa-kitchen-set" },
    "آماده شد":          { label: "آماده تحویل",         icon: "fa-box-open" },
    "در حال ارسال":      { label: "در حال ارسال با پیک", icon: "fa-motorcycle" },
    "تحویل شد":          { label: "تحویل داده شد",       icon: "fa-circle-check" },
    "لغو شد":            { label: "لغو شد",              icon: "fa-circle-xmark" }
};

/* =========================================================
   DELIVERY / LOCATION STATE
========================================================= */

let selectedDeliveryMethod = "restaurant";
let selectedLocation = null;
let selectedAddress = "";
let selectedPickupEta = "";

let deliveryMap = null;
let deliveryMarker = null;
let locationAccuracyCircle = null;

// SIDE WALK only serves Kerman city.
const KERMAN_CENTER = { lat: 30.2839, lng: 57.0834 };
const KERMAN_MAX_DISTANCE_KM = 35;

function isInsideKerman(lat, lng) {
    const toRad = value => value * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat - KERMAN_CENTER.lat);
    const dLng = toRad(lng - KERMAN_CENTER.lng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(KERMAN_CENTER.lat)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLng / 2) ** 2;
    const distance =
        2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return distance <= KERMAN_MAX_DISTANCE_KM;
}

/* =========================================================
   DOM
========================================================= */

const menuGrid = document.getElementById("menuGrid");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const noResult = document.getElementById("noResult");

const cartBtn = document.getElementById("cartBtn");
const cartDrawer = document.getElementById("cartDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");

const themeBtn = document.getElementById("themeBtn");

const productModal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");
const modalContent = document.getElementById("modalContent");

/* =========================================================
   CATEGORY INFORMATION
========================================================= */

const categoryInfo = {
    coffee: {
        title: "قهوه",
        english: "COFFEE",
        icon: "fa-mug-hot"
    },
    drink: {
        title: "نوشیدنی",
        english: "DRINKS",
        icon: "fa-glass-water"
    },
    food: {
        title: "غذا",
        english: "FOOD",
        icon: "fa-utensils"
    },
    burger: {
        title: "برگر",
        english: "BURGERS",
        icon: "fa-burger"
    },
    pizza: {
        title: "پیتزا",
        english: "PIZZA",
        icon: "fa-pizza-slice"
    },
    dessert: {
        title: "دسر",
        english: "DESSERT",
        icon: "fa-cake-candles"
    }
};

const categoryOrder = [
    "coffee",
    "drink",
    "food",
    "burger",
    "pizza",
    "dessert"
];

/* =========================================================
   LOAD PRODUCTS FROM API (admin panel data)
========================================================= */

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

const TOMAN_SVG = `<svg class="toman-svg" aria-hidden="true" focusable="false" xmlns:xlink="http://www.w3.org/1999/xlink" width="19" height="22" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.14878 6.91843C1.44428 6.91843 1.70285 6.87142 1.92447 6.77739C2.15282 6.68337 2.34422 6.55577 2.49869 6.39458C2.65316 6.2334 2.77069 6.04535 2.85128 5.83044C2.93187 5.62224 2.97888 5.40062 2.99231 5.16556H1.98492C1.6424 5.16556 1.36033 5.12862 1.1387 5.05474C0.917077 4.98087 0.742461 4.87341 0.614858 4.73238C0.487254 4.59134 0.396588 4.42344 0.34286 4.22868C0.295849 4.0272 0.272343 3.80221 0.272343 3.55372C0.272343 3.29852 0.309281 3.05674 0.383156 2.8284C0.457032 2.60005 0.564488 2.39857 0.705523 2.22396C0.846559 2.04934 1.02117 1.91167 1.22937 1.81093C1.44428 1.70347 1.68941 1.64974 1.96477 1.64974C2.1864 1.64974 2.39795 1.68668 2.59943 1.76056C2.80091 1.83443 2.97888 1.95196 3.13335 2.11315C3.28782 2.26761 3.40871 2.47245 3.49601 2.72766C3.59004 2.97615 3.63705 3.27837 3.63705 3.63431V4.47045H4.60415C4.68474 4.47045 4.73847 4.50068 4.76533 4.56112C4.79891 4.61485 4.8157 4.6988 4.8157 4.81297C4.8157 4.93386 4.79891 5.02452 4.76533 5.08497C4.73847 5.13869 4.68474 5.16556 4.60415 5.16556H3.6169C3.60347 5.49464 3.53631 5.80693 3.41542 6.10244C3.30125 6.39794 3.14007 6.65651 2.93187 6.87813C2.72368 7.09976 2.47518 7.27438 2.1864 7.40198C1.89761 7.5363 1.57188 7.60346 1.20922 7.60346H0.141381L0.0809373 6.91843H1.14878ZM0.896929 3.51343C0.896929 3.68133 0.913719 3.82572 0.947299 3.94661C0.987594 4.0675 1.0514 4.16823 1.1387 4.24883C1.23273 4.3227 1.35697 4.37979 1.51144 4.42008C1.66591 4.45366 1.86067 4.47045 2.09573 4.47045H3.00239V3.71491C3.00239 3.21792 2.90501 2.86198 2.71024 2.64707C2.51548 2.43215 2.24684 2.3247 1.90433 2.3247C1.58196 2.3247 1.33347 2.43215 1.15885 2.64707C0.984237 2.86198 0.896929 3.15076 0.896929 3.51343ZM6.26895 4.47045C6.35626 4.47045 6.41335 4.50068 6.44021 4.56112C6.47379 4.61485 6.49058 4.6988 6.49058 4.81297C6.49058 4.93386 6.47379 5.02452 6.44021 5.08497C6.41335 5.13869 6.35626 5.16556 6.26895 5.16556H4.60675C4.51944 5.16556 4.46235 5.13869 4.43549 5.08497C4.40191 5.03124 4.38512 4.94729 4.38512 4.83312C4.38512 4.71223 4.40191 4.62156 4.43549 4.56112C4.46235 4.50068 4.51944 4.47045 4.60675 4.47045H6.26895ZM7.93155 4.47045C8.01886 4.47045 8.07594 4.50068 8.10281 4.56112C8.13639 4.61485 8.15318 4.6988 8.15318 4.81297C8.15318 4.93386 8.13639 5.02452 8.10281 5.08497C8.07594 5.13869 8.01886 5.16556 7.93155 5.16556H6.26935C6.18204 5.16556 6.12495 5.13869 6.09809 5.08497C6.06451 5.03124 6.04772 4.94729 6.04772 4.83312C6.04772 4.71223 6.06451 4.62156 6.09809 4.56112C6.12495 4.50068 6.18204 4.47045 6.26935 4.47045H7.93155ZM9.59415 4.47045C9.68146 4.47045 9.73854 4.50068 9.76541 4.56112C9.79899 4.61485 9.81578 4.6988 9.81578 4.81297C9.81578 4.93386 9.79899 5.02452 9.76541 5.08497C9.73854 5.13869 9.68146 5.16556 9.59415 5.16556H7.93194C7.84464 5.16556 7.78755 5.13869 7.76069 5.08497C7.72711 5.03124 7.71032 4.94729 7.71032 4.83312C7.71032 4.71223 7.72711 4.62156 7.76069 4.56112C7.78755 4.50068 7.84464 4.47045 7.93194 4.47045H9.59415ZM11.2567 4.47045C11.3441 4.47045 11.4011 4.50068 11.428 4.56112C11.4616 4.61485 11.4784 4.6988 11.4784 4.81297C11.4784 4.93386 11.4616 5.02452 11.428 5.08497C11.4011 5.13869 11.3441 5.16556 11.2567 5.16556H9.59454C9.50723 5.16556 9.45015 5.13869 9.42328 5.08497C9.3897 5.03124 9.37291 4.94729 9.37291 4.83312C9.37291 4.71223 9.3897 4.62156 9.42328 4.56112C9.45015 4.50068 9.50723 4.47045 9.59454 4.47045H11.2567ZM12.1638 4.47045C12.4257 4.47045 12.6339 4.39994 12.7884 4.2589C12.9496 4.11787 13.0302 3.9231 13.0302 3.67461V2.2844H13.685V3.67461C13.685 4.15144 13.5506 4.52082 13.282 4.78275C13.0201 5.03795 12.6608 5.16556 12.2041 5.16556H11.2571C11.1698 5.16556 11.1127 5.13869 11.0859 5.08497C11.0523 5.03124 11.0355 4.94729 11.0355 4.83312C11.0355 4.71223 11.0523 4.62156 11.0859 4.56112C11.1127 4.50068 11.1698 4.47045 11.2571 4.47045H12.1638ZM13.7857 0.994934H12.9798V0.279683H13.7857V0.994934ZM12.5063 0.994934H11.7004V0.279683H12.5063V0.994934ZM5.64177 12.9641C5.64177 13.3267 5.58468 13.6659 5.47051 13.9815C5.35634 14.3039 5.1918 14.5826 4.97689 14.8177C4.76198 15.0595 4.50005 15.2509 4.19112 15.3919C3.8889 15.5329 3.54638 15.6035 3.16357 15.6035H2.56921C1.81702 15.6035 1.23273 15.3718 0.816337 14.9084C0.399946 14.445 0.191751 13.8103 0.191751 13.0044V11.2414H0.836485V12.9842C0.836485 13.273 0.870065 13.5349 0.937225 13.77C1.0111 14.0051 1.12191 14.2065 1.26967 14.3744C1.42413 14.549 1.61554 14.6834 1.84388 14.7774C2.07223 14.8714 2.34758 14.9184 2.66995 14.9184H3.1132C3.42885 14.9184 3.70421 14.8647 3.93927 14.7572C4.17433 14.6565 4.36909 14.5188 4.52356 14.3442C4.68474 14.1696 4.80227 13.9648 4.87615 13.7297C4.95674 13.4946 4.99703 13.2495 4.99703 12.9943V10.2844H5.64177V12.9641ZM3.21394 10.0628H2.36773V9.32738H3.21394V10.0628ZM8.24526 13.1656C8.07064 13.1656 7.90274 13.1421 7.74156 13.095C7.58038 13.0413 7.43598 12.954 7.30838 12.8331C7.18749 12.7122 7.09011 12.5544 7.01624 12.3596C6.94236 12.1582 6.90542 11.9097 6.90542 11.6142V6.9197H7.56023V11.4933C7.56023 11.7754 7.62067 12.0104 7.74156 12.1985C7.86916 12.3798 8.074 12.4705 8.35607 12.4705H8.52733C8.67508 12.4705 8.74896 12.5846 8.74896 12.813C8.74896 13.048 8.67508 13.1656 8.52733 13.1656H8.24526ZM8.69324 12.4705C8.95516 12.4705 9.15328 12.4067 9.2876 12.279C9.42192 12.1514 9.48908 11.9802 9.48908 11.7653V11.3825C9.48908 10.7982 9.63683 10.3415 9.93233 10.0124C10.2346 9.68332 10.6509 9.51878 11.1815 9.51878C11.4569 9.51878 11.6986 9.56243 11.9068 9.64974C12.115 9.73705 12.2863 9.8613 12.4206 10.0225C12.5616 10.1837 12.6657 10.3751 12.7329 10.5967C12.8001 10.8183 12.8336 11.0635 12.8336 11.3321C12.8336 11.9097 12.6825 12.3596 12.3803 12.682C12.0781 13.0044 11.6651 13.1656 11.1412 13.1656C10.8726 13.1656 10.614 13.1152 10.3655 13.0144C10.117 12.907 9.92226 12.7189 9.78123 12.4503C9.72078 12.6048 9.64691 12.729 9.5596 12.823C9.47229 12.9171 9.38162 12.9909 9.2876 13.0447C9.19358 13.0917 9.09284 13.1253 8.98538 13.1454C8.88464 13.1588 8.78726 13.1656 8.69324 13.1656H8.53205C8.44475 13.1656 8.38766 13.1387 8.3608 13.085C8.32722 13.0312 8.31043 12.9473 8.31043 12.8331C8.31043 12.7122 8.32722 12.6216 8.3608 12.5611C8.38766 12.5007 8.44475 12.4705 8.53205 12.4705H8.69324ZM12.1889 11.3925C12.1889 11.0433 12.1117 10.7612 11.9572 10.5463C11.8027 10.3247 11.5375 10.2139 11.1614 10.2139C10.4629 10.2139 10.1137 10.6202 10.1137 11.4328C10.1137 11.7754 10.2077 12.0339 10.3957 12.2085C10.5905 12.3831 10.839 12.4705 11.1412 12.4705C11.4837 12.4705 11.7423 12.3764 11.9169 12.1884C12.0982 12.0003 12.1889 11.7351 12.1889 11.3925Z" fill="currentColor"></path></svg>`;

const cartTomanIcon = document.getElementById("cartTomanIcon");
if (cartTomanIcon) cartTomanIcon.innerHTML = TOMAN_SVG;

function renderStars(rating) {
    const rounded = Math.min(5, Math.max(0, Math.round(Number(rating) || 5)));
    let html = "";
    for (let i = 1; i <= 5; i++) {
        html += i <= rounded
            ? '<i class="fa-solid fa-star" aria-hidden="true"></i>'
            : '<i class="fa-regular fa-star" aria-hidden="true"></i>';
    }
    return html;
}

function normalizeRating(rating) {
    const value = Number(rating);
    return Number.isFinite(value) && value > 0
        ? Math.min(5, Math.max(0, value))
        : 5;
}

function ratingLabel(rating) {
    const value = normalizeRating(rating);
    return `امتیاز ${value.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} از ۵`;
}

function showToast(message, type = "warning") {
    if (!message) return;

    let region = document.getElementById("toastRegion");

    if (!region) {
        region = document.createElement("div");
        region.id = "toastRegion";
        region.className = "toast-region";
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-atomic", "true");
        document.body.appendChild(region);
    }

    const toast = document.createElement("div");
    toast.className = `app-toast app-toast--${type}`;
    toast.setAttribute("role", "status");

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-circle-info";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = String(message);

    toast.append(icon, text);
    region.replaceChildren(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    window.setTimeout(() => {
        toast.classList.remove("show");
        window.setTimeout(() => toast.remove(), 220);
    }, 3200);
}

let lastModalTrigger = null;
let lastCartTrigger = null;

function syncBodyScrollLock() {
    const modalOpen = productModal?.classList.contains("active");
    const cartOpen = cartDrawer?.classList.contains("active");
    document.body.classList.toggle("no-scroll", Boolean(modalOpen || cartOpen));
}

function getFocusableElements(container) {
    if (!container) return [];

    return Array.from(
        container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    ).filter(element => !element.hasAttribute("hidden") && element.offsetParent !== null);
}

function trapFocus(container, event) {
    if (event.key !== "Tab" || !container) return;

    const focusable = getFocusableElements(container);

    if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function openModalDialog(triggerElement, focusSelector) {
    if (!productModal) return;

    const wasOpen = productModal.classList.contains("active");

    if (!wasOpen) {
        lastModalTrigger = triggerElement || document.activeElement;
    }

    productModal.classList.add("active");
    productModal.setAttribute("aria-hidden", "false");
    syncBodyScrollLock();

    requestAnimationFrame(() => {
        const dialog = productModal.querySelector(".product-modal");
        const preferred = focusSelector
            ? productModal.querySelector(focusSelector)
            : null;

        (preferred || dialog)?.focus();
    });
}

function resetModalContentScrolling() {
    if (modalContent) {
        modalContent.style.overflowY = "";
        modalContent.style.overflowX = "";
        modalContent.style.maxHeight = "";
        modalContent.style.webkitOverflowScrolling = "";
        modalContent.style.touchAction = "";
        modalContent.style.overscrollBehavior = "";
    }

    if (productModal) {
        productModal.style.overflow = "";
    }
}

function buildMenuCardHTML(product) {
    const available = product.availableNow !== false;
    const rating = product.rating || "5.0";
    const image = product.image || "assest/images/placeholder.webp";

    return `
        <article
            class="menu-card${available ? "" : " sold-out"}"
            data-id="${escapeAttr(product._id)}"
            data-category="${escapeAttr(product.category)}"
            data-name="${escapeAttr(product.name)}"
            data-price="${escapeAttr(product.price)}"
            data-rating="${escapeAttr(rating)}"
            data-description="${escapeAttr(product.description)}"
        >
            <div class="card-image">
                <img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}" loading="lazy">
                <button class="favorite" data-id="${escapeAttr(product._id)}" aria-label="افزودن به علاقه‌مندی">
                    <i class="fa-regular fa-heart"></i>
                </button>
                ${available ? "" : `
                <span class="sold-out-badge" style="position:absolute;top:10px;right:10px;background:#000;color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;white-space:nowrap;">
                    ناموجود
                </span>`}
            </div>

            <div class="card-body">
                <div class="card-title-row">
                    <h3 class="card-title">
                        <button
                            type="button"
                            class="card-title-link"
                            aria-label="مشاهده توضیحات ${escapeAttr(product.name)}"
                        >${escapeAttr(product.name)}</button>
                    </h3>
                    <span class="card-price">${formatPrice(product.price)}${TOMAN_SVG}</span>
                </div>

                <p class="card-description">${escapeAttr(product.description)}</p>

                <div class="card-bottom">
                    <span class="rating" aria-label="${escapeAttr(ratingLabel(rating))}" title="${escapeAttr(ratingLabel(rating))}">${renderStars(rating)}</span>

                    <div class="card-actions">
                        <div class="qty-stepper" data-id="${escapeAttr(product._id)}">
                            <button type="button" class="qty-btn qty-minus" aria-label="کم کردن">−</button>
                            <span class="qty-value">1</span>
                            <button type="button" class="qty-btn qty-plus" aria-label="زیاد کردن">+</button>
                        </div>

                        <button
                            class="add-btn"
                            data-id="${escapeAttr(product._id)}"
                            aria-label="افزودن به سبد"
                            ${available ? "" : "disabled style=\"opacity:.4;pointer-events:none;\""}
                        >
                            <span>افزودن به سبد خرید</span>
                            <i class="fa-solid fa-bag-shopping"></i>
                        </button>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderMenuFromProducts(products) {
    if (!menuGrid) return;

    if (!products.length) {
        menuGrid.innerHTML = "";
        if (noResult) noResult.style.display = "block";
        return;
    }

    const grouped = {};

    products.forEach(product => {
        const category = product.category || "other";
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(product);
    });

    const orderedCategories = [
        ...categoryOrder.filter(category => grouped[category]),
        ...Object.keys(grouped).filter(category => !categoryOrder.includes(category))
    ];

    menuGrid.innerHTML = orderedCategories.map(category => {
        const info = categoryInfo[category] || {
            title: category,
            english: category.toUpperCase(),
            icon: "fa-utensils"
        };

        const cardsHTML = grouped[category]
            .map(product => buildMenuCardHTML(product))
            .join("");

        return `
            <section class="menu-category-section" data-category="${escapeAttr(category)}" id="category-${escapeAttr(category)}">
                <div class="menu-category-heading">
                    <div class="category-heading-icon">
                        <i class="fa-solid ${info.icon}"></i>
                    </div>
                    <div class="category-heading-text">
                        <span>${escapeAttr(info.english)}</span>
                        <h2>${escapeAttr(info.title)}</h2>
                    </div>
                    <div class="category-heading-line"></div>
                </div>
                <div class="category-products">${cardsHTML}</div>
            </section>
        `;
    }).join("");
}

async function loadProductsFromAPI() {
    if (!menuGrid) return;

    menuGrid.innerHTML = `
        <div class="menu-loading" style="padding:60px 0;text-align:center;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:28px;"></i>
            <p style="margin-top:12px;">در حال بارگذاری منو...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/products`);

        if (!response.ok) {
            throw new Error("خطا در دریافت منو");
        }

        const products = await response.json();

        renderMenuFromProducts(products);

    } catch (error) {
        console.error(error);
        menuGrid.innerHTML = `
            <div class="menu-loading" style="padding:60px 0;text-align:center;">
                <p>دریافت منو با مشکل مواجه شد. لطفاً صفحه را رفرش کنید.</p>
            </div>
        `;
    } finally {
        initializeProducts();
        renderMenu();
        renderCart();
        renderFavorites();
    }
}

/* =========================================================
   PRODUCTS
========================================================= */

function getAllCards() {
    return Array.from(document.querySelectorAll(".menu-card"));
}

function getProductData(card) {
    const image = card.querySelector(".card-image img");

    return {
        id: card.dataset.id,
        name: card.dataset.name || "",
        category: card.dataset.category || "",
        price: Number(card.dataset.price) || 0,
        rating: Number(card.dataset.rating) || 0,
        description: card.dataset.description || "",
        image: image ? image.getAttribute("src") : ""
    };
}

function getProductById(id) {
    const card = document.querySelector(
        `.menu-card[data-id="${id}"]`
    );

    return card ? getProductData(card) : null;
}

function getValidCartItems() {
    return cart.filter(item => {
        const product = getProductById(item.id);
        return product !== null && product.available !== false;
    });
}

function formatPrice(price) {
    return Number(price).toLocaleString("fa-IR");
}

/* =========================================================
   STORAGE
========================================================= */

function saveCart() {
    localStorage.setItem("sideWalkCart", JSON.stringify(cart));
}

function saveFavorites() {
    localStorage.setItem(
        "sideWalkFavorites",
        JSON.stringify(favorites)
    );
}

/* =========================================================
   FAVORITES
========================================================= */

function isFavorite(id) {
    return favorites.includes(id);
}

function updateFavoriteButton(card) {
    const button = card.querySelector(".favorite");

    if (!button) return;

    const id = card.dataset.id;
    const icon = button.querySelector("i");
    const active = isFavorite(id);

    button.classList.toggle("active", active);

    if (icon) {
        icon.className = active
            ? "fa-solid fa-heart"
            : "fa-regular fa-heart";
    }
}

function toggleFavorite(id) {
    if (isFavorite(id)) {
        favorites = favorites.filter(
            favoriteId => favoriteId !== id
        );
    } else {
        favorites.push(id);
    }

    saveFavorites();

    const card = document.querySelector(
        `.menu-card[data-id="${id}"]`
    );

    if (card) {
        updateFavoriteButton(card);
    }

    renderFavorites();
}

/* =========================================================
   CART
========================================================= */

function addToCart(item, qty = 1) {
    const existing = cart.find(
        cartItem => cartItem.id === item.id
    );

    if (existing) {
        existing.quantity += qty;
    } else {
        cart.push({
            id: item.id,
            quantity: qty
        });
    }

    saveCart();
    renderCart();
    openCart();
}

function changeQuantity(id, change) {
    const item = cart.find(
        cartItem => cartItem.id === id
    );

    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        cart = cart.filter(
            cartItem => cartItem.id !== id
        );
    }

    saveCart();
    renderCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);

    saveCart();
    renderCart();
}

function renderCart() {
    if (!cartItems) return;

    cartItems.innerHTML = "";

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <div class="empty-icon">
                    <i class="fa-solid fa-bag-shopping"></i>
                </div>
                <h3>سبد شما خالیه</h3>
                <p>هنوز چیزی به سفارش اضافه نکردید.</p>
            </div>
        `;
    } else {
        cart.forEach(cartItem => {
            const product = getProductById(cartItem.id);

            if (!product) return;

            const element = document.createElement("div");
            element.className = "cart-item";

            element.innerHTML = `
                <img
                    src="${product.image}"
                    alt="${product.name}"
                >

                <div class="cart-item-info">
                    <h4>${product.name}</h4>

                    <span class="cart-item-price">
                        ${formatPrice(product.price)}
                        ${TOMAN_SVG}
                    </span>

                    <div class="quantity">
                        <button
                            data-id="${product.id}"
                            data-change="-1"
                            aria-label="کم کردن"
                            type="button"
                        >
                            <i class="fa-solid fa-minus"></i>
                        </button>

                        <span>${cartItem.quantity}</span>

                        <button
                            data-id="${product.id}"
                            data-change="1"
                            aria-label="زیاد کردن"
                            type="button"
                        >
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>

                    <button
                        class="remove-item"
                        data-id="${product.id}"
                        type="button"
                    >
                        حذف
                    </button>
                </div>
            `;

            element
                .querySelectorAll(".quantity button")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        changeQuantity(
                            button.dataset.id,
                            Number(button.dataset.change)
                        );
                    });
                });

            element
                .querySelector(".remove-item")
                .addEventListener("click", () => {
                    removeFromCart(product.id);
                });

            cartItems.appendChild(element);
        });
    }

    let totalItems = 0;
    let totalPrice = 0;

    cart.forEach(cartItem => {
        const product = getProductById(cartItem.id);

        if (!product) return;

        totalItems += cartItem.quantity;
        totalPrice += product.price * cartItem.quantity;
    });

    if (cartCount) {
        cartCount.textContent =
            totalItems.toLocaleString("fa-IR");
    }

    if (cartTotal) {
        cartTotal.textContent = formatPrice(totalPrice);
    }
}

/* =========================================================
   CART DRAWER
========================================================= */

function openCart() {
    lastCartTrigger = document.activeElement;

    if (cartDrawer) {
        cartDrawer.classList.add("active");
        cartDrawer.setAttribute("aria-hidden", "false");
    }

    if (drawerOverlay) {
        drawerOverlay.classList.add("active");
    }

    if (cartBtn) {
        cartBtn.setAttribute("aria-expanded", "true");
    }

    syncBodyScrollLock();

    requestAnimationFrame(() => {
        (closeCart || cartDrawer)?.focus?.();
    });
}

function closeCartDrawer({ restoreFocus = true } = {}) {
    const wasOpen = cartDrawer?.classList.contains("active");

    if (cartDrawer) {
        cartDrawer.classList.remove("active");
        cartDrawer.setAttribute("aria-hidden", "true");
    }

    if (drawerOverlay) {
        drawerOverlay.classList.remove("active");
    }

    if (cartBtn) {
        cartBtn.setAttribute("aria-expanded", "false");
    }

    syncBodyScrollLock();

    const triggerToRestore = lastCartTrigger;

    if (restoreFocus && wasOpen && triggerToRestore && document.contains(triggerToRestore)) {
        requestAnimationFrame(() => triggerToRestore.focus?.());
    }

    if (restoreFocus) lastCartTrigger = null;
}

if (cartBtn) {
    cartBtn.addEventListener("click", openCart);
}

if (closeCart) {
    closeCart.addEventListener("click", closeCartDrawer);
}

if (drawerOverlay) {
    drawerOverlay.addEventListener(
        "click",
        closeCartDrawer
    );
}

/* =========================================================
   PRODUCT MODAL
========================================================= */

function openProduct(item) {
    if (!modalContent || !productModal) return;

    let modalQty = 1;

    modalContent.innerHTML = `
        <img
            class="modal-image"
            src="${escapeAttr(item.image)}"
            alt="${escapeAttr(item.name)}"
        >

        <div class="modal-body">
            <h2 id="modalDialogTitle">${escapeAttr(item.name)}</h2>
            <div class="modal-rating" aria-label="${escapeAttr(ratingLabel(item.rating))}" title="${escapeAttr(ratingLabel(item.rating))}">${renderStars(item.rating || 5)}</div>
            <p>${escapeAttr(item.description)}</p>

            <div class="modal-price">
                ${formatPrice(item.price)}
                ${TOMAN_SVG}
            </div>

            <div class="modal-qty-row">
                <div class="qty-stepper" id="modalQtyStepper">
                    <button type="button" class="qty-btn qty-minus" aria-label="کم کردن">−</button>
                    <span class="qty-value" id="modalQtyValue">1</span>
                    <button type="button" class="qty-btn qty-plus" aria-label="زیاد کردن">+</button>
                </div>

                <button
                    class="modal-add-btn"
                    id="modalAdd"
                    type="button"
                >
                    <span>افزودن به سبد خرید</span>
                    <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    `;

    resetModalContentScrolling();
    openModalDialog(item.__triggerElement || document.activeElement, "#modalAdd");

    const modalQtyValue = document.getElementById("modalQtyValue");
    const modalQtyStepper = document.getElementById("modalQtyStepper");

    if (modalQtyStepper && modalQtyValue) {
        modalQtyStepper.querySelector(".qty-minus").addEventListener("click", () => {
            modalQty = Math.max(1, modalQty - 1);
            modalQtyValue.textContent = modalQty;
        });

        modalQtyStepper.querySelector(".qty-plus").addEventListener("click", () => {
            modalQty = Math.min(20, modalQty + 1);
            modalQtyValue.textContent = modalQty;
        });
    }

    const modalAdd = document.getElementById("modalAdd");

    if (modalAdd) {
        modalAdd.addEventListener("click", () => {
            addToCart(item, modalQty);
            closeProduct();
        });
    }
}

function closeProduct() {
    const wasOpen = productModal?.classList.contains("active");

    if (productModal) {
        productModal.classList.remove("active");
        productModal.setAttribute("aria-hidden", "true");
    }

    resetModalContentScrolling();
    stopTrackPolling();
    syncBodyScrollLock();

    const restoreTrigger = lastModalTrigger;

    if (wasOpen && restoreTrigger && document.contains(restoreTrigger)) {
        requestAnimationFrame(() => {
            if (restoreTrigger && document.contains(restoreTrigger)) {
                restoreTrigger.focus?.();
            }
        });
    }

    lastModalTrigger = null;
}

if (modalClose) {
    modalClose.addEventListener("click", closeProduct);
}

if (productModal) {
    productModal.addEventListener("click", event => {
        if (event.target === productModal) {
            closeProduct();
        }
    });
}

/* =========================================================
   PRODUCT CARD QUANTITY STEPPER (before adding to cart)
========================================================= */

function attachQtyStepper(card) {
    const id = card.dataset.id;
    const stepper = card.querySelector(".qty-stepper");

    if (!stepper) return;

    if (!cardQuantities.has(id)) {
        cardQuantities.set(id, 1);
    }

    const valueEl = stepper.querySelector(".qty-value");
    valueEl.textContent = cardQuantities.get(id);

    stepper.querySelector(".qty-minus").addEventListener("click", event => {
        event.stopPropagation();
        const current = Math.max(1, cardQuantities.get(id) - 1);
        cardQuantities.set(id, current);
        valueEl.textContent = current;
    });

    stepper.querySelector(".qty-plus").addEventListener("click", event => {
        event.stopPropagation();
        const current = Math.min(20, cardQuantities.get(id) + 1);
        cardQuantities.set(id, current);
        valueEl.textContent = current;
    });
}

/* =========================================================
   INITIALIZE PRODUCTS
========================================================= */

function initializeProducts() {
    const cards = getAllCards();

    cards.forEach(card => {
        const id = card.dataset.id;

        const favoriteButton =
            card.querySelector(".favorite");

        if (favoriteButton) {
            favoriteButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();
                    toggleFavorite(id);
                }
            );
        }

        attachQtyStepper(card);

        const addButton =
            card.querySelector(".add-btn");

        if (addButton) {
            addButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    const product =
                        getProductById(id);

                    if (product) {
                        const qty = cardQuantities.get(id) || 1;
                        addToCart(product, qty);

                        cardQuantities.set(id, 1);
                        const valueEl = card.querySelector(".qty-value");
                        if (valueEl) valueEl.textContent = "1";
                    }
                }
            );
        }

        const titleButton = card.querySelector(".card-title-link");

        const openCardProduct = triggerElement => {
            const product = getProductById(id);
            if (!product) return;
            product.__triggerElement = triggerElement || titleButton || document.activeElement;
            openProduct(product);
            delete product.__triggerElement;
        };

        card.addEventListener("click", event => {
            if (event.target.closest("button, .qty-stepper")) return;
            openCardProduct(titleButton);
        });

        if (titleButton) {
            titleButton.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openCardProduct(titleButton);
            });
        }

        updateFavoriteButton(card);
    });
}

/* =========================================================
   CATEGORY FILTER
========================================================= */

function setActiveCategory(category) {
    currentCategory = category;

    const buttons =
        document.querySelectorAll(".category");

    buttons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.category === category
        );
    });
}

/* =========================================================
   RENDER MENU
========================================================= */

function renderMenu() {
    const cards = getAllCards();

    if (!cards.length) return;

    if (noResult) {
        noResult.style.display = "none";
    }

    cards.forEach(card => {
        const category = card.dataset.category;

        const name =
            (card.dataset.name || "").toLowerCase();

        const description =
            (card.dataset.description || "").toLowerCase();

        let visible = true;

        if (searchTerm) {
            visible =
                name.includes(searchTerm) ||
                description.includes(searchTerm);
        } else if (currentCategory !== "all") {
            visible =
                category === currentCategory;
        }

        card.style.display = visible ? "" : "none";
    });

    const sections =
        document.querySelectorAll(
            ".menu-category-section"
        );

    sections.forEach(section => {
        const visibleCards =
            Array.from(
                section.querySelectorAll(".menu-card")
            ).filter(
                card => card.style.display !== "none"
            );

        section.style.display =
            visibleCards.length ? "" : "none";
    });

    const visibleCount =
        cards.filter(
            card => card.style.display !== "none"
        ).length;

    if (visibleCount === 0 && noResult) {
        noResult.style.display = "block";
    }

    if (
        currentCategory === "all" &&
        !searchTerm
    ) {
        setupSmartCategoryScroll();
    } else if (smartCategoryObserver) {
        smartCategoryObserver.disconnect();
        smartCategoryObserver = null;
    }
}

/* =========================================================
   SMART CATEGORY SCROLL
========================================================= */

let smartCategoryObserver = null;

function setupSmartCategoryScroll() {
    if (smartCategoryObserver) {
        smartCategoryObserver.disconnect();
        smartCategoryObserver = null;
    }

    if (
        currentCategory !== "all" ||
        searchTerm
    ) {
        return;
    }

    const sections =
        document.querySelectorAll(
            ".menu-category-section"
        );

    if (!sections.length) return;

    smartCategoryObserver =
        new IntersectionObserver(
            entries => {
                let bestSection = null;
                let bestRatio = 0;

                entries.forEach(entry => {
                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio > bestRatio
                    ) {
                        bestRatio =
                            entry.intersectionRatio;

                        bestSection =
                            entry.target;
                    }
                });

                if (!bestSection) return;

                const category =
                    bestSection.dataset.category;

                if (category) {
                    setActiveCategory(category);
                    scrollActiveCategoryIntoView();
                }
            },
            {
                root: null,
                rootMargin:
                    "-30% 0px -55% 0px",
                threshold: [
                    0.1,
                    0.2,
                    0.3,
                    0.4,
                    0.5,
                    0.6,
                    0.7
                ]
            }
        );

    sections.forEach(section => {
        smartCategoryObserver.observe(section);
    });
}

/* =========================================================
   SCROLL ACTIVE CATEGORY
========================================================= */

function scrollActiveCategoryIntoView() {
    if (window.innerWidth > 768) return;

    const activeButton =
        document.querySelector(".category");

    const container =
        document.querySelector(".categories");

    if (!container) return;

    const active =
        document.querySelector(".category.active");

    if (!active) return;

    const containerRect =
        container.getBoundingClientRect();

    const buttonRect =
        active.getBoundingClientRect();

    const outside =
        buttonRect.left < containerRect.left ||
        buttonRect.right > containerRect.right;

    if (outside) {
        active.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
        });
    }
}

/* =========================================================
   CATEGORY BUTTONS
========================================================= */

let categoryWasDragged = false;

document.addEventListener("click", event => {
    const button =
        event.target.closest(".category");

    if (!button) return;

    if (categoryWasDragged) {
        event.preventDefault();
        event.stopPropagation();
        categoryWasDragged = false;
        return;
    }

    const category = button.dataset.category;

    if (!category) return;

    event.preventDefault();

    setActiveCategory(category);
    renderMenu();
});

/* =========================================================
   MOBILE CATEGORY DRAG / SWIPE
========================================================= */

function enableCategoryDrag() {
    const categoryContainer =
        document.querySelector(".categories");

    if (!categoryContainer) return;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let moved = false;

    categoryContainer.addEventListener(
        "pointerdown",
        event => {
            if (
                event.pointerType !== "touch" &&
                event.pointerType !== "pen"
            ) {
                return;
            }

            isDragging = true;
            moved = false;
            categoryWasDragged = false;

            startX = event.clientX;
            startScrollLeft =
                categoryContainer.scrollLeft;

            categoryContainer.classList.add(
                "dragging"
            );

            try {
                categoryContainer.setPointerCapture(
                    event.pointerId
                );
            } catch (_) {}
        },
        { passive: true }
    );

    categoryContainer.addEventListener(
        "pointermove",
        event => {
            if (!isDragging) return;

            const distance =
                event.clientX - startX;

            if (Math.abs(distance) > 8) {
                moved = true;
                categoryWasDragged = true;
            }

            categoryContainer.scrollLeft =
                startScrollLeft - distance;
        },
        { passive: true }
    );

    function stopDragging(event) {
        if (!isDragging) return;

        isDragging = false;

        categoryContainer.classList.remove(
            "dragging"
        );

        try {
            categoryContainer.releasePointerCapture(
                event.pointerId
            );
        } catch (_) {}

        if (moved) {
            setTimeout(() => {
                categoryWasDragged = false;
            }, 150);
        }
    }

    categoryContainer.addEventListener(
        "pointerup",
        stopDragging
    );

    categoryContainer.addEventListener(
        "pointercancel",
        stopDragging
    );
}

enableCategoryDrag();

/* =========================================================
   SEARCH
========================================================= */

if (searchInput) {
    searchInput.addEventListener(
        "input",
        event => {
            searchTerm =
                event.target.value
                    .trim()
                    .toLowerCase();

            renderMenu();
        }
    );
}

if (clearSearch) {
    clearSearch.addEventListener(
        "click",
        () => {
            if (searchInput) {
                searchInput.value = "";
                searchInput.focus();
            }

            searchTerm = "";
            renderMenu();
        }
    );
}

/* =========================================================
   FAVORITES SECTION
========================================================= */

function createFavoritesSection() {
    if (
        document.getElementById(
            "favoritesSection"
        )
    ) {
        return;
    }

    const section =
        document.createElement("section");

    section.id = "favoritesSection";
    section.className = "favorites-section";

    section.innerHTML = `
        <div class="favorites-heading">
            <div>
                <span>YOUR FAVORITES</span>
                <h2>علاقه‌مندی‌ها</h2>
            </div>
        </div>

        <div
            id="favoritesGrid"
            class="favorites-grid"
        ></div>
    `;

    const menu =
        document.getElementById("menu");

    if (menu) {
        menu.appendChild(section);
    }

    renderFavorites();
}

function renderFavorites() {
    const section =
        document.getElementById(
            "favoritesSection"
        );

    if (!section) return;

    const grid =
        document.getElementById(
            "favoritesGrid"
        );

    if (!grid) return;

    grid.innerHTML = "";

    const favoriteCards =
        getAllCards().filter(card =>
            isFavorite(
                card.dataset.id
            )
        );

    if (favoriteCards.length === 0) {
        grid.innerHTML = `
            <div class="empty-favorites">
                <i class="fa-regular fa-heart"></i>
                <h3>هنوز چیزی ذخیره نکردی</h3>
                <p>
                    روی قلب محصولات بزن تا اینجا
                    نمایش داده بشن ❤️
                </p>
            </div>
        `;

        return;
    }

    favoriteCards.forEach(card => {
        const product =
            getProductData(card);

        const favoriteCard =
            document.createElement("div");

        favoriteCard.className =
            "favorite-card";

        favoriteCard.innerHTML = `
            <button
                class="remove-favorite"
                data-id="${product.id}"
                aria-label="حذف از علاقه‌مندی‌ها"
                title="حذف از علاقه‌مندی‌ها"
                type="button"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

            <img
                src="${product.image}"
                alt="${product.name}"
            >

            <div class="favorite-card-info">
                <h3>
                    <button
                        type="button"
                        class="favorite-title-link"
                        aria-label="مشاهده توضیحات ${escapeAttr(product.name)}"
                    >${escapeAttr(product.name)}</button>
                </h3>

                <div class="favorite-meta">
                    <span class="favorite-price">
                        ${formatPrice(product.price)}
                        ${TOMAN_SVG}
                    </span>

                    <span class="rating favorite-rating" aria-label="${escapeAttr(ratingLabel(product.rating))}" title="${escapeAttr(ratingLabel(product.rating))}">
                        ${renderStars(product.rating || 5)}
                    </span>
                </div>

                <button
                    class="favorite-add-cart"
                    data-id="${product.id}"
                    type="button"
                >
                    <span>افزودن به سبد خرید</span>
                    <i class="fa-solid fa-bag-shopping"></i>
                </button>
            </div>
        `;

        const favoriteTitleButton =
            favoriteCard.querySelector(".favorite-title-link");

        const openFavoriteProduct = () => {
            product.__triggerElement = favoriteTitleButton || document.activeElement;
            openProduct(product);
            delete product.__triggerElement;
        };

        favoriteCard.addEventListener("click", event => {
            if (event.target.closest("button")) return;
            openFavoriteProduct();
        });

        if (favoriteTitleButton) {
            favoriteTitleButton.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openFavoriteProduct();
            });
        }

        favoriteCard
            .querySelector(
                ".favorite-add-cart"
            )
            .addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();
                    addToCart(product);
                }
            );

        favoriteCard
            .querySelector(
                ".remove-favorite"
            )
            .addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    favorites =
                        favorites.filter(
                            favoriteId =>
                                favoriteId !==
                                product.id
                        );

                    saveFavorites();

                    const originalCard =
                        document.querySelector(
                            `.menu-card[data-id="${product.id}"]`
                        );

                    if (originalCard) {
                        updateFavoriteButton(
                            originalCard
                        );
                    }

                    renderFavorites();
                }
            );

        grid.appendChild(favoriteCard);
    });
}

createFavoritesSection();

const favoritesSection =
    document.getElementById(
        "favoritesSection"
    );

const headerActions =
    document.querySelector(
        ".header-actions"
    );

if (
    headerActions &&
    favoritesSection
) {
    const favoritesButton =
        document.createElement("button");

    favoritesButton.className =
        "favorites-nav-button";

    favoritesButton.type = "button";

    favoritesButton.setAttribute("aria-controls", "favoritesSection");
    favoritesButton.setAttribute("aria-expanded", "false");
    favoritesButton.setAttribute("aria-label", "نمایش علاقه‌مندی‌ها");

    favoritesSection.setAttribute("aria-hidden", "true");

    favoritesButton.innerHTML = `
        <i class="fa-solid fa-heart" aria-hidden="true"></i>
        <span>علاقه‌مندی‌ها</span>
    `;

    headerActions.prepend(
        favoritesButton
    );

    favoritesButton.addEventListener(
        "click",
        () => {
            favoritesSection.classList.toggle("show");

            const isOpen = favoritesSection.classList.contains("show");
            favoritesButton.setAttribute("aria-expanded", String(isOpen));
            favoritesButton.setAttribute(
                "aria-label",
                isOpen ? "بستن علاقه‌مندی‌ها" : "نمایش علاقه‌مندی‌ها"
            );
            favoritesSection.setAttribute("aria-hidden", String(!isOpen));

            if (isOpen) {
                renderFavorites();

                favoritesSection.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                    block: "start"
                });
            }
        }
    );
}

/* =========================================================
   LEAFLET LOADER
   No HTML modification is required.
========================================================= */

function loadLeaflet() {
    return new Promise((resolve, reject) => {
        if (window.L) {
            resolve();
            return;
        }

        const existingScript =
            document.querySelector(
                'script[data-sidewalk-leaflet="true"]'
            );

        if (existingScript) {
            existingScript.addEventListener(
                "load",
                () => resolve(),
                { once: true }
            );

            existingScript.addEventListener(
                "error",
                () =>
                    reject(
                        new Error(
                            "Leaflet could not be loaded."
                        )
                    ),
                { once: true }
            );

            return;
        }

        const css =
            document.createElement("link");

        css.rel = "stylesheet";
        css.href =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        css.dataset.sidewalkLeaflet = "true";

        document.head.appendChild(css);

        const script =
            document.createElement("script");

        script.src =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

        script.async = true;
        script.dataset.sidewalkLeaflet = "true";

        script.onload = () => resolve();

        script.onerror = () =>
            reject(
                new Error(
                    "Leaflet could not be loaded."
                )
            );

        document.head.appendChild(script);
    });
}

/* =========================================================
   LOCATION / MAP CLEANUP
========================================================= */

function destroyDeliveryMap() {
    if (deliveryMap) {
        try {
            deliveryMap.remove();
        } catch (_) {}
    }

    deliveryMap = null;
    deliveryMarker = null;
    locationAccuracyCircle = null;
}

/* =========================================================
   LOCATION BUTTON
========================================================= */

function loadDeliveryMap() {
    const locationBtn =
        document.getElementById(
            "locationBtn"
        );

    if (!locationBtn) return;

    locationBtn.addEventListener(
        "click",
        getUserLocation
    );
}

/* =========================================================
   GET USER LOCATION
========================================================= */

function getUserLocation() {
    const locationBtn =
        document.getElementById(
            "locationBtn"
        );

    if (!navigator.geolocation) {
        showToast(
            "مرورگر شما از دریافت موقعیت مکانی پشتیبانی نمی‌کند."
        );
        return;
    }

    if (locationBtn) {
        locationBtn.disabled = true;
        locationBtn.textContent =
            "در حال دریافت موقعیت...";
    }

    // IMPORTANT: this function intentionally uses ONLY the browser/device
    // Geolocation API. It never calls an IP geolocation service.
    navigator.geolocation.getCurrentPosition(
        position => {
            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;

            const accuracy =
                position.coords.accuracy;

            // GPS-only: never use IP or any network geolocation fallback.
            // Only accept actual browser/device geolocation inside Kerman.
            if (!isInsideKerman(lat, lng)) {
                selectedLocation = null;
                selectedAddress = "";

                if (locationBtn) {
                    locationBtn.disabled = false;
                    locationBtn.textContent =
                        "📍 دریافت لوکیشن";
                }

                showToast(
                    "این فروشگاه فقط در شهر کرمان فعال است. موقعیت دریافت‌شده خارج از محدوده کرمان است. نقشه را روی کرمان باز کنید و موقعیت داخل کرمان را انتخاب کنید."
                );

                showDeliveryMap(
                    KERMAN_CENTER.lat,
                    KERMAN_CENTER.lng,
                    0
                );
                return;
            }

            selectedLocation = {
                lat,
                lng
            };

            selectedAddress =
                `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

            showDeliveryMap(
                lat,
                lng,
                accuracy
            );

            if (locationBtn) {
                locationBtn.disabled = false;
                locationBtn.textContent =
                    "📍 موقعیت دریافت شد";
            }
        },
        error => {
            console.error(
                "Geolocation error:",
                error
            );

            if (locationBtn) {
                locationBtn.disabled = false;
                locationBtn.textContent =
                    "📍 دریافت لوکیشن";
            }

            switch (error.code) {
                case error.PERMISSION_DENIED:
                    showToast(
                        "دسترسی به موقعیت مکانی توسط مرورگر رد شد. اجازه Location را برای سایت فعال کنید."
                    );
                    break;

                case error.POSITION_UNAVAILABLE:
                    showToast(
                        "موقعیت مکانی شما در دسترس نیست. GPS یا سرویس Location دستگاه را بررسی کنید."
                    );
                    break;

                case error.TIMEOUT:
                    showToast(
                        "زمان دریافت موقعیت تمام شد. دوباره تلاش کنید."
                    );
                    break;

                default:
                    showToast(
                        "خطایی در دریافت موقعیت رخ داد."
                    );
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

/* =========================================================
   SHOW DELIVERY MAP
========================================================= */

async function showDeliveryMap(
    lat,
    lng,
    accuracy = 0
) {
    const mapElement =
        document.getElementById("map");

    if (!mapElement) return;

    try {
        await loadLeaflet();
    } catch (error) {
        console.error(error);

        showToast(
            "نقشه بارگذاری نشد. اتصال اینترنت را بررسی کنید."
        );

        return;
    }

    // Important: #map may have been recreated.
    // Remove old Leaflet instance before creating a new one.
    destroyDeliveryMap();

    const safeLat = isInsideKerman(lat, lng) ? lat : KERMAN_CENTER.lat;
    const safeLng = isInsideKerman(lat, lng) ? lng : KERMAN_CENTER.lng;

    deliveryMap =
        L.map(mapElement, {
            center: [safeLat, safeLng],
            zoom: 14,
            zoomControl: true
        });

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }
    ).addTo(deliveryMap);

    // Keep the selectable map area focused on Kerman.
    const kermanBounds = L.latLngBounds(
        [30.15, 56.90],
        [30.42, 57.27]
    );
    deliveryMap.setMaxBounds(kermanBounds);
    deliveryMap.on("drag", () => {
        deliveryMap.panInsideBounds(kermanBounds, { animate: false });
    });

    deliveryMarker =
        L.marker([safeLat, safeLng], {
            draggable: true
        }).addTo(deliveryMap);

    deliveryMarker.bindPopup(
        "موقعیت تحویل سفارش"
    ).openPopup();

    updateAccuracyCircle(
        safeLat,
        safeLng,
        isInsideKerman(lat, lng) ? accuracy : 0
    );

    deliveryMarker.on(
        "dragend",
        async () => {
            const position =
                deliveryMarker.getLatLng();

            if (!isInsideKerman(position.lat, position.lng)) {
                deliveryMarker.setLatLng([
                    KERMAN_CENTER.lat,
                    KERMAN_CENTER.lng
                ]);
                deliveryMap.setView(
                    [KERMAN_CENTER.lat, KERMAN_CENTER.lng],
                    14
                );
                selectedLocation = null;
                selectedAddress = "";
                showToast("لطفاً موقعیت را داخل شهر کرمان انتخاب کنید.");
                return;
            }

            const newLat =
                position.lat;

            const newLng =
                position.lng;

            selectedLocation = {
                lat: newLat,
                lng: newLng,
                source: "map"
            };

            updateAccuracyCircle(
                newLat,
                newLng,
                0
            );

            await updateLocationAddress(
                newLat,
                newLng
            );
        }
    );

    createLocationConfirmButton();

    await updateLocationAddress(
        lat,
        lng
    );

    setTimeout(() => {
        if (deliveryMap) {
            deliveryMap.invalidateSize();
        }
    }, 150);
}

/* =========================================================
   UPDATE MARKER
========================================================= */

function updateDeliveryMarker(
    lat,
    lng
) {
    if (!deliveryMap) return;

    if (deliveryMarker) {
        deliveryMarker.setLatLng([
            lat,
            lng
        ]);
    } else {
        deliveryMarker =
            L.marker([lat, lng], {
                draggable: true
            }).addTo(deliveryMap);
    }

    deliveryMap.setView(
        [lat, lng],
        17
    );
}

/* =========================================================
   ACCURACY CIRCLE
========================================================= */

function updateAccuracyCircle(
    lat,
    lng,
    accuracy
) {
    if (!deliveryMap || !window.L) {
        return;
    }

    if (locationAccuracyCircle) {
        locationAccuracyCircle.remove();
    }

    if (
        Number.isFinite(accuracy) &&
        accuracy > 0
    ) {
        locationAccuracyCircle =
            L.circle(
                [lat, lng],
                {
                    radius: accuracy
                }
            ).addTo(deliveryMap);
    }
}

/* =========================================================
   REVERSE GEOCODING
========================================================= */

async function reverseGeocode(
    lat,
    lng
) {
    const url =
        "https://nominatim.openstreetmap.org/reverse" +
        `?format=jsonv2&lat=${encodeURIComponent(lat)}` +
        `&lon=${encodeURIComponent(lng)}` +
        "&accept-language=fa";

    try {
        const response =
            await fetch(url, {
                headers: {
                    Accept:
                        "application/json"
                }
            });

        if (!response.ok) {
            throw new Error(
                `Reverse geocoding failed: ${response.status}`
            );
        }

        const data =
            await response.json();

        return (
            data.display_name ||
            `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        );
    } catch (error) {
        console.warn(
            "Reverse geocoding error:",
            error
        );

        return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}

/* =========================================================
   UPDATE LOCATION ADDRESS
========================================================= */

async function updateLocationAddress(
    lat,
    lng
) {
    const addressElement =
        document.getElementById(
            "selectedAddress"
        );

    if (addressElement) {
        addressElement.textContent =
            "در حال دریافت آدرس...";
    }

    const address =
        await reverseGeocode(
            lat,
            lng
        );

    selectedAddress = address;

    if (addressElement) {
        addressElement.textContent =
            address;
    }
}

/* =========================================================
   LOCATION CONFIRM BUTTON
========================================================= */

function createLocationConfirmButton() {
    const deliveryInfo =
        document.getElementById(
            "deliveryInfo"
        );

    if (!deliveryInfo) return;

    let confirmButton =
        document.getElementById(
            "confirmLocationBtn"
        );

    if (!confirmButton) {
        confirmButton =
            document.createElement(
                "button"
            );

        confirmButton.id =
            "confirmLocationBtn";

        confirmButton.type =
            "button";

        confirmButton.className =
            "checkout-btn";

        confirmButton.textContent =
            "تأیید موقعیت";

        const map =
            document.getElementById("map");

        if (map) {
            map.insertAdjacentElement(
                "afterend",
                confirmButton
            );
        }
    }

    confirmButton.onclick =
        confirmLocation;
}

/* =========================================================
   CONFIRM LOCATION
========================================================= */

function confirmLocation() {
    if (!selectedLocation) {
        showToast(
            "ابتدا موقعیت خود را روی نقشه مشخص کنید."
        );
        return;
    }

    const deliveryInfo =
        document.getElementById(
            "deliveryInfo"
        );

    if (!deliveryInfo) return;

    destroyDeliveryMap();

    deliveryInfo.innerHTML = `
        <div class="selected-location-box">
            <strong>📍 موقعیت تحویل تأیید شد</strong>

            <p id="confirmedAddress">
                ${selectedAddress || "موقعیت GPS انتخاب شده است."}
            </p>

            <button
                id="changeLocationBtn"
                type="button"
            >
                تغییر موقعیت
            </button>
        </div>
    `;

    const changeButton =
        document.getElementById(
            "changeLocationBtn"
        );

    if (changeButton) {
        changeButton.addEventListener(
            "click",
            showLocationSelector
        );
    }

    enableCheckoutScrolling();
}

/* =========================================================
   CHANGE LOCATION
========================================================= */

function showLocationSelector() {
    const deliveryInfo =
        document.getElementById(
            "deliveryInfo"
        );

    if (!deliveryInfo) return;

    destroyDeliveryMap();

    deliveryInfo.innerHTML = `
        <button
            id="locationBtn"
            type="button"
        >
            📍 ${selectedLocation
                ? "تغییر / بررسی موقعیت"
                : "دریافت لوکیشن"}
        </button>

        <div
            id="map"
            style="width:100%;height:320px;"
        ></div>

        <div
            id="selectedAddress"
            class="selected-address"
        >
            ${
                selectedAddress ||
                "بعد از دریافت موقعیت، آدرس اینجا نمایش داده می‌شود."
            }
        </div>
    `;

    loadDeliveryMap();
    enableCheckoutScrolling();

    // If a previous location exists, immediately show it.
    if (selectedLocation) {
        showDeliveryMap(
            selectedLocation.lat,
            selectedLocation.lng,
            0
        );
    }
}

/* =========================================================
   CHECKOUT
========================================================= */

const checkoutButton =
    document.getElementById(
        "checkoutBtn"
    );

if (checkoutButton) {
    checkoutButton.addEventListener(
        "click",
        () => {
            const validItems = getValidCartItems();

            if (validItems.length === 0) {
                cart = validItems;
                saveCart();
                renderCart();
                showToast(
                    "لطفاً ابتدا یک محصول به سبد سفارش اضافه کنید."
                );
                return;
            }

            openCheckout();
        }
    );
}

function enableCheckoutScrolling() {
    if (!modalContent) return;

    // The page behind the checkout stays locked, but the checkout itself
    // must remain independently scrollable (especially on mobile).
    modalContent.style.overflowY = "auto";
    modalContent.style.overflowX = "hidden";
    modalContent.style.maxHeight = "calc(100vh - 32px)";
    modalContent.style.webkitOverflowScrolling = "touch";
    modalContent.style.touchAction = "pan-y";
    modalContent.style.overscrollBehavior = "contain";

    if (productModal) {
        productModal.style.overflow = "hidden";
    }
}

function openCheckout() {
    const validItems = getValidCartItems();

    if (validItems.length === 0) {
        cart = validItems;
        saveCart();
        renderCart();
        showToast("لطفاً ابتدا یک محصول به سبد سفارش اضافه کنید.");
        return;
    }

    closeCartDrawer({ restoreFocus: false });
    const total =
        cart.reduce(
            (sum, cartItem) => {
                const product =
                    getProductById(
                        cartItem.id
                    );

                if (!product) return sum;

                return (
                    sum +
                    product.price *
                    cartItem.quantity
                );
            },
            0
        );

    // Reset location state for a new checkout.
    selectedDeliveryMethod =
        "restaurant";

    selectedLocation = null;
    selectedAddress = "";
    selectedPickupEta = "";

    destroyDeliveryMap();

    modalContent.innerHTML = `
        <div class="checkout-page">

            <div class="checkout-title">
                <span>SIDE WALK</span>
                <h2 id="modalDialogTitle">ثبت سفارش</h2>
            </div>

            <div class="checkout-form">

                <label for="customerName">
                    نام شما
                </label>

                <input
                    id="customerName"
                    type="text"
                    placeholder="مثلاً امیر"
                    autocomplete="name"
                    required
                >

                <div id="tableBox">
                    <label for="tableNumber">
                        شماره میز
                    </label>

                    <input
                        id="tableNumber"
                        type="text"
                        placeholder="مثلاً ۱۲"
                    >
                </div>

                <label for="customerPhone">
                    شماره موبایل
                </label>

                <input
                    id="customerPhone"
                    type="tel"
                    placeholder="09xxxxxxxxx"
                    autocomplete="tel"
                    required
                >

                <div class="delivery-method">

                    <label for="deliveryMethod">
                        روش دریافت سفارش
                    </label>

                    <select id="deliveryMethod">
                        <option value="restaurant">
                            🍽️ صرف در رستوران
                        </option>

                        <option value="delivery">
                            🛵 ارسال با پیک
                        </option>

                        <option value="pickup">
                            🛍️ دریافت حضوری
                        </option>
                    </select>

                    <div id="deliveryInfo"></div>

                </div>

                <div class="checkout-total">
                    <span>مبلغ سفارش</span>

                    <strong>
                        ${formatPrice(total)}
                        ${TOMAN_SVG}
                    </strong>
                </div>

                <button
                    class="checkout-btn"
                    id="payButton"
                    type="button"
                >
                    ثبت سفارش
                    <i class="fa-solid fa-credit-card"></i>
                </button>

            </div>
        </div>
    `;

    openModalDialog(cartBtn || document.activeElement, "#customerName");

    // Keep background locked while allowing the checkout form itself to scroll.
    enableCheckoutScrolling();

    const deliverySelect =
        document.getElementById(
            "deliveryMethod"
        );

    const tableBox =
        document.getElementById(
            "tableBox"
        );

    // Table number came from a table QR code — prefill it and let the
    // customer know it was auto-detected instead of typed in.
    if (qrTableNumber) {
        const tableInputEl =
            document.getElementById("tableNumber");

        if (tableInputEl) {
            tableInputEl.value = qrTableNumber;
            tableInputEl.readOnly = true;
            tableInputEl.setAttribute(
                "title",
                "شماره میز از QR کد شناسایی شد"
            );
        }

        if (tableBox) {
            tableBox.insertAdjacentHTML(
                "beforeend",
                `<small class="qr-table-note">📱 شماره میز از QR کد میز خوانده شد</small>`
            );
        }
    }

    if (deliverySelect) {
        deliverySelect.value =
            selectedDeliveryMethod;

        deliverySelect.addEventListener(
            "change",
            () => {
                selectedDeliveryMethod =
                    deliverySelect.value;

                const deliveryInfo =
                    document.getElementById(
                        "deliveryInfo"
                    );

                if (!deliveryInfo) return;

                destroyDeliveryMap();

                if (
                    selectedDeliveryMethod ===
                    "restaurant"
                ) {
                    if (tableBox) {
                        tableBox.style.display =
                            "block";
                    }

                    selectedLocation = null;
                    selectedAddress = "";
                    selectedPickupEta = "";

                    deliveryInfo.innerHTML =
                        "";
                }

                if (
                    selectedDeliveryMethod ===
                    "delivery"
                ) {
                    if (tableBox) {
                        tableBox.style.display =
                            "none";
                    }

                    selectedLocation = null;
                    selectedAddress = "";
                    selectedPickupEta = "";

                    deliveryInfo.innerHTML = `
                        <button
                            id="locationBtn"
                            type="button"
                        >
                            📍 دریافت لوکیشن
                        </button>

                        <div
                            id="map"
                            style="width:100%;height:320px;"
                        ></div>

                        <div
                            id="selectedAddress"
                            class="selected-address"
                        >
                            بعد از دریافت موقعیت،
                            آدرس اینجا نمایش داده می‌شود.
                        </div>
                    `;

                    loadDeliveryMap();
                    enableCheckoutScrolling();
                }

                if (
                    selectedDeliveryMethod ===
                    "pickup"
                ) {
                    if (tableBox) {
                        tableBox.style.display =
                            "none";
                    }

                    selectedLocation = null;
                    selectedAddress = "";
                    selectedPickupEta = "";

                    deliveryInfo.innerHTML = `
                        <p>
                            سفارش شما آماده تحویل حضوری خواهد بود.
                        </p>

                        <label for="pickupEta">
                            چند دقیقه دیگر در رستوران هستید؟
                        </label>

                        <input
                            id="pickupEta"
                            type="number"
                            min="1"
                            placeholder="مثلاً ۱۵"
                        >
                    `;

                    const pickupEtaInput =
                        document.getElementById(
                            "pickupEta"
                        );

                    if (pickupEtaInput) {
                        pickupEtaInput.addEventListener(
                            "input",
                            () => {
                                selectedPickupEta =
                                    pickupEtaInput.value.trim();
                            }
                        );
                    }
                }
            }
        );
    }

    const payButton =
        document.getElementById(
            "payButton"
        );

    if (payButton) {
        payButton.addEventListener(
            "click",
            submitOrder
        );
    }
}

/* =========================================================
   PROCESS ORDER
========================================================= */

async function submitOrder() {
    const nameInput =
        document.getElementById(
            "customerName"
        );

    const phoneInput =
        document.getElementById(
            "customerPhone"
        );

    const tableInput =
        document.getElementById(
            "tableNumber"
        );

    if (!nameInput || !phoneInput) {
        return;
    }

    const name =
        nameInput.value.trim();

    const phone =
        phoneInput.value.trim();

    const table =
        tableInput
            ? tableInput.value.trim()
            : "";

    if (!name) {
        showToast(
            "لطفاً نام را وارد کنید."
        );
        return;
    }

    if (!phone) {
        showToast(
            "لطفاً شماره موبایل را وارد کنید."
        );
        return;
    }

    if (
        selectedDeliveryMethod ===
        "restaurant" &&
        !table
    ) {
        showToast(
            "لطفاً شماره میز را وارد کنید."
        );
        return;
    }

    if (
        selectedDeliveryMethod ===
        "delivery"
    ) {
        if (!selectedLocation) {
            showToast(
                "لطفاً ابتدا لوکیشن خود را دریافت و تأیید کنید."
            );
            return;
        }

        if (!selectedAddress) {
            showToast(
                "آدرس موقعیت هنوز آماده نیست. چند لحظه صبر کنید و دوباره تلاش کنید."
            );
            return;
        }
    }

    if (
        selectedDeliveryMethod ===
        "pickup" &&
        (!selectedPickupEta ||
            Number(selectedPickupEta) <= 0)
    ) {
        showToast(
            "لطفاً زمان تقریبی رسیدن خود به رستوران را وارد کنید."
        );
        return;
    }

    const items =
        cart
            .map(cartItem => {
                const product =
                    getProductById(
                        cartItem.id
                    );

                if (!product) return null;

                return {
                    productId:
                        product.id,
                    name:
                        product.name,
                    price:
                        Number(
                            product.price
                        ),
                    quantity:
                        Number(
                            cartItem.quantity
                        )
                };
            })
            .filter(Boolean);

    if (!items.length) {
        showToast(
            "سبد سفارش خالی است."
        );
        return;
    }

    const payButton =
        document.getElementById(
            "payButton"
        );

    if (payButton) {
        payButton.disabled = true;
        payButton.innerHTML =
            'در حال ثبت سفارش... <i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const orderPayload = {
            customerName:
                name,

            tableNumber:
                selectedDeliveryMethod ===
                "restaurant"
                    ? table
                    : "",

            customerPhone:
                phone,

            deliveryMethod:
                selectedDeliveryMethod,

            address:
                selectedAddress,

            location:
                selectedLocation,

            pickupEta:
                selectedDeliveryMethod ===
                "pickup"
                    ? selectedPickupEta
                    : "",

            items
        };

        const response =
            await fetch(
                `${API_BASE_URL}/orders`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(orderPayload)
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "ثبت سفارش ناموفق بود."
            );
        }

        const orderCode =
            data?.order?.orderCode ||
            data?.orderCode ||
            "—";

        saveLastOrder(orderCode);
        saveLastPhone(phone);

        cart = [];
        saveCart();
        renderCart();

        destroyDeliveryMap();

        modalContent.innerHTML = `
            <div class="checkout-page">

                <div class="checkout-title">
                    <span>SIDE WALK</span>
                    <h2 id="modalDialogTitle">
                        سفارش ثبت شد 🎉
                    </h2>
                </div>

                <div class="payment-box">

                    <div class="payment-icon">
                        <i class="fa-solid fa-check"></i>
                    </div>

                    <h3>
                        سفارش شما با موفقیت ثبت شد.
                    </h3>

                    <div class="payment-info">

                        <div class="payment-info-item">
                            <span>
                                شماره سفارش
                            </span>

                            <strong>
                                ${escapeHTML(orderCode)}
                            </strong>
                        </div>

                        <div class="payment-info-item">
                            <span>
                                روش دریافت
                            </span>

                            <strong>
                                ${
                                    selectedDeliveryMethod ===
                                    "restaurant"
                                        ? "صرف در رستوران"
                                        : selectedDeliveryMethod ===
                                          "delivery"
                                            ? "ارسال با پیک"
                                            : "دریافت حضوری"
                                }
                            </strong>
                        </div>

                        ${
                            selectedDeliveryMethod ===
                            "restaurant"
                                ? `
                                    <div class="payment-info-item">
                                        <span>
                                            شماره میز
                                        </span>

                                        <strong>
                                            ${escapeHTML(table)}
                                        </strong>
                                    </div>
                                `
                                : ""
                        }

                        ${
                            selectedDeliveryMethod ===
                            "delivery"
                                ? `
                                    <div class="payment-info-item">
                                        <span>
                                            آدرس
                                        </span>

                                        <strong>
                                            ${escapeHTML(selectedAddress)}
                                        </strong>
                                    </div>
                                `
                                : ""
                        }

                    </div>

                    <small>
                        سفارش شما برای کافه ارسال شد.
                    </small>

                    <button
                        class="checkout-btn"
                        id="goTrackBtn"
                        type="button"
                        style="margin-top:14px;"
                    >
                        پیگیری سفارش
                        <i class="fa-solid fa-location-arrow"></i>
                    </button>

                </div>
            </div>
        `;

        const goTrackBtn =
            document.getElementById(
                "goTrackBtn"
            );

        if (goTrackBtn) {
            goTrackBtn.addEventListener(
                "click",
                () => openTrackOrder(orderCode)
            );
        }

        openModalDialog(null, "#goTrackBtn");
        enableCheckoutScrolling();
    } catch (error) {
        console.error(
            "Order error:",
            error
        );

        showToast(
            error.message ||
            "خطا در ثبت سفارش."
        );

        if (payButton) {
            payButton.disabled = false;

            payButton.innerHTML =
                'ثبت سفارش <i class="fa-solid fa-arrow-left"></i>';
        }
    }
}

/* =========================================================
   ORDER TRACKING
========================================================= */

function saveLastOrder(orderCode) {
    if (!orderCode) return;
    localStorage.setItem("sideWalkLastOrder", orderCode);
}

function getLastOrder() {
    return localStorage.getItem("sideWalkLastOrder") || "";
}

function saveLastPhone(phone) {
    if (!phone) return;
    localStorage.setItem("sideWalkLastPhone", phone);
}

function getLastPhone() {
    return localStorage.getItem("sideWalkLastPhone") || "";
}

async function cancelOrderRequest(orderCode, phone) {
    const response = await fetch(
        `${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/cancel`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerPhone: phone })
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        throw new Error(data.message || "لغو سفارش انجام نشد.");
    }

    return data.order;
}

async function fetchOrderHistory(phone) {
    const response = await fetch(
        `${API_BASE_URL}/orders/history/${encodeURIComponent(phone)}`
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
        throw new Error(data.message || "دریافت تاریخچه سفارش‌ها ناموفق بود.");
    }

    return data.orders || [];
}

async function fetchOrderStatus(orderCode) {
    let response;

    try {
        response = await fetch(
            `${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}`
        );
    } catch (networkError) {
        const err = new Error("خطا در اتصال به سرور.");
        err.type = "network";
        throw err;
    }

    if (response.status === 404) {
        const err = new Error("سفارشی با این شماره پیدا نشد.");
        err.type = "not_found";
        throw err;
    }

    if (!response.ok) {
        const err = new Error("خطایی در سرور رخ داد.");
        err.type = "server";
        throw err;
    }

    const data = await response.json();

    return data.order;
}

function renderTrackStatus(order) {
    const panel = document.getElementById("trackResult");

    if (!panel) return;

    const status = order.status || "جدید";
    const info = orderStatusMap[status] || orderStatusMap["جدید"];
    const steps =
        order.deliveryMethod === "delivery"
            ? ["جدید", "در حال آماده‌سازی", "آماده شد", "در حال ارسال", "تحویل شد"]
            : ["جدید", "در حال آماده‌سازی", "آماده شد", "تحویل شد"];
    const currentIndex = steps.indexOf(status);

    const cancelButtonHTML =
        status === "جدید"
            ? `<button type="button" class="track-cancel-btn" id="cancelOrderBtn">
                    لغو سفارش
               </button>`
            : "";

    panel.innerHTML = `
        <div class="track-status-box">
            <div class="track-status-icon">
                <i class="fa-solid ${info.icon}"></i>
            </div>

            <h3>${info.label}</h3>

            <span class="track-order-code">
                شماره سفارش: ${order.orderCode || ""}
            </span>

            <div class="track-steps">
                ${steps.map((step, index) => `
                    <div class="track-step ${index <= currentIndex ? "done" : ""}">
                        <span class="track-dot"></span>
                        <span class="track-step-label">${orderStatusMap[step].label}</span>
                    </div>
                `).join("")}
            </div>

            ${cancelButtonHTML}
        </div>
    `;

    const cancelBtn = document.getElementById("cancelOrderBtn");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => onCancelOrderClick(order.orderCode));
    }
}

async function onCancelOrderClick(orderCode) {
    const confirmed = confirm("آیا از لغو این سفارش مطمئن هستید؟");
    if (!confirmed) return;

    let phone = getLastPhone();
    if (!phone) {
        phone = (prompt("برای لغو سفارش، شماره موبایلی که با آن سفارش داده‌اید را وارد کنید:") || "").trim();
    }

    if (!phone) {
        showToast("برای لغو سفارش، شماره موبایل لازم است.");
        return;
    }

    try {
        const order = await cancelOrderRequest(orderCode, phone);
        showToast("سفارش با موفقیت لغو شد.");
        renderTrackStatus(order);
        stopTrackPolling();
    } catch (error) {
        showToast(error.message || "لغو سفارش انجام نشد.");
    }
}

async function openTrackOrder(prefillCode) {
    if (!productModal || !modalContent) return;

    destroyDeliveryMap();

    modalContent.innerHTML = `
        <div class="checkout-page">
            <div class="checkout-title">
                <span>SIDE WALK</span>
                <h2 id="modalDialogTitle">پیگیری سفارش</h2>
            </div>

            <div class="track-search-box">
                <i class="fa-solid fa-hashtag track-hash-icon"></i>

                <input
                    id="trackCodeInput"
                    type="text"
                    placeholder="شماره سفارش را وارد کنید"
                    value="${prefillCode || getLastOrder()}"
                >

                <button
                    class="track-search-btn"
                    id="trackSubmitBtn"
                    type="button"
                    aria-label="پیگیری سفارش"
                >
                    <i class="fa-solid fa-magnifying-glass"></i>
                </button>
            </div>

            <div id="trackResult"></div>
        </div>
    `;

    openModalDialog(trackOrderBtnEl || document.activeElement, "#trackCodeInput");
    enableCheckoutScrolling();

    const submitBtn = document.getElementById("trackSubmitBtn");
    const codeInput = document.getElementById("trackCodeInput");

    async function runTrack(isRetry) {
        const code = codeInput.value.trim();

        if (!code) {
            showToast("لطفاً شماره سفارش را وارد کنید.");
            return;
        }

        const panel = document.getElementById("trackResult");

        panel.innerHTML = isRetry
            ? `<p style="text-align:center;padding:20px 0;">سرور در حال بیدار شدن است، لطفاً چند لحظه صبر کنید...</p>`
            : `<p style="text-align:center;padding:20px 0;">در حال بررسی...</p>`;

        try {
            const order = await fetchOrderStatus(code);
            saveLastOrder(code);
            renderTrackStatus(order);
            startTrackPolling(code);
        } catch (error) {
            // The backend runs on a free plan that goes to sleep after
            // inactivity — the first request can fail while it wakes up.
            // Retry automatically once before showing an error.
            if (error.type === "network" && !isRetry) {
                setTimeout(() => runTrack(true), 3500);
                return;
            }

            if (error.type === "network") {
                panel.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--orange);">اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.</p>`;
            } else if (error.type === "server") {
                panel.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--orange);">خطایی در سرور رخ داد. کمی بعد دوباره امتحان کنید.</p>`;
            } else {
                panel.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--orange);">سفارشی با این شماره پیدا نشد.</p>`;
            }

            stopTrackPolling();
        }
    }

    if (submitBtn) {
        submitBtn.addEventListener("click", () => runTrack());
    }

    if (codeInput) {
        codeInput.addEventListener("keydown", event => {
            if (event.key === "Enter") runTrack();
        });
    }

    if (codeInput.value) {
        runTrack();
    }
}

function startTrackPolling(orderCode) {
    stopTrackPolling();

    trackPollInterval = setInterval(async () => {
        if (!document.getElementById("trackResult")) {
            stopTrackPolling();
            return;
        }

        try {
            const order = await fetchOrderStatus(orderCode);
            renderTrackStatus(order);

            if (order.status === "تحویل شد" || order.status === "لغو شد") {
                stopTrackPolling();
            }
        } catch (_) {}
    }, 6000);
}

function stopTrackPolling() {
    if (trackPollInterval) {
        clearInterval(trackPollInterval);
        trackPollInterval = null;
    }
}

const trackOrderBtnEl = document.getElementById("trackOrderBtn");

if (trackOrderBtnEl) {
    trackOrderBtnEl.addEventListener("click", () => openTrackOrder());
}

/* =========================================================
   ORDER HISTORY ("سفارش‌های قبلی من")
========================================================= */

function renderHistoryList(ordersList) {
    if (!ordersList.length) {
        return `<p style="text-align:center;padding:20px 0;">هنوز سفارشی با این شماره ثبت نشده.</p>`;
    }

    return `
        <div class="history-list">
            ${ordersList.map(order => `
                <button
                    type="button"
                    class="history-item"
                    data-order-code="${escapeHTML(order.orderCode)}"
                >
                    <span class="history-item-code">${escapeHTML(order.orderCode)}</span>
                    <span class="history-item-status">${escapeHTML(order.status)}</span>
                    <span class="history-item-total">${formatPrice(order.total)} ${TOMAN_SVG}</span>
                </button>
            `).join("")}
        </div>
    `;
}

async function openOrderHistory() {
    if (!productModal || !modalContent) return;

    destroyDeliveryMap();

    const savedPhone = getLastPhone();

    modalContent.innerHTML = `
        <div class="checkout-page">
            <div class="checkout-title">
                <span>SIDE WALK</span>
                <h2 id="modalDialogTitle">سفارش‌های قبلی من</h2>
            </div>

            <div class="track-search-box">
                <i class="fa-solid fa-mobile-screen track-hash-icon"></i>

                <input
                    id="historyPhoneInput"
                    type="tel"
                    placeholder="شماره موبایل خود را وارد کنید"
                    value="${savedPhone}"
                >

                <button
                    class="track-search-btn"
                    id="historySubmitBtn"
                    type="button"
                    aria-label="نمایش سفارش‌ها"
                >
                    <i class="fa-solid fa-magnifying-glass"></i>
                </button>
            </div>

            <div id="historyResult"></div>
        </div>
    `;

    openModalDialog(document.getElementById("orderHistoryBtn") || document.activeElement, "#historyPhoneInput");
    enableCheckoutScrolling();

    const phoneInput = document.getElementById("historyPhoneInput");
    const submitBtn = document.getElementById("historySubmitBtn");
    const resultPanel = document.getElementById("historyResult");

    async function runHistoryLookup() {
        const phone = phoneInput.value.trim();

        if (!phone) {
            showToast("لطفاً شماره موبایل را وارد کنید.");
            return;
        }

        resultPanel.innerHTML = `<p style="text-align:center;padding:20px 0;">در حال بررسی...</p>`;

        try {
            const historyOrders = await fetchOrderHistory(phone);
            saveLastPhone(phone);
            resultPanel.innerHTML = renderHistoryList(historyOrders);

            resultPanel.querySelectorAll(".history-item").forEach(button => {
                button.addEventListener("click", () => {
                    openTrackOrder(button.dataset.orderCode);
                });
            });
        } catch (error) {
            resultPanel.innerHTML = `<p style="text-align:center;padding:20px 0;color:var(--orange);">${escapeHTML(error.message || "خطا در دریافت سفارش‌ها.")}</p>`;
        }
    }

    if (submitBtn) {
        submitBtn.addEventListener("click", runHistoryLookup);
    }

    if (phoneInput) {
        phoneInput.addEventListener("keydown", event => {
            if (event.key === "Enter") runHistoryLookup();
        });
    }

    if (phoneInput.value) {
        runHistoryLookup();
    }
}

const orderHistoryBtnEl = document.getElementById("orderHistoryBtn");

if (orderHistoryBtnEl) {
    orderHistoryBtnEl.addEventListener("click", () => openOrderHistory());
}

/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Tab") {
            if (productModal?.classList.contains("active")) {
                trapFocus(productModal.querySelector(".product-modal"), event);
            } else if (cartDrawer?.classList.contains("active")) {
                trapFocus(cartDrawer, event);
            }
        }

        if (event.key === "Escape") {
            if (productModal?.classList.contains("active")) {
                closeProduct();
                destroyDeliveryMap();
            } else if (cartDrawer?.classList.contains("active")) {
                closeCartDrawer();
            }
        }
    }
);

/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {
        if (
            currentCategory === "all" &&
            !searchTerm
        ) {
            setupSmartCategoryScroll();
        }

        if (deliveryMap) {
            setTimeout(() => {
                deliveryMap.invalidateSize();
            }, 100);
        }
    }
);

/* =========================================================
   THEME SWITCHER
========================================================= */

const themeBtnElement =
    document.getElementById(
        "themeBtn"
    );

if (themeBtnElement) {
    const themeIcon =
        themeBtnElement.querySelector("i");

    const savedTheme =
        localStorage.getItem(
            "sidewalk-theme"
        );

    if (savedTheme === "light") {
        document.body.classList.add(
            "light"
        );

        if (themeIcon) {
            themeIcon.className =
                "fa-solid fa-sun";
        }
    } else {
        document.body.classList.remove(
            "light"
        );

        if (themeIcon) {
            themeIcon.className =
                "fa-solid fa-moon";
        }
    }

    themeBtnElement.addEventListener(
        "click",
        () => {
            const isLight =
                document.body.classList.toggle(
                    "light"
                );

            if (isLight) {
                localStorage.setItem(
                    "sidewalk-theme",
                    "light"
                );

                if (themeIcon) {
                    themeIcon.className =
                        "fa-solid fa-sun";
                }
            } else {
                localStorage.setItem(
                    "sidewalk-theme",
                    "dark"
                );

                if (themeIcon) {
                    themeIcon.className =
                        "fa-solid fa-moon";
                }
            }
        }
    );
}

/* =========================================================
   HERO BURGER VIDEO (background removal + floating end state)
   The source clip has a white studio background (plus thin black
   letterbox bars top/bottom). We draw each frame onto a canvas at
   a cropped region (to drop the letterbox) and make near-white
   pixels transparent, so only the burger itself is visible over
   the hero section — no background box around the video.
========================================================= */

function initHeroBurger() {
    const wrap = document.getElementById('heroBurger');
    const video = document.getElementById('heroBurgerVideo');
    const canvas = document.getElementById('heroBurgerCanvas');

    if (!wrap || !video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Crop rect inside the source video (1080x720) that excludes
    // the black letterbox bars, keeping only the white-background
    // burger content.
    const SRC = { x: 0, y: 58, w: 1080, h: 600 };

    // Alpha fades out smoothly between these two thresholds so the
    // burger's edges don't get a hard, jagged cutout line.
    //
    // The source studio background isn't flat white — it's a soft
    // vignette that dims to ~220 near the frame edges. A brightness-only
    // key (old thresholds: 200/244) never reached those darker corners,
    // so a visible grey box was left floating behind the burger. We now
    // also require the pixel to be near-neutral (low saturation) before
    // keying it out, so the grey/white studio backdrop gets removed at
    // a lower brightness while colored food highlights (cheese, tomato,
    // sesame) are never touched, no matter how bright they are.
    const WHITE_SOFT = 180;
    const WHITE_FULL = 215;
    const GRAY_TOLERANCE = 12;

    let rafId = null;

    function resizeCanvas() {
        const rect = wrap.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
    }

    function drawFrame() {
        if (!canvas.width || !canvas.height) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            video,
            SRC.x, SRC.y, SRC.w, SRC.h,
            0, 0, canvas.width, canvas.height
        );

        let frame;
        try {
            frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            return;
        }

        const data = frame.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const minC = Math.min(r, g, b);
            const maxC = Math.max(r, g, b);

            // Only key out pixels that are both bright AND essentially
            // gray/white (studio backdrop). Colored pixels — even very
            // bright specular highlights on the cheese or tomato — are
            // left fully opaque.
            if (maxC - minC > GRAY_TOLERANCE) continue;

            if (minC >= WHITE_FULL) {
                data[i + 3] = 0;
            } else if (minC > WHITE_SOFT) {
                const t = (minC - WHITE_SOFT) / (WHITE_FULL - WHITE_SOFT);
                data[i + 3] = Math.round(data[i + 3] * (1 - t));
            }
        }

        ctx.putImageData(frame, 0, 0);
    }

    function loop() {
        if (video.paused || video.ended) return;
        drawFrame();
        rafId = requestAnimationFrame(loop);
    }

    video.addEventListener('play', () => {
        cancelAnimationFrame(rafId);
        loop();
    });

    video.addEventListener('ended', () => {
        cancelAnimationFrame(rafId);
        drawFrame();
        wrap.classList.add('float');
    });

    window.addEventListener('resize', () => {
        if (video.ended) {
            resizeCanvas();
            drawFrame();
        }
    });

    wrap.__playHeroBurger = function () {
        wrap.classList.remove('float');
        resizeCanvas();
        wrap.classList.add('play');

        try {
            video.currentTime = 0;
        } catch (e) {}

        const playPromise = video.play();
        if (playPromise && playPromise.catch) {
            playPromise.catch(() => {});
        }
    };
}

initHeroBurger();

/* =========================================================
   INITIALIZE
========================================================= */

loadProductsFromAPI();
window.addEventListener('load', function() {
  setTimeout(function() {
    document.getElementById('loadingScreen').classList.add('hide');

    const burger = document.getElementById('heroBurger');

    if (burger && burger.__playHeroBurger) {
        setTimeout(() => burger.__playHeroBurger(), 150);
    }
  }, 1700); // 5.5 ثانیه
});