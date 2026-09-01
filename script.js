let cart =
    JSON.parse(
        localStorage.getItem("sideWalkCart")
    ) || [];

let favorites =
    JSON.parse(
        localStorage.getItem("sideWalkFavorites")
    ) || [];

let currentCategory = "all";
let searchTerm = "";

const API_BASE_URL =
    window.SIDEWALK_API_URL ||
    "https://sidewalk-menu-backend.onrender.com/api";


/* =========================================================
   DOM
========================================================= */

const menuGrid =
    document.getElementById("menuGrid");

const searchInput =
    document.getElementById("searchInput");

const clearSearch =
    document.getElementById("clearSearch");

const noResult =
    document.getElementById("noResult");

const cartBtn =
    document.getElementById("cartBtn");

const cartDrawer =
    document.getElementById("cartDrawer");

const drawerOverlay =
    document.getElementById("drawerOverlay");

const closeCart =
    document.getElementById("closeCart");

const cartItems =
    document.getElementById("cartItems");

const cartCount =
    document.getElementById("cartCount");

const cartTotal =
    document.getElementById("cartTotal");

const themeBtn =
    document.getElementById("themeBtn");

const productModal =
    document.getElementById("productModal");

const modalClose =
    document.getElementById("modalClose");

const modalContent =
    document.getElementById("modalContent");


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
   GET ALL PRODUCTS
========================================================= */

function getAllCards() {

    return Array.from(
        document.querySelectorAll(".menu-card")
    );

}


/* =========================================================
   GET PRODUCT DATA
========================================================= */

function getProductData(card) {

    const image =
        card.querySelector(".card-image img");

    return {

        id: Number(card.dataset.id),

        name:
            card.dataset.name || "",

        category:
            card.dataset.category || "",

        price:
            Number(card.dataset.price) || 0,

        rating:
            Number(card.dataset.rating) || 0,

        description:
            card.dataset.description || "",

        image:
            image
                ? image.getAttribute("src")
                : ""

    };

}


/* =========================================================
   GET PRODUCT BY ID
========================================================= */

function getProductById(id) {

    const card =
        document.querySelector(
            `.menu-card[data-id="${id}"]`
        );

    if (!card) {

        return null;

    }

    return getProductData(card);

}


/* =========================================================
   FORMAT PRICE
========================================================= */

function formatPrice(price) {

    return Number(price)
        .toLocaleString("fa-IR");

}


/* =========================================================
   SAVE CART
========================================================= */

function saveCart() {

    localStorage.setItem(
        "sideWalkCart",
        JSON.stringify(cart)
    );

}


/* =========================================================
   SAVE FAVORITES
========================================================= */

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

    const button =
        card.querySelector(".favorite");

    if (!button) {

        return;

    }

    const id =
        Number(card.dataset.id);

    const icon =
        button.querySelector("i");

    const active =
        isFavorite(id);

    button.classList.toggle(
        "active",
        active
    );

    if (icon) {

        icon.className =
            active
                ? "fa-solid fa-heart"
                : "fa-regular fa-heart";

    }

}


