const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const supabase = require("../supabase");
const { verifyAdmin } = require("../middleware/auth");

// More granular pipeline: جدید -> در حال آماده‌سازی -> آماده شد ->
// (در حال ارسال فقط برای پیک) -> تحویل شد, یا لغو شد در هر مرحله.
const ORDER_STATUSES = [
    "جدید",
    "در حال آماده‌سازی",
    "آماده شد",
    "در حال ارسال",
    "تحویل شد",
    "لغو شد"
];
// Statuses the customer is still allowed to self-cancel from, and the
// time window (ms) after order creation during which cancellation is allowed.
const CUSTOMER_CANCELLABLE_STATUSES = new Set(["جدید"]);
const CUSTOMER_CANCEL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DELIVERY_METHODS = new Set(["restaurant", "delivery", "pickup"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ABAN_API_BASE = "https://abangateway.ir/api/v1";
const ABAN_API_TOKEN = String(process.env.ABAN_API_TOKEN || "").trim();
const ABAN_CALLBACK_URL =
    String(process.env.ABAN_CALLBACK_URL || "https://sidewalk-menu-backend.onrender.com/api/orders/payment/callback").trim();

async function abanRequest(path, options = {}) {
    if (!ABAN_API_TOKEN) {
        const error = new Error("ABAN_API_TOKEN تنظیم نشده است.");
        error.status = 503;
        throw error;
    }

    const response = await fetch(`${ABAN_API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${ABAN_API_TOKEN}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};
    try {
        data = await response.json();
    } catch (_) {}

    if (!response.ok) {
        const error = new Error(
            data?.message ||
            data?.error?.message ||
            data?.error ||
            `Aban Gateway HTTP ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

async function createAbanInvoice({ orderCode, totalToman, customerName, customerPhone }) {
    const amountRial = Math.round(Number(totalToman) * 10);
    if (!Number.isSafeInteger(amountRial) || amountRial <= 0) {
        throw new Error("مبلغ سفارش برای پرداخت نامعتبر است.");
    }

    return abanRequest("/invoices", {
        method: "POST",
        body: JSON.stringify({
            amount_rial: amountRial,
            order_id: orderCode,
            callback_url: ABAN_CALLBACK_URL,
            description: `پرداخت سفارش SideWalk ${orderCode}`,
            metadata: {
                order_code: orderCode,
                customer_name: customerName,
                customer_phone: customerPhone
            }
        })
    });
}

async function verifyAbanInvoice(invoiceId) {
    return abanRequest(`/invoices/${encodeURIComponent(invoiceId)}/verify`, {
        method: "POST",
        body: JSON.stringify({})
    });
}

function makeOrderCode() {
    return `SW-${crypto.randomInt(10000000, 100000000)}-${crypto.randomInt(1000, 10000)}`;
}

function cleanString(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDigits(value) {
    return String(value || "")
        .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
        .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
}

function normalizePhone(value) {
    const raw = normalizeDigits(cleanString(value, 30)).replace(/[\s-]/g, "");
    if (/^09\d{9}$/.test(raw)) return raw;
    return "";
}

function mapOrder(order, { publicView = false } = {}) {
    const base = {
        _id: order.id,
        orderCode: order.order_code,
        items: order.items,
        total: order.total,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at
    };

    if (publicView) {
        return {
            orderCode: order.order_code,
            status: order.status,
            deliveryMethod: order.delivery_method,
            createdAt: order.created_at,
            updatedAt: order.updated_at
        };
    }

    return {
        ...base,
        customerName: order.customer_name,
        tableNumber: order.table_number,
        customerPhone: order.customer_phone,
        deliveryMethod: order.delivery_method,
        address: order.address,
        pickupEta: order.pickup_eta
    };
}

function validateOrderBody(body = {}) {
    const customerName = cleanString(body.customerName, 100);
    const customerPhone = normalizePhone(body.customerPhone);
    const tableNumber = cleanString(body.tableNumber, 20);
    const deliveryMethod = cleanString(body.deliveryMethod, 20);
    const address = cleanString(body.address, 1000);
    const pickupEta = cleanString(body.pickupEta, 50);
    const location = body.location && typeof body.location === "object"
        ? { lat: Number(body.location.lat), lng: Number(body.location.lng) }
        : null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !customerPhone || !DELIVERY_METHODS.has(deliveryMethod)) {
        return { error: "اطلاعات سفارش نامعتبر است." };
    }

    if (items.length < 1 || items.length > 50) {
        return { error: "تعداد محصولات سفارش نامعتبر است." };
    }

    if (deliveryMethod === "restaurant" && !tableNumber) {
        return { error: "شماره میز وارد نشده است." };
    }

    if (deliveryMethod === "delivery") {
        if (!address) return { error: "آدرس ارسال وارد نشده است." };

        if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) ||
            location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
            return { error: "موقعیت ارسال نامعتبر است." };
        }

        const kermanCenter = { lat: 30.2839, lng: 57.0834 };
        const toRad = value => value * Math.PI / 180;
        const R = 6371;
        const dLat = toRad(location.lat - kermanCenter.lat);
        const dLng = toRad(location.lng - kermanCenter.lng);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(kermanCenter.lat)) * Math.cos(toRad(location.lat)) *
            Math.sin(dLng / 2) ** 2;
        const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (distanceKm > 35) return { error: "این محدوده خارج از منطقه ارسال SIDE WALK است." };
    }

    if (deliveryMethod === "pickup") {
        const eta = Number(pickupEta);
        if (!Number.isFinite(eta) || eta <= 0 || eta > 24 * 60) {
            return { error: "زمان دریافت حضوری نامعتبر است." };
        }
    }

    const quantityByProduct = new Map();
    for (const item of items) {
        const productId = String(item?.productId || "").trim();
        const quantity = Number(item?.quantity);
        if (!UUID_RE.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
            return { error: "اطلاعات یکی از محصولات نامعتبر است." };
        }
        quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + quantity);
    }

    const totalQuantity = [...quantityByProduct.values()].reduce((sum, quantity) => sum + quantity, 0);
    if (totalQuantity > 100) {
        return { error: "تعداد کل محصولات سفارش بیش از حد مجاز است." };
    }

    return {
        value: {
            customerName,
            customerPhone,
            tableNumber: deliveryMethod === "restaurant" ? tableNumber : "",
            deliveryMethod,
            address: deliveryMethod === "delivery" ? address : "",
            pickupEta: deliveryMethod === "pickup" ? pickupEta : "",
            quantityByProduct
        }
    };
}

