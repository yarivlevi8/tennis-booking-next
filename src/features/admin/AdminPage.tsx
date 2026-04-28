"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminBooking,
  AdminBookingsResponse,
  AdminBookingStatus,
  AdminSessionResponse,
} from "@/types/admin";
import { TRAINING_LOCATION } from "@/config/bookingConfig";
import styles from "./AdminPage.module.css";

type AuthState = "checking" | "authenticated" | "unauthenticated";
type StatusFilter = "all" | AdminBookingStatus;
type Notice = { type: "success" | "error"; text: string };
type LoadBookingsOptions = {
  keepNotice?: boolean;
};

const LOGIN_INVALID_ERROR = "שם המשתמש או הסיסמה שגויים";
const GENERIC_ERROR = "משהו השתבש. כדאי לנסות שוב.";
const SESSION_EXPIRED_MESSAGE = "החיבור לניהול פג. יש להתחבר מחדש.";
const UPDATE_SUCCESS_MESSAGE = "ההזמנה עודכנה בהצלחה";
const RESTORE_CONFLICT_MESSAGE =
  "לא ניתן להחזיר את ההזמנה, השעה כבר תפוסה";
const FRIDAY_DAY_INDEX = 5;
const SEARCH_DEBOUNCE_MS = 300;
const HEBREW_DAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

const trainingTypeLabels: Record<AdminBooking["trainingType"], string> = {
  single: "אימון יחיד",
  couple: "אימון זוגי",
};