function toggleFavorite(id) {

    if (isFavorite(id)) {

        favorites =
            favorites.filter(
                favoriteId =>
                    favoriteId !== id
            );

    } else {

        favorites.push(id);

    }

    saveFavorites();

    const card =
        document.querySelector(
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

    const existing =
        cart.find(
            cartItem =>
                cartItem.id === item.id
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


/* =========================================================
   CHANGE QUANTITY
========================================================= */

function changeQuantity(id, change) {

    const item =
        cart.find(
            cartItem =>
                cartItem.id === id
        );

    if (!item) {

        return;

    }

    item.quantity += change;

    if (item.quantity <= 0) {

        cart =
            cart.filter(
                cartItem =>
                    cartItem.id !== id
            );

    }

    saveCart();

    renderCart();

}


/* =========================================================
   REMOVE FROM CART
========================================================= */

function removeFromCart(id) {

    cart =
        cart.filter(
            item =>
                item.id !== id
        );

    saveCart();

    renderCart();

}


/* =========================================================
   RENDER CART
========================================================= */

function renderCart() {

    if (!cartItems) {

        return;

    }

    cartItems.innerHTML = "";


    if (cart.length === 0) {

        cartItems.innerHTML = `

            <div class="empty-cart">

                <div class="empty-icon">

                    <i class="fa-solid fa-bag-shopping"></i>

                </div>

                <h3>
                    سبد شما خالیه
                </h3>

                <p>
                    هنوز چیزی به سفارش اضافه نکردید.
                </p>

            </div>

        `;

    } else {

        cart.forEach(cartItem => {

            const product =
                getProductById(
                    cartItem.id
                );

            if (!product) {

                return;

            }


            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "cart-item";


            element.innerHTML = `

                <img
                    src="${product.image}"
                    alt="${product.name}"
                >

                <div class="cart-item-info">

                    <h4>
                        ${product.name}
                    </h4>

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

                        <span>
                            ${cartItem.quantity}
                        </span>

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
                .querySelectorAll(
                    ".quantity button"
                )
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        () => {

                            changeQuantity(

                                Number(
                                    button.dataset.id
                                ),

                                Number(
                                    button.dataset.change
                                )

                            );

                        }
                    );

                });


            element
                .querySelector(
                    ".remove-item"
                )
                .addEventListener(
                    "click",
                    () => {

                        removeFromCart(
                            product.id
                        );

                    }
                );


            cartItems.appendChild(
                element
            );

        });

    }


    let totalItems = 0;

    let totalPrice = 0;


    cart.forEach(cartItem => {

        const product =
            getProductById(
                cartItem.id
            );

        if (!product) {

            return;

        }

        totalItems +=
            cartItem.quantity;

        totalPrice +=
            product.price *
            cartItem.quantity;

    });


    if (cartCount) {

        cartCount.textContent =
            totalItems.toLocaleString(
                "fa-IR"
            );

    }


    if (cartTotal) {

        cartTotal.textContent =
            formatPrice(totalPrice);

    }

}


/* =========================================================
   OPEN CART
========================================================= */

function openCart() {

    if (cartDrawer) {

        cartDrawer.classList.add(
            "active"
        );

    }

    if (drawerOverlay) {

        drawerOverlay.classList.add(
            "active"
        );

    }

    document.body.classList.add(
        "no-scroll"
    );

}


/* =========================================================
   CLOSE CART
========================================================= */

function closeCartDrawer() {

    if (cartDrawer) {

        cartDrawer.classList.remove(
            "active"
        );

    }

    if (drawerOverlay) {

        drawerOverlay.classList.remove(
            "active"
        );

    }

    document.body.classList.remove(
        "no-scroll"
    );

}


if (cartBtn) {

    cartBtn.addEventListener(
        "click",
        openCart
    );

}


if (closeCart) {

    closeCart.addEventListener(
        "click",
        closeCartDrawer
    );

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

    if (!modalContent || !productModal) {

        return;

    }


    modalContent.innerHTML = `

        <img
            class="modal-image"
            src="${item.image}"
            alt="${item.name}"
        >

        <div class="modal-body">

            <h2>
                ${item.name}
            </h2>

            <p>
                ${item.description}
            </p>

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


    productModal.classList.add(
        "active"
    );

    document.body.classList.add(
        "no-scroll"
    );


    document
        .getElementById("modalAdd")
        .addEventListener(
            "click",
            () => {

                addToCart(item);

                closeProduct();

            }
        );

}


/* =========================================================
   CLOSE PRODUCT
========================================================= */

function closeProduct() {

    if (productModal) {

        productModal.classList.remove(
            "active"
        );

    }

    document.body.classList.remove(
        "no-scroll"
    );

}


if (modalClose) {

    modalClose.addEventListener(
        "click",
        closeProduct
    );

}


if (productModal) {

    productModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                productModal
            ) {

                closeProduct();

            }

        }
    );

}


/* =========================================================
   INITIALIZE PRODUCTS
========================================================= */

function initializeProducts() {

    const cards =
        getAllCards();


    cards.forEach(card => {

        const id =
            Number(card.dataset.id);


        /* FAVORITE */

        const favoriteButton =
            card.querySelector(
                ".favorite"
            );


        if (favoriteButton) {

            favoriteButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleFavorite(id);

                }
            );

        }


        /* ADD TO CART */

        const addButton =
            card.querySelector(
                ".add-btn"
            );


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


        /* OPEN PRODUCT */

        const image =
            card.querySelector(
                ".card-image img"
            );


        if (image) {

            image.addEventListener(
                "click",
                () => {

                    const product =
                        getProductById(id);


                    if (product) {

                        openProduct(product);

                    }

                }
            );

        }


        updateFavoriteButton(card);

    });

}


/* =========================================================
   CATEGORY FILTER
========================================================= */

function setActiveCategory(category) {

    currentCategory =
        category;


    const buttons =
        document.querySelectorAll(
            ".category"
        );


    buttons.forEach(button => {

        button.classList.toggle(

            "active",

            button.dataset.category ===
            category

        );

    });

}


/* =========================================================
   RENDER MENU
========================================================= */

function renderMenu() {

    const cards =
        getAllCards();


    if (!cards.length) {

        return;

    }


    if (noResult) {

        noResult.style.display =
            "none";

    }


    cards.forEach(card => {

        const category =
            card.dataset.category;


        const name =
            (
                card.dataset.name ||
                ""
            ).toLowerCase();


        const description =
            (
                card.dataset.description ||
                ""
            ).toLowerCase();


        let visible = true;


        /* SEARCH */

        if (searchTerm) {

            visible =
                name.includes(searchTerm) ||
                description.includes(searchTerm);

        }


        /* CATEGORY */

        else if (
            currentCategory !== "all"
        ) {

            visible =
                category ===
                currentCategory;

        }


        card.style.display =
            visible
                ? ""
                : "none";

    });


    /* =====================================================
       HIDE EMPTY SECTIONS
    ===================================================== */

    const sections =
        document.querySelectorAll(
            ".menu-category-section"
        );


    sections.forEach(section => {

        const visibleCards =
            Array.from(
                section.querySelectorAll(
                    ".menu-card"
                )
            ).filter(card => {

                return (
                    card.style.display !==
                    "none"
                );

            });


        section.style.display =
            visibleCards.length
                ? ""
                : "none";

    });


    /* =====================================================
       NO RESULT
    ===================================================== */

    const visibleCount =
        cards.filter(card => {

            return (
                card.style.display !==
                "none"
            );

        }).length;


    if (
        visibleCount === 0 &&
        noResult
    ) {

        noResult.style.display =
            "block";

    }


    /* =====================================================
       SMART SCROLL
    ===================================================== */

    if (
        currentCategory === "all" &&
        !searchTerm
    ) {

        setupSmartCategoryScroll();

    } else {

        if (smartCategoryObserver) {

            smartCategoryObserver.disconnect();

            smartCategoryObserver =
                null;

        }

    }

}


/* =========================================================
   SMART CATEGORY SCROLL
========================================================= */

let smartCategoryObserver =
    null;


function setupSmartCategoryScroll() {

    if (smartCategoryObserver) {

        smartCategoryObserver.disconnect();

        smartCategoryObserver =
            null;

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


    if (!sections.length) {

        return;

    }


    smartCategoryObserver =
        new IntersectionObserver(

            entries => {

                let bestSection =
                    null;

                let bestRatio =
                    0;


                entries.forEach(entry => {

                    if (
                        entry.isIntersecting &&
                        entry.intersectionRatio >
                        bestRatio
                    ) {

                        bestRatio =
                            entry.intersectionRatio;

                        bestSection =
                            entry.target;

                    }

                });


                if (!bestSection) {

                    return;

                }


                const category =
                    bestSection.dataset.category;


                if (category) {

                    setActiveCategory(
                        category
                    );

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

        smartCategoryObserver.observe(
            section
        );

    });

}


/* =========================================================
   SCROLL ACTIVE CATEGORY
========================================================= */

function scrollActiveCategoryIntoView() {

    if (
        window.innerWidth >
        768
    ) {

        return;

    }


    const activeButton =
        document.querySelector(
            ".category.active"
        );


    const container =
        document.querySelector(
            ".categories"
        );


    if (
        !activeButton ||
        !container
    ) {

        return;

    }


    const containerRect =
        container.getBoundingClientRect();


    const buttonRect =
        activeButton.getBoundingClientRect();


    const outside =
        buttonRect.left <
        containerRect.left ||

        buttonRect.right >
        containerRect.right;


    if (outside) {

        activeButton.scrollIntoView({

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

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(".category");

        if (!button) {
            return;
        }

        if (categoryWasDragged) {

            event.preventDefault();
            event.stopPropagation();

            categoryWasDragged = false;

            return;
        }

        const category =
            button.dataset.category;

        if (!category) {
            return;
        }

        event.preventDefault();

        setActiveCategory(category);

        renderMenu();

    }
);


/* =========================================================
   MOBILE CATEGORY DRAG / SWIPE
========================================================= */

function enableCategoryDrag() {

    const categoryContainer =
        document.querySelector(
            ".categories"
        );


    if (!categoryContainer) {

        return;

    }


    let isDragging =
        false;

    let startX =
        0;

    let startScrollLeft =
        0;

    let moved =
        false;


    categoryContainer.addEventListener(
        "pointerdown",
        event => {

            if (
                event.pointerType !==
                    "touch" &&
                event.pointerType !==
                    "pen"
            ) {

                return;

            }


            isDragging =
                true;

            moved =
                false;

            categoryWasDragged =
                false;


            startX =
                event.clientX;


            startScrollLeft =
                categoryContainer.scrollLeft;


            categoryContainer.classList.add(
                "dragging"
            );


            try {

                categoryContainer.setPointerCapture(
                    event.pointerId
                );

            } catch (error) {

                // nothing

            }

        },
        {
            passive: true
        }
    );


    categoryContainer.addEventListener(
        "pointermove",
        event => {

            if (!isDragging) {

                return;

            }


            const distance =
                event.clientX -
                startX;


            if (
                Math.abs(distance) >
                8
            ) {

                moved =
                    true;

                categoryWasDragged =
                    true;

            }


            categoryContainer.scrollLeft =
                startScrollLeft -
                distance;

        },
        {
            passive: true
        }
    );


    function stopDragging(event) {

        if (!isDragging) {

            return;

        }


        isDragging =
            false;


        categoryContainer.classList.remove(
            "dragging"
        );


        try {

            categoryContainer.releasePointerCapture(
                event.pointerId
            );

        } catch (error) {

            // nothing

        }


        if (moved) {

            setTimeout(() => {

                categoryWasDragged =
                    false;

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


/* =========================================================
   CLEAR SEARCH
========================================================= */

if (clearSearch) {

    clearSearch.addEventListener(
        "click",
        () => {

            searchInput.value =
                "";

            searchTerm =
                "";

            renderMenu();

            searchInput.focus();

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
        document.createElement(
            "section"
        );


    section.id =
        "favoritesSection";


    section.className =
        "favorites-section";


    section.innerHTML = `

        <div class="favorites-heading">

            <div>

                <span>
                    YOUR FAVORITES
                </span>

                <h2>
                    علاقه‌مندی‌ها
                </h2>

            </div>

        </div>


        <div
            id="favoritesGrid"
            class="favorites-grid"
        ></div>

    `;


    const menu =
        document.getElementById(
            "menu"
        );


    if (menu) {

        menu.appendChild(
            section
        );

    }


    renderFavorites();

}


/* =========================================================
   RENDER FAVORITES
========================================================= */

function renderFavorites() {

    const section =
        document.getElementById(
            "favoritesSection"
        );


    if (!section) {

        return;

    }


    const grid =
        document.getElementById(
            "favoritesGrid"
        );


    if (!grid) {

        return;

    }


    grid.innerHTML =
        "";


    const favoriteCards =
        getAllCards().filter(
            card =>
                isFavorite(
                    Number(
                        card.dataset.id
                    )
                )
        );


    if (
        favoriteCards.length ===
        0
    ) {

        grid.innerHTML = `

            <div class="empty-favorites">

                <i class="fa-regular fa-heart"></i>

                <h3>
                    هنوز چیزی ذخیره نکردی
                </h3>

                <p>
                    روی قلب محصولات بزن تا اینجا نمایش داده بشن ❤️
                </p>

            </div>

        `;

        return;

    }


    favoriteCards.forEach(
        card => {

            const product =
                getProductData(card);


            const favoriteCard =
                document.createElement(
                    "div"
                );


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
                        ${product.name}
                    </h3>


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

                        addToCart(
                            product
                        );

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


            grid.appendChild(
                favoriteCard
            );

        }
    );

}


/* =========================================================
   CREATE FAVORITES
========================================================= */

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
        document.createElement(
            "button"
        );


    favoritesButton.className =
        "favorites-nav-button";


    favoritesButton.type =
        "button";


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

                    behavior:
                        "smooth",

                    block:
                        "start"

                });

            }

        }
    );

}


/* =========================================================
   CHECKOUT
========================================================= */

const checkoutButton =
    document.getElementById("checkoutBtn");

if (checkoutButton) {

    checkoutButton.addEventListener("click", function () {

        if (cart.length === 0) {

            alert("لطفاً ابتدا یک محصول به سبد سفارش اضافه کنید.");

            return;
        }

        openCheckout();

    });

}






/* =========================================================
   OPEN CHECKOUT
========================================================= */

function openCheckout() {

    const total =
        cart.reduce(
            (sum, cartItem) => {

                const product =
                    getProductById(
                        cartItem.id
                    );


                if (!product) {

                    return sum;

                }


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
                    SIDE WALK
                </span>

                <h2>
                    ثبت سفارش
                </h2>

            </div>


            <div class="checkout-form">

                <label>
                    نام شما
                </label>


                <input
                    id="customerName"
                    type="text"
                    placeholder="مثلاً امیر"
                >


                <label>
                    شماره میز
                </label>


                <input
                    id="tableNumber"
                    type="text"
                    placeholder="مثلاً ۱۲"
                >


                <label>
                    شماره موبایل
                </label>


                <input
                    id="customerPhone"
                    type="tel"
                    placeholder="09xxxxxxxxx"
                >


                <div class="checkout-total">

                    <span>
                        مبلغ سفارش
                    </span>

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


    productModal.classList.add(
        "active"
    );


    document.body.classList.add(
        "no-scroll"
    );


    document
        .getElementById(
            "payButton"
        )
        .addEventListener(
            "click",
            processPayment
        );

}


/* =========================================================
   PROCESS PAYMENT
========================================================= */

function processPayment() {

    const nameInput = document.getElementById("customerName");
    const tableInput = document.getElementById("tableNumber");
    const phoneInput = document.getElementById("customerPhone");

    if (!nameInput || !tableInput || !phoneInput) {
        return;
    }

    const name = nameInput.value.trim();
    const table = tableInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name || !table) {
        alert("لطفاً نام و شماره میز را وارد کنید.");
        return;
    }

    const items = cart
        .map(cartItem => {
            const product = getProductById(cartItem.id);
            if (!product) return null;

            return {
                productId: product.id,
                name: product.name,
                price: Number(product.price),
                quantity: Number(cartItem.quantity)
            };
        })
        .filter(Boolean);

    if (!items.length) {
        alert("سبد سفارش خالی است.");
        return;
    }

    const payButton = document.getElementById("payButton");
    if (payButton) {
        payButton.disabled = true;
        payButton.innerHTML = "در حال ثبت سفارش... <i class=\"fa-solid fa-spinner fa-spin\"></i>";
    }

    fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            customerName: name,
            tableNumber: table,
            customerPhone: phone,
            items
        })
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "ثبت سفارش ناموفق بود.");
        }
        return data;
    })
    .then(data => {
        const orderCode = data.order.orderCode;

        cart = [];
        saveCart();
        renderCart();

        modalContent.innerHTML = `
            <div class="checkout-page">
                <div class="checkout-title">
                    <span>SIDE WALK</span>
                    <h2>سفارش ثبت شد 🎉</h2>
                </div>

                <div class="payment-box">
                    <div class="payment-icon">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h3>سفارش شما با موفقیت ثبت شد.</h3>
                    <div class="payment-info">
                        <div class="payment-info-item">
                            <span>شماره سفارش</span>
                            <strong>${orderCode}</strong>
                        </div>
                        <div class="payment-info-item">
                            <span>شماره میز</span>
                            <strong>${table}</strong>
                        </div>
                    </div>
                    <small>سفارش شما برای کافه ارسال شد.</small>
                </div>
            </div>
        `;
    })
    .catch(error => {
        console.error(error);
        alert(error.message || "خطا در ثبت سفارش.");

        if (payButton) {
            payButton.disabled = false;
            payButton.innerHTML = 'ثبت سفارش <i class="fa-solid fa-arrow-left"></i>';
        }
    });
}


/* =========================================================
   PAYMENT PAGE
========================================================= */

function showPaymentPage(name, table, phone) {

    const total =
        cart.reduce(
            (sum, cartItem) => {

                const product =
                    getProductById(cartItem.id);

                if (!product) {
                    return sum;
                }

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
                    برای پرداخت واقعی باید به درگاه بانکی متصل شود.
                </small>

            </div>

        </div>

    `;


    productModal.classList.add("active");

    document.body.classList.add("no-scroll");


    document
        .getElementById("fakePay")
        .addEventListener(
            "click",
            () => {

                alert(
                    "برای اتصال پرداخت واقعی، API درگاه بانکی باید در بک‌اند قرار بگیرد."
                );

            }
        );

}






/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            closeCartDrawer();

            closeProduct();

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

    }
);


/* =========================================================
   INITIALIZE
========================================================= */

initializeProducts();

renderMenu();

renderCart();

renderFavorites();


/* =====================================================
   🌙☀️ THEME SWITCHER
===================================================== */

const themeBtnElement =
    document.getElementById("themeBtn");

if (themeBtnElement) {

    const themeIcon =
        themeBtnElement.querySelector("i");


    /* تم ذخیره شده */

    const savedTheme =
        localStorage.getItem(
            "sidewalk-theme"
        );


    /* اجرای تم هنگام ورود */

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


    /* تغییر تم */

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
