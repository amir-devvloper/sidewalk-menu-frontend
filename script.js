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
   PRODUCTS
========================================================= */

function getAllCards() {
    return Array.from(document.querySelectorAll(".menu-card"));
}

function getProductData(card) {
    const image = card.querySelector(".card-image img");

    return {
        id: Number(card.dataset.id),
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

    const id = Number(card.dataset.id);
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

function addToCart(item) {
    const existing = cart.find(
        cartItem => cartItem.id === item.id
    );

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id: item.id,
            quantity: 1
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
                        تومان
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
                            Number(button.dataset.id),
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
    if (cartDrawer) {
        cartDrawer.classList.add("active");
    }

    if (drawerOverlay) {
        drawerOverlay.classList.add("active");
    }

    document.body.classList.add("no-scroll");
}

function closeCartDrawer() {
    if (cartDrawer) {
        cartDrawer.classList.remove("active");
    }

    if (drawerOverlay) {
        drawerOverlay.classList.remove("active");
    }

    document.body.classList.remove("no-scroll");
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

    modalContent.innerHTML = `
        <img
            class="modal-image"
            src="${item.image}"
            alt="${item.name}"
        >

        <div class="modal-body">
            <h2>${item.name}</h2>
            <p>${item.description}</p>

            <div class="modal-price">
                ${formatPrice(item.price)}
                تومان
            </div>

            <button
                class="checkout-btn"
                id="modalAdd"
                style="margin-top:20px"
                type="button"
            >
                افزودن به سبد
                <i class="fa-solid fa-bag-shopping"></i>
            </button>
        </div>
    `;

    productModal.classList.add("active");
    document.body.classList.add("no-scroll");

    const modalAdd = document.getElementById("modalAdd");

    if (modalAdd) {
        modalAdd.addEventListener("click", () => {
            addToCart(item);
            closeProduct();
        });
    }
}

function closeProduct() {
    if (productModal) {
        productModal.classList.remove("active");
    }

    document.body.classList.remove("no-scroll");
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
   INITIALIZE PRODUCTS
========================================================= */

function initializeProducts() {
    const cards = getAllCards();

    cards.forEach(card => {
        const id = Number(card.dataset.id);

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
                        addToCart(product);
                    }
                }
            );
        }

        const image =
            card.querySelector(".card-image img");

        if (image) {
            image.addEventListener("click", () => {
                const product =
                    getProductById(id);

                if (product) {
                    openProduct(product);
                }
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
                Number(card.dataset.id)
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
                <h3>${product.name}</h3>

                <span class="favorite-price">
                    ${formatPrice(product.price)}
                    تومان
                </span>

                <button
                    class="favorite-add-cart"
                    data-id="${product.id}"
                    type="button"
                >
                    افزودن به سبد
                    <i class="fa-solid fa-bag-shopping"></i>
                </button>
            </div>
        `;

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

    favoritesButton.innerHTML = `
        <i class="fa-solid fa-heart"></i>
        علاقه‌مندی‌ها
    `;

    headerActions.prepend(
        favoritesButton
    );

    favoritesButton.addEventListener(
        "click",
        () => {
            favoritesSection.classList.toggle(
                "show"
            );

            if (
                favoritesSection.classList.contains(
                    "show"
                )
            ) {
                renderFavorites();

                favoritesSection.scrollIntoView({
                    behavior: "smooth",
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
        alert(
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

                alert(
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
                    alert(
                        "دسترسی به موقعیت مکانی توسط مرورگر رد شد. اجازه Location را برای سایت فعال کنید."
                    );
                    break;

                case error.POSITION_UNAVAILABLE:
                    alert(
                        "موقعیت مکانی شما در دسترس نیست. GPS یا سرویس Location دستگاه را بررسی کنید."
                    );
                    break;

                case error.TIMEOUT:
                    alert(
                        "زمان دریافت موقعیت تمام شد. دوباره تلاش کنید."
                    );
                    break;

                default:
                    alert(
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

        alert(
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
                alert("لطفاً موقعیت را داخل شهر کرمان انتخاب کنید.");
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
        alert(
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
            if (cart.length === 0) {
                alert(
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
                <h2>ثبت سفارش</h2>
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
                        تومان
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

    productModal.classList.add("active");
    document.body.classList.add("no-scroll");

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
            processPayment
        );
    }
}

/* =========================================================
   PROCESS ORDER
========================================================= */

async function processPayment() {
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
        alert(
            "لطفاً نام را وارد کنید."
        );
        return;
    }

    if (
        selectedDeliveryMethod ===
        "restaurant" &&
        !table
    ) {
        alert(
            "لطفاً شماره میز را وارد کنید."
        );
        return;
    }

    if (
        selectedDeliveryMethod ===
        "delivery"
    ) {
        if (!selectedLocation) {
            alert(
                "لطفاً ابتدا لوکیشن خود را دریافت و تأیید کنید."
            );
            return;
        }

        if (!selectedAddress) {
            alert(
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
        alert(
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
        alert(
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

        cart = [];
        saveCart();
        renderCart();

        destroyDeliveryMap();

        modalContent.innerHTML = `
            <div class="checkout-page">

                <div class="checkout-title">
                    <span>SIDE WALK</span>
                    <h2>
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
                                ${orderCode}
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
                                            ${table}
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
                                            ${selectedAddress}
                                        </strong>
                                    </div>
                                `
                                : ""
                        }

                    </div>

                    <small>
                        سفارش شما برای کافه ارسال شد.
                    </small>

                </div>
            </div>
        `;
    } catch (error) {
        console.error(
            "Order error:",
            error
        );

        alert(
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
   PAYMENT PAGE
========================================================= */

function showPaymentPage(
    name,
    table,
    phone
) {
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

    modalContent.innerHTML = `
        <div class="checkout-page">

            <div class="checkout-title">
                <span>
                    SECURE PAYMENT
                </span>

                <h2>
                    پرداخت سفارش
                </h2>
            </div>

            <div class="payment-box">

                <div class="payment-icon">
                    <i class="fa-solid fa-lock"></i>
                </div>

                <h3>
                    مبلغ قابل پرداخت
                </h3>

                <strong class="payment-price">
                    ${formatPrice(total)}
                    تومان
                </strong>

                <div class="payment-info">

                    <div class="payment-info-item">
                        <span>نام</span>
                        <strong>${name}</strong>
                    </div>

                    <div class="payment-info-item">
                        <span>شماره میز</span>
                        <strong>${table}</strong>
                    </div>

                    <div class="payment-info-item">
                        <span>موبایل</span>
                        <strong>${phone}</strong>
                    </div>

                </div>

                <button
                    class="checkout-btn"
                    id="fakePay"
                    type="button"
                >
                    پرداخت
                    <i class="fa-solid fa-arrow-left"></i>
                </button>

                <small>
                    این صفحه در حال حاضر نمایشی است.
                    برای پرداخت واقعی باید به درگاه بانکی
                    متصل شود.
                </small>

            </div>
        </div>
    `;

    productModal.classList.add("active");
    document.body.classList.add("no-scroll");

    const fakePay =
        document.getElementById(
            "fakePay"
        );

    if (fakePay) {
        fakePay.addEventListener(
            "click",
            () => {
                alert(
                    "برای اتصال پرداخت واقعی، API درگاه بانکی باید در بک‌اند قرار بگیرد."
                );
            }
        );
    }
}

/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Escape") {
            closeCartDrawer();
            closeProduct();
            destroyDeliveryMap();
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
   INITIALIZE
========================================================= */

initializeProducts();
renderMenu();
renderCart();
renderFavorites();