const statusLabels: Record<AdminBookingStatus, string> = {
  confirmed: "מאושר",
  cancelled: "מבוטל",
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${day}.${month}.${year}`;
}

function formatCreatedAt(createdAt: string) {
  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

function isBookingsResponse(value: unknown): value is AdminBookingsResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as AdminBookingsResponse).bookings)
  );
}

interface CalendarDay {
  key: string;
  dayNumber?: number;
  dateString?: string;
  isFriday: boolean;
  isSelected: boolean;
  isToday: boolean;
}

function toStableDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseStableDateString(dateString: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    return null;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, monthsToAdd: number) {
  return new Date(date.getFullYear(), date.getMonth() + monthsToAdd, 1);
}

function getCalendarMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getCalendarDays(monthDate: Date, selectedDate: string): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toStableDateString(new Date());
  const days: CalendarDay[] = [];

  for (let index = 0; index < firstDayOfMonth.getDay(); index += 1) {
    days.push({
      key: `empty-start-${index}`,
      isFriday: false,
      isSelected: false,
      isToday: false,
    });
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const date = new Date(year, month, dayNumber);
    const dateString = toStableDateString(date);

    days.push({
      key: dateString,
      dayNumber,
      dateString,
      isFriday: date.getDay() === FRIDAY_DAY_INDEX,
      isSelected: dateString === selectedDate,
      isToday: dateString === today,
    });
  }

  while (days.length % HEBREW_DAY_LABELS.length !== 0) {
    days.push({
      key: `empty-end-${days.length}`,
      isFriday: false,
      isSelected: false,
      isToday: false,
    });
  }

  return days;
}

function buildBookingsUrl(
  statusFilter: StatusFilter,
  dateFilter: string,
  searchQuery: string,
) {
  const params = new URLSearchParams();
  const trimmedDate = dateFilter.trim();
  const trimmedSearchQuery = searchQuery.trim();

  if (statusFilter !== "all") {
    params.set("status", statusFilter);
  }

  if (trimmedDate) {
    params.set("date", trimmedDate);
  }

  if (trimmedSearchQuery) {
    params.set("q", trimmedSearchQuery);
  }

  const queryString = params.toString();

  return queryString
    ? `/api/admin/bookings?${queryString}`
    : "/api/admin/bookings";
}

export function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getMonthStart(new Date()),
  );
  const [loginError, setLoginError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(
    null,
  );

  const bookingsUrl = useMemo(
    () => buildBookingsUrl(statusFilter, dateFilter, debouncedSearchQuery),
    [dateFilter, debouncedSearchQuery, statusFilter],
  );
  const calendarDays = useMemo(
    () => getCalendarDays(calendarMonth, dateFilter),
    [calendarMonth, dateFilter],
  );
  const calendarMonthTitle = useMemo(
    () => getCalendarMonthTitle(calendarMonth),
    [calendarMonth],
  );
  const hasActiveSearch = debouncedSearchQuery.trim().length > 0;

  const returnToLogin = useCallback((message = SESSION_EXPIRED_MESSAGE) => {
    setAuthState("unauthenticated");
    setBookings([]);
    setNotice(null);
    setLoginError("");
    setAuthMessage(message);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    let isCurrentRequest = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Failed to check session");
        }

        const data = (await response.json()) as AdminSessionResponse;

        if (!isCurrentRequest) {
          return;
        }

        if (data.authenticated) {
          setAuthMessage("");
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
        }
      } catch {
        if (isCurrentRequest) {
          setAuthState("unauthenticated");
          setAuthMessage(GENERIC_ERROR);
        }
      }
    }

    void checkSession();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const loadBookings = useCallback(
    async (options: LoadBookingsOptions = {}) => {
      if (authState !== "authenticated") {
        return;
      }

      if (!options.keepNotice) {
        setNotice(null);
      }

      setIsLoadingBookings(true);

      try {
        const response = await fetch(bookingsUrl, {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
          credentials: "same-origin",
        });

        if (response.status === 401) {
          returnToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load bookings");
        }

        const data = (await response.json()) as unknown;

        setBookings(isBookingsResponse(data) ? data.bookings : []);
      } catch {
        setNotice({ type: "error", text: GENERIC_ERROR });
      } finally {
        setIsLoadingBookings(false);
      }
    },
    [authState, bookingsUrl, returnToLogin],
  );

  useEffect(() => {
    if (authState === "authenticated") {
      void loadBookings();
    }
  }, [authState, loadBookings]);

  function handleCalendarDateSelect(dateString: string) {
    const selectedDate = parseStableDateString(dateString);

    if (!selectedDate || selectedDate.getDay() !== FRIDAY_DAY_INDEX) {
      return;
    }

    setDateFilter(toStableDateString(selectedDate));
    setCalendarMonth(getMonthStart(selectedDate));
  }

  function handleClearDateFilter() {
    setDateFilter("");
  }

  function handleCalendarMonthChange(monthsToAdd: number) {
    setCalendarMonth((currentMonth) => addMonths(currentMonth, monthsToAdd));
  }

  function handleClearSearch() {
    setSearchInput("");
    setDebouncedSearchQuery("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    setIsLoggingIn(true);
    setLoginError("");
    setAuthMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        credentials: "same-origin",
      });

      if (response.status === 401) {
        setLoginError(LOGIN_INVALID_ERROR);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to log in");
      }

      form.reset();
      setBookings([]);
      setNotice(null);
      setAuthState("authenticated");
    } catch {
      setLoginError(GENERIC_ERROR);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setNotice(null);

    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        credentials: "same-origin",
      });
    } finally {
      setIsLoggingOut(false);
      setBookings([]);
      setStatusFilter("all");
      setDateFilter("");
      setSearchInput("");
      setDebouncedSearchQuery("");
      setCalendarMonth(getMonthStart(new Date()));
      setLoginError("");
      setAuthMessage("");
      setAuthState("unauthenticated");
    }
  }

  async function handleStatusChange(
    booking: AdminBooking,
    nextStatus: AdminBookingStatus,
  ) {
    setUpdatingBookingId(booking.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/bookings/${encodeURIComponent(booking.id)}/status`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
          credentials: "same-origin",
        },
      );

      if (response.status === 401) {
        returnToLogin();
        return;
      }

      if (response.status === 409) {
        setNotice({ type: "error", text: RESTORE_CONFLICT_MESSAGE });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to update booking");
      }

      setNotice({ type: "success", text: UPDATE_SUCCESS_MESSAGE });
      await loadBookings({ keepNotice: true });
    } catch {
      setNotice({ type: "error", text: GENERIC_ERROR });
    } finally {
      setUpdatingBookingId(null);
    }
  }

  if (authState === "checking") {
    return (
      <main className={styles.adminPage} lang="he" dir="rtl">
        <section className={styles.loginShell} aria-live="polite">
          <div className={styles.loginCard}>
            <p className={styles.loadingText}>בודק חיבור לניהול...</p>
          </div>
        </section>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <main className={styles.adminPage} lang="he" dir="rtl">
        <section className={styles.loginShell} aria-labelledby="admin-login-title">
          <form className={styles.loginCard} onSubmit={handleLogin}>
            <header className={styles.loginHeader}>
              <h1 id="admin-login-title">כניסה לניהול</h1>
              <p>יש להזין שם משתמש וסיסמה כדי לנהל את ההזמנות.</p>
            </header>

            {authMessage ? (
              <p className={styles.errorMessage} role="alert">
                {authMessage}
              </p>
            ) : null}

            <label className={styles.formField} htmlFor="admin-username">
              <span>שם משתמש</span>
              <input
                id="admin-username"
                name="username"
                type="text"
                placeholder="שם משתמש"
                autoComplete="username"
                disabled={isLoggingIn}
                required
              />
            </label>

            <label className={styles.formField} htmlFor="admin-password">
              <span>סיסמה</span>
              <input
                id="admin-password"
                name="password"
                type="password"
                placeholder="סיסמה"
                autoComplete="current-password"
                disabled={isLoggingIn}
                required
              />
            </label>

            {loginError ? (
              <p className={styles.errorMessage} role="alert">
                {loginError}
              </p>
            ) : null}

            <button
              className={styles.primaryButton}
              type="submit"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "מתחבר..." : "כניסה"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.adminPage} lang="he" dir="rtl">
      <section className={styles.adminShell} aria-labelledby="admin-title">
        <header className={styles.adminHeader}>
          <div>
            <p className={styles.connectedLabel}>מחובר לניהול</p>
            <h1 id="admin-title">ניהול הזמנות</h1>
            <p>צפייה, ביטול והחזרת הזמנות אימון.</p>
          </div>

          <div className={styles.topActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void loadBookings()}
              disabled={isLoadingBookings || updatingBookingId !== null}
            >
              רענון
            </button>
            <button
              className={styles.ghostButton}
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              יציאה
            </button>
          </div>
        </header>

        <div className={styles.filters} aria-label="סינון הזמנות">
          <div className={styles.filterControls}>
            <label
              className={styles.filterField}
              htmlFor="booking-status-filter"
            >
              <span>סטטוס</span>
              <select
                id="booking-status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.currentTarget.value as StatusFilter)
                }
              >
                <option value="all">הכל</option>
                <option value="confirmed">מאושר</option>
                <option value="cancelled">מבוטל</option>
              </select>
            </label>

            <label
              className={`${styles.filterField} ${styles.searchField}`}
              htmlFor="booking-search-filter"
            >
              <span>חיפוש לפי שם או טלפון</span>
              <input
                id="booking-search-filter"
                type="search"
                value={searchInput}
                placeholder="שם מלא או מספר טלפון"
                onChange={(event) => setSearchInput(event.currentTarget.value)}
              />
            </label>

            <div className={styles.filterActions}>
              <button
                className={styles.ghostButton}
                type="button"
                onClick={handleClearSearch}
                disabled={!searchInput.trim() && !debouncedSearchQuery.trim()}
              >
                ניקוי חיפוש
              </button>
              {hasActiveSearch ? (
                <p className={styles.searchHint}>
                  מוצגת היסטוריית אימונים לפי החיפוש
                </p>
              ) : null}
            </div>
          </div>

          <section
            className={styles.calendarFilter}
            aria-labelledby="booking-calendar-title"
          >
            <div className={styles.calendarTopline}>
              <div>
                <span
                  className={styles.filterLabel}
                  id="booking-calendar-title"
                >
                  תאריך
                </span>
                <p className={styles.selectedDateText}>
                  {dateFilter ? `נבחר: ${formatDate(dateFilter)}` : "לא נבחר תאריך"}
                </p>
              </div>
              <button
                className={styles.ghostButton}
                type="button"
                onClick={handleClearDateFilter}
                disabled={!dateFilter}
              >
                ניקוי תאריך
              </button>
            </div>

            <div className={styles.calendarHeader}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => handleCalendarMonthChange(-1)}
              >
                חודש קודם
              </button>
              <strong>{calendarMonthTitle}</strong>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => handleCalendarMonthChange(1)}
              >
                חודש הבא
              </button>
            </div>

            <div
              className={styles.calendarGrid}
              role="grid"
              aria-labelledby="booking-calendar-title"
            >
              {HEBREW_DAY_LABELS.map((dayLabel) => (
                <span
                  className={styles.calendarWeekday}
                  key={dayLabel}
                  role="columnheader"
                >
                  {dayLabel}
                </span>
              ))}
              {calendarDays.map((day) => {
                if (!day.dateString) {
                  return (
                    <span
                      className={styles.calendarDayEmpty}
                      key={day.key}
                      aria-hidden="true"
                    />
                  );
                }

                const dateString = day.dateString;

                return (
                  <button
                    className={styles.calendarDay}
                    data-friday={day.isFriday}
                    data-selected={day.isSelected}
                    data-today={day.isToday}
                    type="button"
                    key={day.key}
                    disabled={!day.isFriday}
                    aria-pressed={day.isFriday ? day.isSelected : undefined}
                    aria-label={
                      day.isFriday
                        ? formatDate(dateString)
                        : `${formatDate(dateString)}, לא ניתן לבחור`
                    }
                    onClick={() => handleCalendarDateSelect(dateString)}
                  >
                    {day.dayNumber}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {notice ? (
          <p
            className={
              notice.type === "success"
                ? styles.successMessage
                : styles.errorMessage
            }
            role="status"
          >
            {notice.text}
          </p>
        ) : null}

        {isLoadingBookings ? (
          <p className={styles.loadingText}>טוען הזמנות...</p>
        ) : bookings.length === 0 ? (
          <p className={styles.emptyState}>לא נמצאו הזמנות</p>
        ) : (
          <section className={styles.bookingsPanel} aria-label="רשימת הזמנות">
            <div className={styles.bookingsHeader} aria-hidden="true">
              <span>תאריך</span>
              <span>שעה</span>
              <span>סוג אימון</span>
              <span>מיקום</span>
              <span>שם מלא</span>
              <span>טלפון</span>
              <span>הערות</span>
              <span>סטטוס</span>
              <span>נוצר בתאריך</span>
              <span>פעולות</span>
            </div>

            <div className={styles.bookingsList}>
              {bookings.map((booking) => {
                const nextStatus =
                  booking.status === "confirmed" ? "cancelled" : "confirmed";
                const actionLabel =
                  booking.status === "confirmed"
                    ? "ביטול הזמנה"
                    : "החזרה למאושר";

                return (
                  <article className={styles.bookingRow} key={booking.id}>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>תאריך</span>
                      <span>{formatDate(booking.date)}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>שעה</span>
                      <span>{booking.time}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>סוג אימון</span>
                      <span>{trainingTypeLabels[booking.trainingType]}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>מיקום</span>
                      <span>{TRAINING_LOCATION}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>שם מלא</span>
                      <span>{booking.fullName}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>טלפון</span>
                      <a href={`tel:${booking.phone}`}>{booking.phone}</a>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>הערות</span>
                      <span>{booking.notes?.trim() || "אין הערות"}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>סטטוס</span>
                      <span
                        className={styles.statusBadge}
                        data-status={booking.status}
                      >
                        {statusLabels[booking.status]}
                      </span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>נוצר בתאריך</span>
                      <span>{formatCreatedAt(booking.createdAt)}</span>
                    </div>
                    <div className={styles.bookingCell}>
                      <span className={styles.cellLabel}>פעולות</span>
                      <button
                        className={
                          booking.status === "confirmed"
                            ? styles.dangerButton
                            : styles.primaryButton
                        }
                        type="button"
                        disabled={updatingBookingId !== null}
                        onClick={() =>
                          void handleStatusChange(booking, nextStatus)
                        }
                      >
                        {updatingBookingId === booking.id
                          ? "מעדכן..."
                          : actionLabel}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