// Looks up products for a quantityByProduct map, checks availability, and
// returns priced order items + total. Shared by the public checkout and
// the admin manual-order endpoint so prices always come from the database.
async function resolveOrderItems(quantityByProduct) {
    const productIds = [...quantityByProduct.keys()];

    const { data: products, error: productError } = await supabase
        .from("products")
        .select("id,name,price,available,sold_out_date")
        .in("id", productIds);

    if (productError) {
        console.error("Order product lookup error:", productError.message);
        return { error: "خطا در بررسی محصولات سفارش.", status: 500 };
    }

    if (!products || products.length !== productIds.length) {
        return { error: "یکی از محصولات دیگر وجود ندارد.", status: 400 };
    }

    const today = new Date().toISOString().slice(0, 10);
    const productMap = new Map(products.map(product => [product.id, product]));
    const unavailable = products.find(
        product => product.available === false || product.sold_out_date === today
    );
    if (unavailable) {
        return {
            error: `محصول «${unavailable.name}» در حال حاضر ناموجود است.`,
            status: 409
        };
    }

    const items = productIds.map(productId => {
        const product = productMap.get(productId);
        const quantity = quantityByProduct.get(productId);
        return {
            productId: product.id,
            name: product.name,
            price: Number(product.price),
            quantity
        };
    });

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!Number.isSafeInteger(total) || total < 0 || total > 10000000000) {
        return { error: "مبلغ سفارش نامعتبر است.", status: 400 };
    }

    return { items, total };
}

