(function () {
    "use strict";

    const API_BASE_URL =
        window.SIDEWALK_API_URL || "https://sidewalk-menu-backend.onrender.com/api";

    // Business hours for the time-slot picker (30-minute steps).
    const OPEN_HOUR = 12;
    const OPEN_MINUTE = 0;
    const CLOSE_HOUR = 23;
    const CLOSE_MINUTE = 30;
    const MAX_GUESTS = 30;
    const MIN_GUESTS = 1;

    // ---------------------------------------------------------------
    // Jalali <-> Gregorian conversion (same algorithm used in the admin
    // panel's report date pickers — kept dependency-free on purpose).
    // ---------------------------------------------------------------
    function div(a, b) {
        return Math.floor(a / b);
    }

    function gregorianToJalali(gy, gm, gd) {
        const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        const gy2 = gm > 2 ? gy + 1 : gy;

        let days =
            355666 +
            365 * gy +
            div(gy2 + 3, 4) -
            div(gy2 + 99, 100) +
            div(gy2 + 399, 400) +
            gd +
            gDaysInMonth[gm - 1];

        let jy = -1595 + 33 * div(days, 12053);
        days %= 12053;
        jy += 4 * div(days, 1461);
        days %= 1461;

        if (days > 365) {
            jy += div(days - 1, 365);
            days = (days - 1) % 365;
        }

        const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
        const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

        return [jy, jm, jd];
    }

    function jalaliToGregorian(jy, jm, jd) {
        const jy2 = jy + 1595;

        let days =
            -355668 +
            365 * jy2 +
            div(jy2, 33) * 8 +
            div((jy2 % 33) + 3, 4) +
            jd +
            (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

        let gy = 400 * div(days, 146097);
        days %= 146097;

        if (days > 36524) {
            gy += 100 * div(--days, 36524);
            days %= 36524;
            if (days >= 365) days++;
        }

        gy += 4 * div(days, 1461);
        days %= 1461;

        if (days > 365) {
            gy += div(days - 1, 365);
            days = (days - 1) % 365;
        }

        let gd = days + 1;
        const gDaysInMonth = [
            0, 31,
            (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31
        ];

        let gm;
        for (gm = 0; gm < 13 && gd > gDaysInMonth[gm]; gm++) {
            gd -= gDaysInMonth[gm];
        }

        return [gy, gm, gd];
    }

    function toPersianDigits(value) {
        return String(value ?? "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
    }

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function isJalaliLeapYear(jy) {
        // Days-in-month for Esfand (month 12) depends on leap year; derive it
        // by converting the last possible day and checking overflow.
        const [gy1, gm1, gd1] = jalaliToGregorian(jy, 12, 30);
        const [checkJy, checkJm, checkJd] = gregorianToJalali(gy1, gm1, gd1);
        return checkJy === jy && checkJm === 12 && checkJd === 30;
    }

    function jalaliMonthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isJalaliLeapYear(jy) ? 30 : 29;
    }

    const JALALI_MONTH_NAMES = [
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ];

    function todayJalali() {
        const now = new Date();
        return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    function todayDateString() {
        return new Date().toISOString().slice(0, 10);
    }

    // ---------------------------------------------------------------
    // DOM references
    // ---------------------------------------------------------------
    const openBtn = document.getElementById("openReservationBtn");
    const modal = document.getElementById("reservationModal");
    const overlay = document.getElementById("reservationModalOverlay");
    const closeBtn = document.getElementById("reservationModalClose");

    const stepForm = document.getElementById("reservationStepForm");
    const stepCalendar = document.getElementById("reservationStepCalendar");

    const form = document.getElementById("reservationForm");
    const nameInput = document.getElementById("rsv_name");
    const phoneInput = document.getElementById("rsv_phone");
    const guestsInput = document.getElementById("rsv_guests");
    const guestsMinus = document.getElementById("rsv_guestsMinus");
    const guestsPlus = document.getElementById("rsv_guestsPlus");
    const dateTrigger = document.getElementById("rsv_dateTrigger");
    const dateLabel = document.getElementById("rsv_dateLabel");
    const timeSlotsWrap = document.getElementById("rsv_timeSlots");
    const noteInput = document.getElementById("rsv_note");
    const amountEl = document.getElementById("rsv_amount");
    const errorEl = document.getElementById("reservationError");
    const submitBtn = document.getElementById("reservationSubmitBtn");
    const submitSpinner = document.getElementById("reservationSubmitSpinner");

    const monthLabel = document.getElementById("jalaliMonthLabel");
    const daysGrid = document.getElementById("jalaliDaysGrid");
    const prevMonthBtn = document.getElementById("jalaliPrevMonth");
    const nextMonthBtn = document.getElementById("jalaliNextMonth");
    const backToFormBtn = document.getElementById("jalaliBackToForm");

    if (!modal || !form) return; // markup not present on this page

    let selectedDate = null; // "YYYY-MM-DD" (Gregorian, sent to the API)
    let selectedTime = null; // "HH:mm"
    let viewJy, viewJm;

    // ---------------------------------------------------------------
    // Modal open/close
    // ---------------------------------------------------------------
    function openModal() {
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("no-scroll");
        showFormStep();
    }

    function closeModal() {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("no-scroll");
    }

    openBtn?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    overlay?.addEventListener("click", closeModal);
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
    });

    function showFormStep() {
        stepForm.classList.remove("hidden");
        stepCalendar.classList.add("hidden");
    }

    function showCalendarStep() {
        stepForm.classList.add("hidden");
        stepCalendar.classList.remove("hidden");
        renderCalendar();
    }

    dateTrigger?.addEventListener("click", showCalendarStep);
    backToFormBtn?.addEventListener("click", showFormStep);

    // ---------------------------------------------------------------
    // Guests stepper
    // ---------------------------------------------------------------
    function setGuests(value) {
        const clamped = Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, value));
        guestsInput.value = String(clamped);
    }

    guestsMinus?.addEventListener("click", () => setGuests(Number(guestsInput.value) - 1));
    guestsPlus?.addEventListener("click", () => setGuests(Number(guestsInput.value) + 1));

    // ---------------------------------------------------------------
    // Time slots (click only)
    // ---------------------------------------------------------------
    function buildTimeSlots() {
        timeSlotsWrap.innerHTML = "";
        let h = OPEN_HOUR;
        let m = OPEN_MINUTE;

        while (h < CLOSE_HOUR || (h === CLOSE_HOUR && m <= CLOSE_MINUTE)) {
            const label = `${pad2(h)}:${pad2(m)}`;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "time-slot";
            btn.textContent = toPersianDigits(label);
            btn.dataset.time = label;
            btn.addEventListener("click", () => {
                selectedTime = label;
                timeSlotsWrap.querySelectorAll(".time-slot").forEach(el => el.classList.remove("active"));
                btn.classList.add("active");
            });
            timeSlotsWrap.appendChild(btn);

            m += 30;
            if (m >= 60) { m = 0; h += 1; }
        }
    }

    buildTimeSlots();

    // ---------------------------------------------------------------
    // Jalali calendar rendering
    // ---------------------------------------------------------------
    function renderCalendar() {
        if (!viewJy) {
            const [jy, jm] = todayJalali();
            viewJy = jy;
            viewJm = jm;
        }

        monthLabel.textContent = `${JALALI_MONTH_NAMES[viewJm - 1]} ${toPersianDigits(viewJy)}`;

        const [gy, gm, gd] = jalaliToGregorian(viewJy, viewJm, 1);
        const firstOfMonth = new Date(gy, gm - 1, gd);
        const jsWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat
        // Persian week starts Saturday: Sat=0, Sun=1, Mon=2 ... Fri=6
        const leadingBlanks = (jsWeekday + 1) % 7;

        const monthLength = jalaliMonthLength(viewJy, viewJm);
        const todayStr = todayDateString();

        daysGrid.innerHTML = "";

        for (let i = 0; i < leadingBlanks; i++) {
            const blank = document.createElement("span");
            blank.className = "jalali-day jalali-day--empty";
            daysGrid.appendChild(blank);
        }

        for (let day = 1; day <= monthLength; day++) {
            const [dgy, dgm, dgd] = jalaliToGregorian(viewJy, viewJm, day);
            const dateStr = `${dgy}-${pad2(dgm)}-${pad2(dgd)}`;
            const weekday = new Date(dgy, dgm - 1, dgd).getDay(); // 0=Sun..6=Sat

            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "jalali-day";
            cell.textContent = toPersianDigits(day);

            if (weekday === 4 || weekday === 5) cell.classList.add("jalali-day--weekend");
            if (dateStr < todayStr) cell.classList.add("jalali-day--disabled");
            if (dateStr === selectedDate) cell.classList.add("jalali-day--selected");

            cell.addEventListener("click", () => {
                selectedDate = dateStr;
                dateLabel.textContent = `${toPersianDigits(day)} ${JALALI_MONTH_NAMES[viewJm - 1]} ${toPersianDigits(viewJy)}`;
                showFormStep();
                fetchPrice();
            });

            daysGrid.appendChild(cell);
        }
    }

    prevMonthBtn?.addEventListener("click", () => {
        viewJm -= 1;
        if (viewJm < 1) { viewJm = 12; viewJy -= 1; }
        renderCalendar();
    });

    nextMonthBtn?.addEventListener("click", () => {
        viewJm += 1;
        if (viewJm > 12) { viewJm = 1; viewJy += 1; }
        renderCalendar();
    });

    // ---------------------------------------------------------------
    // Live price
    // ---------------------------------------------------------------
    async function fetchPrice() {
        if (!selectedDate) return;
        amountEl.textContent = "در حال محاسبه...";
        try {
            const response = await fetch(`${API_BASE_URL}/reservations/price?date=${encodeURIComponent(selectedDate)}`);
            const data = await response.json();
            if (data.success) {
                amountEl.textContent = `${toPersianDigits(Number(data.amount).toLocaleString("en-US"))} تومان`;
            } else {
                amountEl.textContent = "—";
            }
        } catch (_) {
            amountEl.textContent = "—";
        }
    }

    // ---------------------------------------------------------------
    // Submit
    // ---------------------------------------------------------------
    function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
    }

    function clearError() {
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
    }

    function setSubmitting(isSubmitting) {
        submitBtn.disabled = isSubmitting;
        submitSpinner.classList.toggle("hidden", !isSubmitting);
    }

    form.addEventListener("submit", async e => {
        e.preventDefault();
        clearError();

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const guests = Number(guestsInput.value);

        if (name.length < 2) return showError("لطفاً نام خود را وارد کنید.");
        if (!/^09\d{9}$/.test(phone)) return showError("شماره موبایل معتبر نیست.");
        if (!selectedDate) return showError("لطفاً تاریخ رزرو را انتخاب کنید.");
        if (!selectedTime) return showError("لطفاً ساعت رزرو را انتخاب کنید.");

        setSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/reservations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    phone,
                    guests,
                    reservationDate: selectedDate,
                    reservationTime: selectedTime,
                    note: noteInput.value.trim()
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                showError(data.message || "ثبت رزرو با خطا مواجه شد.");
                setSubmitting(false);
                return;
            }

            if (data.payment?.paymentUrl) {
                window.location.href = data.payment.paymentUrl;
            } else {
                showError("لینک پرداخت دریافت نشد.");
                setSubmitting(false);
            }
        } catch (_) {
            showError("ارتباط با سرور برقرار نشد.");
            setSubmitting(false);
        }
    });
})();
