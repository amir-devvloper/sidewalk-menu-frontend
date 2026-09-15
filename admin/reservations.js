(() => {
    "use strict";

    const STATUS_PENDING = "در انتظار پرداخت";
    const STATUS_CONFIRMED = "تایید شده";
    const STATUS_CANCELLED = "لغو شده";

    let reservations = [];
    let reservationsLoaded = false;
    let currentStatus = "all";
    let events = [];
    let editingEventId = null;

    const $ = id => document.getElementById(id);

    const reservationsNav = document.querySelector('.nav-item[data-view="reservations"]');
    const reservationsContainer = $("reservationsContainer");
    const reservationsEmptyState = $("reservationsEmptyState");
    const reservationsLoadingState = $("reservationsLoadingState");
    const reservationsRefreshBtn = $("reservationsRefreshBtn");
    const reservationStatusFilter = $("reservationStatusFilter");
    const reservationSettingsBtn = $("reservationSettingsBtn");

    const settingsModal = $("reservationSettingsModal");
    const settingsModalClose = $("reservationSettingsModalClose");
    const settingsModalOverlay = settingsModal?.querySelector(".modal-overlay");
    const settingsForm = $("reservationSettingsForm");
    const rsBasePrice = $("rs_basePrice");
    const rsSpecialDayEnabled = $("rs_specialDayEnabled");
    const rsSpecialDayPercent = $("rs_specialDayPercent");
    const rsEventEnabled = $("rs_eventEnabled");
    const rsSaveBtn = $("reservationSettingsSaveBtn");
    const eventsContainer = $("reservationEventsContainer");
    const eventsLoadingState = $("reservationEventsLoadingState");
    const addEventBtn = $("addReservationEventBtn");

    const eventModal = $("reservationEventModal");
    const eventModalClose = $("reservationEventModalClose");
    const eventModalOverlay = eventModal?.querySelector(".modal-overlay");
    const eventForm = $("reservationEventForm");
    const eventFormTitle = $("reservationEventFormTitle");
    const reTitle = $("re_title");
    const reEventDate = $("re_eventDate");
    const reStartTime = $("re_startTime");
    const reEndTime = $("re_endTime");
    const rePricePercent = $("re_pricePercent");
    const reActive = $("re_active");
    const eventSaveBtn = $("reservationEventSaveBtn");
    const eventCancelBtn = $("reservationEventCancelBtn");

    function apiUrl(path) {
        return `${API_BASE}/reservations/admin${path}`;
    }

    async function readJson(response) {
        let data = null;
        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }
        if (!response.ok) {
            throw new Error(data?.message || "خطا در ارتباط با سرور.");
        }
        return data || {};
    }

    function notify(message) {
        if (typeof showToast === "function") showToast(message);
    }

    function showReservationLoading() {
        reservationsContainer.innerHTML = "";
        reservationsEmptyState.classList.add("hidden");
        reservationsLoadingState.classList.remove("hidden");
    }

    function reservationDateObject(reservation) {
        const dateMatch = String(reservation.reservationDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const timeMatch = String(reservation.reservationTime || "").match(/^(\d{2}):(\d{2})/);
        if (!dateMatch) return null;
        const hour = timeMatch ? Number(timeMatch[1]) : 0;
        const minute = timeMatch ? Number(timeMatch[2]) : 0;
        const date = new Date(
            Number(dateMatch[1]),
            Number(dateMatch[2]) - 1,
            Number(dateMatch[3]),
            hour,
            minute,
            0,
            0
        );
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function reservationDateLabel(reservation) {
        const date = reservationDateObject(reservation);
        return date ? formatJalaliDateTime(date, { withTime: true }) : "تاریخ نامشخص";
    }

    function getReservationStatusClass(status) {
        if (status === STATUS_PENDING) return "status-payment-pending";
        if (status === STATUS_CONFIRMED) return "status-ready";
        if (status === STATUS_CANCELLED) return "status-cancelled";
        return "";
    }

    function createReservationCard(reservation) {
        const code = reservation.reservationCode || `#${reservation.id}`;
        const status = reservation.status || STATUS_PENDING;
        const statusClass = getReservationStatusClass(status);
        const noteHtml = reservation.note ? `
            <div class="order-note-box">
                <i class="fa-solid fa-note-sticky"></i>
                <span><strong>توضیحات مشتری:</strong> ${escapeHTML(reservation.note)}</span>
            </div>` : "";

        let statusActions = "";
        if (status === STATUS_PENDING) {
            statusActions = `
                <button class="action-btn primary-btn" data-reservation-action="status" data-id="${escapeHTML(reservation.id)}" data-status="${escapeHTML(STATUS_CONFIRMED)}">
                    <i class="fa-solid fa-check"></i> تایید دستی
                </button>
                <button class="action-btn" data-reservation-action="status" data-id="${escapeHTML(reservation.id)}" data-status="${escapeHTML(STATUS_CANCELLED)}">
                    <i class="fa-solid fa-ban"></i> لغو
                </button>`;
        } else if (status === STATUS_CONFIRMED) {
            statusActions = `
                <button class="action-btn" data-reservation-action="status" data-id="${escapeHTML(reservation.id)}" data-status="${escapeHTML(STATUS_CANCELLED)}">
                    <i class="fa-solid fa-ban"></i> لغو
                </button>`;
        }

        return `
            <article class="order-card" data-reservation-id="${escapeHTML(reservation.id)}">
                <div class="order-top">
                    <div>
                        <div class="order-code">${escapeHTML(code)}</div>
                        <div class="order-time">${escapeHTML(formatDate(reservation.createdAt))}</div>
                    </div>
                    <div class="order-top-badges">
                        <span class="status-badge ${statusClass}">${escapeHTML(status)}</span>
                    </div>
                </div>

                <div class="order-info">
                    <div class="info-item">
                        <span>مشتری</span>
                        <strong>${escapeHTML(reservation.name || "ثبت نشده")}</strong>
                    </div>
                    <div class="info-item">
                        <span>تماس</span>
                        <strong>${escapeHTML(reservation.phone || "ثبت نشده")}</strong>
                    </div>
                    <div class="info-item">
                        <span>تعداد مهمان</span>
                        <strong>${escapeHTML(toPersianDigits(reservation.guests ?? 0))} نفر</strong>
                    </div>
                    <div class="info-item">
                        <span>زمان رزرو</span>
                        <strong>${escapeHTML(reservationDateLabel(reservation))}</strong>
                    </div>
                </div>

                ${noteHtml}

                <div class="order-bottom">
                    <div class="total">${escapeHTML(formatPrice(reservation.amount))} <small>تومان</small></div>
                    <div class="order-actions">
                        ${statusActions}
                        <button class="action-btn delete-btn" data-reservation-action="delete" data-id="${escapeHTML(reservation.id)}">
                            <i class="fa-solid fa-trash"></i> حذف
                        </button>
                    </div>
                </div>
            </article>`;
    }

    function renderReservations() {
        reservationsLoadingState.classList.add("hidden");
        reservationsContainer.innerHTML = "";

        const visible = currentStatus === "all"
            ? reservations
            : reservations.filter(item => item.status === currentStatus);

        if (!visible.length) {
            reservationsEmptyState.classList.remove("hidden");
            return;
        }

        reservationsEmptyState.classList.add("hidden");
        reservationsContainer.innerHTML = visible.map(createReservationCard).join("");
    }

    async function loadReservations({ force = false } = {}) {
        if (reservationsLoaded && !force) {
            renderReservations();
            return;
        }

        showReservationLoading();
        try {
            const response = await authFetch(apiUrl(""));
            const data = await readJson(response);
            reservations = Array.isArray(data.reservations) ? data.reservations : [];
            reservationsLoaded = true;
            renderReservations();
        } catch (error) {
            console.error("Reservation load error:", error);
            reservationsLoadingState.classList.add("hidden");
            reservationsEmptyState.classList.remove("hidden");
            reservationsEmptyState.querySelector("h2").textContent = "دریافت رزروها ناموفق بود";
            reservationsEmptyState.querySelector("p").textContent = error.message;
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    async function updateReservationStatus(id, status) {
        if (![STATUS_PENDING, STATUS_CONFIRMED, STATUS_CANCELLED].includes(status)) return;

        try {
            const response = await authFetch(apiUrl(`/${encodeURIComponent(id)}/status`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            });
            const data = await readJson(response);
            const updated = data.reservation;
            if (updated) {
                reservations = reservations.map(item => String(item.id) === String(id) ? updated : item);
            } else {
                reservationsLoaded = false;
            }
            renderReservations();
            notify("وضعیت رزرو بروزرسانی شد.");
        } catch (error) {
            console.error("Reservation status error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    async function deleteReservation(id) {
        if (!confirm("این رزرو حذف شود؟ این عملیات قابل بازگشت نیست.")) return;

        try {
            const response = await authFetch(apiUrl(`/${encodeURIComponent(id)}`), { method: "DELETE" });
            await readJson(response);
            reservations = reservations.filter(item => String(item.id) !== String(id));
            renderReservations();
            notify("رزرو حذف شد.");
        } catch (error) {
            console.error("Reservation delete error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    function openModal(modal) {
        modal?.classList.remove("hidden");
    }

    function closeModal(modal) {
        modal?.classList.add("hidden");
    }

    async function openSettingsModal() {
        openModal(settingsModal);
        await Promise.all([loadReservationSettings(), loadReservationEvents()]);
    }

    async function loadReservationSettings() {
        try {
            const response = await authFetch(apiUrl("/settings"));
            const data = await readJson(response);
            const settings = data.settings || {};
            rsBasePrice.value = Number(settings.basePrice ?? 0);
            rsSpecialDayEnabled.checked = settings.specialDayEnabled !== false;
            rsSpecialDayPercent.value = Number(settings.specialDayPercent ?? 0);
            rsEventEnabled.checked = settings.eventEnabled !== false;
        } catch (error) {
            console.error("Reservation settings load error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    async function saveReservationSettings(event) {
        event.preventDefault();
        rsSaveBtn.disabled = true;
        try {
            const payload = {
                basePrice: Number(rsBasePrice.value),
                specialDayEnabled: rsSpecialDayEnabled.checked,
                specialDayPercent: Number(rsSpecialDayPercent.value),
                eventEnabled: rsEventEnabled.checked
            };
            const response = await authFetch(apiUrl("/settings"), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            await readJson(response);
            notify("تنظیمات رزرو ذخیره شد.");
        } catch (error) {
            console.error("Reservation settings save error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        } finally {
            rsSaveBtn.disabled = false;
        }
    }

    function eventDateToDate(eventDate) {
        const match = String(eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function eventDateLabel(eventDate) {
        const date = eventDateToDate(eventDate);
        return date ? formatJalaliDateTime(date, { withTime: false }) : "تاریخ نامشخص";
    }

    function renderEvents() {
        eventsLoadingState.classList.add("hidden");
        eventsContainer.innerHTML = "";

        if (!events.length) {
            eventsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
                    <h2>ایونتی ثبت نشده</h2>
                    <p>برای تاریخ‌های خاص می‌توانید افزایش قیمت تعریف کنید.</p>
                </div>`;
            return;
        }

        eventsContainer.innerHTML = events.map(item => {
            const timeParts = [];
            if (item.startTime) timeParts.push(`از ${escapeHTML(toPersianDigits(String(item.startTime).slice(0, 5)))}`);
            if (item.endTime) timeParts.push(`تا ${escapeHTML(toPersianDigits(String(item.endTime).slice(0, 5)))}`);
            const timeLabel = timeParts.length ? timeParts.join(" ") : "تمام روز";
            const activeLabel = item.active ? "فعال" : "غیرفعال";
            const activeClass = item.active ? "status-ready" : "status-cancelled";

            return `
                <article class="order-card" data-event-id="${escapeHTML(item.id)}">
                    <div class="order-top">
                        <div>
                            <div class="order-code">${escapeHTML(item.title)}</div>
                            <div class="order-time">${escapeHTML(eventDateLabel(item.eventDate))} — ${timeLabel}</div>
                        </div>
                        <div class="order-top-badges">
                            <span class="status-badge ${activeClass}">${activeLabel}</span>
                        </div>
                    </div>
                    <div class="order-info">
                        <div class="info-item">
                            <span>افزایش قیمت</span>
                            <strong>${escapeHTML(toPersianDigits(item.pricePercent ?? 0))}٪</strong>
                        </div>
                    </div>
                    <div class="order-bottom">
                        <div class="order-actions">
                            <button class="action-btn" data-event-action="toggle" data-id="${escapeHTML(item.id)}">
                                <i class="fa-solid fa-toggle-${item.active ? "on" : "off"}"></i> ${item.active ? "غیرفعال کردن" : "فعال کردن"}
                            </button>
                            <button class="action-btn primary-btn" data-event-action="edit" data-id="${escapeHTML(item.id)}">
                                <i class="fa-solid fa-pen"></i> ویرایش
                            </button>
                            <button class="action-btn delete-btn" data-event-action="delete" data-id="${escapeHTML(item.id)}">
                                <i class="fa-solid fa-trash"></i> حذف
                            </button>
                        </div>
                    </div>
                </article>`;
        }).join("");
    }

    async function loadReservationEvents() {
        eventsContainer.innerHTML = "";
        eventsLoadingState.classList.remove("hidden");
        try {
            const response = await authFetch(apiUrl("/events"));
            const data = await readJson(response);
            events = Array.isArray(data.events) ? data.events : [];
            renderEvents();
        } catch (error) {
            console.error("Reservation events load error:", error);
            eventsLoadingState.classList.add("hidden");
            eventsContainer.innerHTML = `<div class="empty-state"><h2>دریافت ایونت‌ها ناموفق بود</h2><p>${escapeHTML(error.message)}</p></div>`;
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    function resetEventForm() {
        editingEventId = null;
        eventForm.reset();
        reActive.checked = true;
        eventFormTitle.textContent = "ایونت جدید";
    }

    function openNewEventModal() {
        resetEventForm();
        openModal(eventModal);
        reTitle.focus();
    }

    function openEditEventModal(id) {
        const item = events.find(event => String(event.id) === String(id));
        if (!item) return;

        editingEventId = item.id;
        eventFormTitle.textContent = "ویرایش ایونت";
        reTitle.value = item.title || "";
        const date = eventDateToDate(item.eventDate);
        reEventDate.value = date ? formatJalaliInputDate(date) : "";
        reStartTime.value = item.startTime ? String(item.startTime).slice(0, 5) : "";
        reEndTime.value = item.endTime ? String(item.endTime).slice(0, 5) : "";
        rePricePercent.value = Number(item.pricePercent ?? 0);
        reActive.checked = item.active !== false;
        openModal(eventModal);
    }

    function formatApiDate(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    async function saveEvent(event) {
        event.preventDefault();

        const parsedDate = parseJalaliDateInput(reEventDate.value);
        if (!parsedDate) {
            notify("تاریخ ایونت معتبر نیست. نمونه: ۱۴۰۵/۰۶/۲۴");
            reEventDate.focus();
            return;
        }

        const payload = {
            title: reTitle.value.trim(),
            eventDate: formatApiDate(parsedDate),
            startTime: reStartTime.value || null,
            endTime: reEndTime.value || null,
            pricePercent: Number(rePricePercent.value),
            active: reActive.checked
        };

        eventSaveBtn.disabled = true;
        const wasEditing = Boolean(editingEventId);
        try {
            const path = editingEventId ? `/events/${encodeURIComponent(editingEventId)}` : "/events";
            const method = editingEventId ? "PUT" : "POST";
            const response = await authFetch(apiUrl(path), {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            await readJson(response);
            closeModal(eventModal);
            resetEventForm();
            await loadReservationEvents();
            notify(wasEditing ? "ایونت ویرایش شد." : "ایونت ثبت شد.");
        } catch (error) {
            console.error("Reservation event save error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        } finally {
            eventSaveBtn.disabled = false;
        }
    }

    async function toggleEvent(id) {
        const item = events.find(event => String(event.id) === String(id));
        if (!item) return;
        try {
            const response = await authFetch(apiUrl(`/events/${encodeURIComponent(id)}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !item.active })
            });
            const data = await readJson(response);
            if (data.event) {
                events = events.map(event => String(event.id) === String(id) ? data.event : event);
                renderEvents();
            } else {
                await loadReservationEvents();
            }
        } catch (error) {
            console.error("Reservation event toggle error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    async function deleteEvent(id) {
        if (!confirm("این ایونت حذف شود؟")) return;
        try {
            const response = await authFetch(apiUrl(`/events/${encodeURIComponent(id)}`), { method: "DELETE" });
            await readJson(response);
            events = events.filter(item => String(item.id) !== String(id));
            renderEvents();
            notify("ایونت حذف شد.");
        } catch (error) {
            console.error("Reservation event delete error:", error);
            if (error.message !== "Unauthorized") notify(error.message);
        }
    }

    reservationsNav?.addEventListener("click", () => {
        if (!reservationsLoaded) loadReservations();
    });

    reservationsRefreshBtn?.addEventListener("click", () => loadReservations({ force: true }));

    reservationStatusFilter?.addEventListener("click", event => {
        const button = event.target.closest(".status-filter-btn");
        if (!button) return;
        reservationStatusFilter.querySelectorAll(".status-filter-btn").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        currentStatus = button.dataset.value || "all";
        renderReservations();
    });

    reservationsContainer?.addEventListener("click", event => {
        const button = event.target.closest("[data-reservation-action]");
        if (!button) return;
        event.stopPropagation();
        const id = button.dataset.id;
        if (button.dataset.reservationAction === "status") {
            updateReservationStatus(id, button.dataset.status);
        } else if (button.dataset.reservationAction === "delete") {
            deleteReservation(id);
        }
    });

    reservationSettingsBtn?.addEventListener("click", openSettingsModal);
    settingsModalClose?.addEventListener("click", () => closeModal(settingsModal));
    settingsModalOverlay?.addEventListener("click", () => closeModal(settingsModal));
    settingsForm?.addEventListener("submit", saveReservationSettings);

    addEventBtn?.addEventListener("click", openNewEventModal);
    eventModalClose?.addEventListener("click", () => closeModal(eventModal));
    eventModalOverlay?.addEventListener("click", () => closeModal(eventModal));
    eventCancelBtn?.addEventListener("click", () => closeModal(eventModal));
    eventForm?.addEventListener("submit", saveEvent);

    eventsContainer?.addEventListener("click", event => {
        const button = event.target.closest("[data-event-action]");
        if (!button) return;
        const id = button.dataset.id;
        const action = button.dataset.eventAction;
        if (action === "edit") openEditEventModal(id);
        if (action === "toggle") toggleEvent(id);
        if (action === "delete") deleteEvent(id);
    });
})();