async function insertOrder({ customerName, tableNumber, customerPhone, deliveryMethod, address, pickupEta, items, total }) {
    let data = null;
    let insertError = null;
    for (let attempt = 0; attempt < 3 && !data; attempt += 1) {
        const orderCode = makeOrderCode();
        const result = await supabase
            .from("orders")
            .insert([{
                order_code: orderCode,
                customer_name: customerName,
                table_number: tableNumber,
                customer_phone: customerPhone,
                delivery_method: deliveryMethod,
                address,
                pickup_eta: pickupEta,
                items,
                total
            }])
            .select()
            .single();
        data = result.data;
        insertError = result.error;

        if (insertError && insertError.code !== "23505") break;
    }

    return { data, insertError };
}

// Customer creates an order. Prices/names come from the database, never the browser.
router.post("/", async (req, res) => {
    try {
        const validation = validateOrderBody(req.body);
        if (validation.error) {
            return res.status(400).json({ success: false, message: validation.error });
        }

        const { quantityByProduct, ...customer } = validation.value;
        const resolved = await resolveOrderItems(quantityByProduct);
        if (resolved.error) {
            return res.status(resolved.status).json({ success: false, message: resolved.error });
        }

        const { data, insertError } = await insertOrder({
            ...customer,
            items: resolved.items,
            total: resolved.total
        });

        if (insertError || !data) {
            console.error("Order insert error:", insertError?.message);
            return res.status(500).json({ success: false, message: "خطا در ثبت سفارش." });
        }

        try {
            const invoice = await createAbanInvoice({
                orderCode: data.order_code,
                totalToman: resolved.total,
                customerName: customer.customerName,
                customerPhone: customer.customerPhone
            });

            const invoiceId = invoice?.invoice_id || invoice?.id;
            const paymentUrl = invoice?.payment_url;

            if (!invoiceId || !paymentUrl) {
                throw new Error("آبان لینک پرداخت معتبری برنگرداند.");
            }

            const { error: paymentUpdateError } = await supabase
                .from("orders")
                .update({
                    payment_status: "pending",
                    payment_invoice_id: String(invoiceId),
                    payment_url: String(paymentUrl)
                })
                .eq("id", data.id);

            if (paymentUpdateError) throw paymentUpdateError;

            return res.status(201).json({
                success: true,
                message: "سفارش ثبت شد و آماده پرداخت است.",
                order: {
                    ...mapOrder(data),
                    paymentStatus: "pending",
                    paymentInvoiceId: String(invoiceId),
                    paymentUrl: String(paymentUrl)
                },
                payment: {
                    invoiceId: String(invoiceId),
                    paymentUrl: String(paymentUrl),
                    payableToman: invoice?.payable_toman ?? null,
                    payableRial: invoice?.payable_rial ?? null
                }
            });
        } catch (paymentError) {
            console.error("Aban invoice error:", paymentError?.message || paymentError);
            await supabase
                .from("orders")
                .update({ payment_status: "failed" })
                .eq("id", data.id);

            return res.status(502).json({
                success: false,
                message: paymentError?.message || "ایجاد لینک پرداخت ناموفق بود."
            });
        }
    } catch (error) {
        console.error("Order create error:", error?.message || error);
        return res.status(500).json({ success: false, message: "خطا در ثبت سفارش." });
    }
});

// Aban returns the customer to this public callback after payment.
// The callback never trusts a browser-provided success flag; verification
// is performed server-to-server with Aban.
router.get("/payment/callback", async (req, res) => {
    const invoiceId = String(
        req.query?.invoice_id || req.query?.invoiceId || ""
    ).trim();
    const orderCode = String(
        req.query?.order_id || req.query?.orderCode || ""
    ).trim();

    try {
        let query = supabase.from("orders").select("*").limit(1);
        if (invoiceId) query = query.eq("payment_invoice_id", invoiceId);
        else if (orderCode) query = query.eq("order_code", orderCode);
        else return res.status(400).send("شناسه پرداخت یا سفارش ارسال نشده است.");

        const { data: orders, error } = await query;
        if (error) throw error;
        const order = orders?.[0];
        if (!order) return res.status(404).send("سفارش پیدا نشد.");

        const actualInvoiceId = String(order.payment_invoice_id || invoiceId).trim();
        if (!actualInvoiceId) return res.status(400).send("شناسه فاکتور سفارش موجود نیست.");

        let verification;
        try {
            verification = await verifyAbanInvoice(actualInvoiceId);
        } catch (verifyError) {
            if (verifyError?.status !== 409) throw verifyError;
        }

        const { data: updated, error: updateError } = await supabase
            .from("orders")
            .update({
                payment_status: "paid",
                paid_at: order.payment_status === "paid" ? order.paid_at : new Date().toISOString()
            })
            .eq("id", order.id)
            .select("*")
            .single();

        if (updateError) throw updateError;

        const safeCode = String(updated.order_code).replace(/[<>&"']/g, "");
        const frontend = "https://sidewalk-menu-frontend.pages.dev/";
        return res.redirect(302, `${frontend}?payment=success&order_code=${encodeURIComponent(safeCode)}`);
    } catch (error) {
        console.error("Aban callback error:", error?.message || error);
        const code = encodeURIComponent(orderCode || "");
        const frontend = "https://sidewalk-menu-frontend.pages.dev/";
        return res.redirect(302, `${frontend}?payment=failed&order_code=${code}`);
    }
});

// Manual retry/status check for the frontend or support tooling.
router.get("/payment/verify/:invoiceId", async (req, res) => {
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) return res.status(400).json({ success: false, message: "شناسه فاکتور نامعتبر است." });

    try {
        const { data: order, error } = await supabase
            .from("orders")
            .select("*")
            .eq("payment_invoice_id", invoiceId)
            .maybeSingle();
        if (error) throw error;
        if (!order) return res.status(404).json({ success: false, message: "سفارش پیدا نشد." });

        if (order.payment_status === "paid") {
            return res.json({ success: true, verified: true, alreadyPaid: true, order: mapOrder(order) });
        }

        try {
            await verifyAbanInvoice(invoiceId);
        } catch (verifyError) {
            if (verifyError?.status !== 409) {
                return res.status(402).json({ success: false, verified: false, message: verifyError?.message || "پرداخت هنوز تأیید نشده است." });
            }
        }

        const { data: updated, error: updateError } = await supabase
            .from("orders")
            .update({ payment_status: "paid", paid_at: new Date().toISOString() })
            .eq("id", order.id)
            .select("*")
            .single();
        if (updateError) throw updateError;

        return res.json({ success: true, verified: true, order: mapOrder(updated) });
    } catch (error) {
        console.error("Aban verify error:", error?.message || error);
        return res.status(error?.status || 500).json({ success: false, message: error?.message || "تأیید پرداخت ناموفق بود." });
    }
});

// Public order-history endpoint for a returning customer. Scoped strictly
// to their own phone number — this is the same identifier they already
// typed in at checkout, never another customer's data.
router.get("/history/:phone", async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        if (!phone) {
            return res.status(400).json({ success: false, message: "شماره موبایل نامعتبر است." });
        }

        const { data, error } = await supabase
            .from("orders")
            .select("id,order_code,items,total,status,delivery_method,table_number,created_at,updated_at")
            .eq("customer_phone", phone)
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) {
            console.error("Order history error:", error.message);
            return res.status(500).json({ success: false, message: "خطا در دریافت تاریخچه سفارش‌ها." });
        }

        return res.json({ success: true, orders: (data || []).map(order => mapOrder(order)) });
    } catch (error) {
        console.error("Order history error:", error.message);
        return res.status(500).json({ success: false, message: "خطا در دریافت تاریخچه سفارش‌ها." });
    }
});

// Customer self-cancel, only while the order is still new and inside the
// cancellation window. Requires the same phone number used at checkout so
// a stranger who only knows the order code can't cancel someone's order.
router.post("/:orderCode/cancel", async (req, res) => {
    try {
        const orderCode = cleanString(req.params.orderCode, 40);
        const phone = normalizePhone(req.body?.customerPhone);

        if (!/^SW-[A-Z0-9]+-[A-Z0-9]+$/i.test(orderCode) || !phone) {
            return res.status(400).json({ success: false, message: "درخواست نامعتبر است." });
        }

        const { data: existing, error: fetchError } = await supabase
            .from("orders")
            .select("id,order_code,status,customer_phone,created_at")
            .eq("order_code", orderCode)
            .maybeSingle();

        if (fetchError || !existing) {
            return res.status(404).json({ success: false, message: "سفارش پیدا نشد." });
        }

        if (existing.customer_phone !== phone) {
            return res.status(403).json({ success: false, message: "شماره موبایل با سفارش مطابقت ندارد." });
        }

        if (!CUSTOMER_CANCELLABLE_STATUSES.has(existing.status)) {
            return res.status(409).json({ success: false, message: "این سفارش دیگر قابل لغو نیست، آماده‌سازی آن شروع شده است." });
        }

        const ageMs = Date.now() - new Date(existing.created_at).getTime();
        if (!Number.isFinite(ageMs) || ageMs > CUSTOMER_CANCEL_WINDOW_MS) {
            return res.status(409).json({ success: false, message: "زمان مجاز برای لغو سفارش به پایان رسیده است." });
        }

        const { data, error } = await supabase
            .from("orders")
            .update({ status: "لغو شد", updated_at: new Date().toISOString() })
            .eq("order_code", orderCode)
            .select()
            .single();

        if (error || !data) {
            return res.status(500).json({ success: false, message: "لغو سفارش انجام نشد." });
        }

        return res.json({ success: true, message: "سفارش با موفقیت لغو شد.", order: mapOrder(data, { publicView: true }) });
    } catch (error) {
        console.error("Order cancel error:", error.message);
        return res.status(500).json({ success: false, message: "لغو سفارش انجام نشد." });
    }
});

// Public tracking endpoint. Do not expose customer PII.
router.get("/:orderCode", async (req, res) => {
    try {
        const orderCode = cleanString(req.params.orderCode, 40);
        if (!/^SW-[A-Z0-9]+-[A-Z0-9]+$/i.test(orderCode)) {
            return res.status(404).json({ success: false, message: "سفارش پیدا نشد." });
        }

        const { data, error } = await supabase
            .from("orders")
            .select("id,order_code,items,total,status,delivery_method,created_at,updated_at")
            .eq("order_code", orderCode)
            .maybeSingle();

        if (error || !data) {
            return res.status(404).json({ success: false, message: "سفارش پیدا نشد." });
        }

        return res.json({ success: true, order: mapOrder(data, { publicView: true }) });
    } catch (error) {
        console.error("Order tracking error:", error.message);
        return res.status(500).json({ success: false, message: "خطا در دریافت وضعیت سفارش." });
    }
});

// Admin-only routes from this point onward.
router.use(verifyAdmin);

// Manual order entry from the admin panel (e.g. a walk-in customer taken
// by staff, without going through the customer-facing site). Phone number
// is optional here; everything else still goes through the same
// availability/price checks as a normal order.
function validateManualOrderBody(body = {}) {
    const customerName = cleanString(body.customerName, 100) || "مشتری حضوری";
    const customerPhone = normalizePhone(body.customerPhone);
    const tableNumber = cleanString(body.tableNumber, 20);
    const deliveryMethod = cleanString(body.deliveryMethod, 20) || "restaurant";
    const address = cleanString(body.address, 1000);
    const pickupEta = cleanString(body.pickupEta, 50);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!DELIVERY_METHODS.has(deliveryMethod)) {
        return { error: "روش تحویل نامعتبر است." };
    }

    if (items.length < 1 || items.length > 50) {
        return { error: "تعداد محصولات سفارش نامعتبر است." };
    }

    const quantityByProduct = new Map();
    for (const item of items) {
        const productId = String(item?.productId || "").trim();
        const quantity = Number(item?.quantity);
        if (!UUID_RE.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
            return { error: "اطلاعات یکی از محصولات نامعتبر است." };
        }
        quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + quantity);
    }

    return {
        value: {
            customerName,
            customerPhone,
            tableNumber: deliveryMethod === "restaurant" ? tableNumber : "",
            deliveryMethod,
            address: deliveryMethod === "delivery" ? address : "",
            pickupEta: deliveryMethod === "pickup" ? pickupEta : "",
            quantityByProduct
        }
    };
}

router.post("/manual", async (req, res) => {
    try {
        const validation = validateManualOrderBody(req.body);
        if (validation.error) {
            return res.status(400).json({ success: false, message: validation.error });
        }

        const { quantityByProduct, ...customer } = validation.value;
        const resolved = await resolveOrderItems(quantityByProduct);
        if (resolved.error) {
            return res.status(resolved.status).json({ success: false, message: resolved.error });
        }

        const { data, insertError } = await insertOrder({
            ...customer,
            items: resolved.items,
            total: resolved.total
        });

        if (insertError || !data) {
            console.error("Manual order insert error:", insertError?.message);
            return res.status(500).json({ success: false, message: "خطا در ثبت سفارش دستی." });
        }

        return res.status(201).json({
            success: true,
            message: "سفارش دستی با موفقیت ثبت شد.",
            order: mapOrder(data)
        });
    } catch (error) {
        console.error("Manual order create error:", error.message);
        return res.status(500).json({ success: false, message: "خطا در ثبت سفارش دستی." });
    }
});

router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500);

        if (error) {
            console.error("Orders list error:", error.message);
            return res.status(500).json({ success: false, message: "خطا در دریافت سفارش‌ها." });
        }

        return res.json({ success: true, orders: data.map(order => mapOrder(order)) });
    } catch (error) {
        console.error("Orders list error:", error.message);
        return res.status(500).json({ success: false, message: "خطا در دریافت سفارش‌ها." });
    }
});

router.put("/:orderCode/status", async (req, res) => {
    try {
        const orderCode = cleanString(req.params.orderCode, 40);
        const status = cleanString(req.body?.status, 50);
        if (!ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: "وضعیت نامعتبر است." });
        }

        const { data, error } = await supabase
            .from("orders")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("order_code", orderCode)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: "سفارش پیدا نشد." });
        }

        return res.json({ success: true, order: mapOrder(data) });
    } catch (error) {
        console.error("Order status update error:", error.message);
        return res.status(500).json({ success: false, message: "خطا در تغییر وضعیت سفارش." });
    }
});

router.delete("/:orderCode", async (req, res) => {
    try {
        const orderCode = cleanString(req.params.orderCode, 40);
        const { data, error } = await supabase
            .from("orders")
            .delete()
            .eq("order_code", orderCode)
            .select("id");

        if (error) {
            console.error("Order delete error:", error.message);
            return res.status(500).json({ success: false, message: "خطا در حذف سفارش." });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: "سفارش پیدا نشد." });
        }

        return res.json({ success: true, message: "سفارش حذف شد." });
    } catch (error) {
        console.error("Order delete error:", error.message);
        return res.status(500).json({ success: false, message: "خطا در حذف سفارش." });
    }
});

module.exports = router;
