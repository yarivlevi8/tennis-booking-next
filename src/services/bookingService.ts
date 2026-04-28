import type {
  BookingConfirmationData,
  BookingRequest,
  TimeSlot,
} from "@/types/booking";

const FIRST_FRIDAY_SLOTS = ["08:00", "09:00", "10:00", "12:00"];
const SECOND_FRIDAY_SLOTS = ["09:00", "11:00", "13:00"];
const FRIDAY_DAY_INDEX = 5;

const delay = (durationMs: number) =>
  new Promise((resolve) => window.setTimeout(resolve, durationMs));

function toStableDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getNextTwoFridayDateStrings(referenceDate = new Date()) {
  const daysUntilFriday =
    (FRIDAY_DAY_INDEX - referenceDate.getDay() + 7) % 7;
  const firstFriday = addLocalDays(referenceDate, daysUntilFriday);
  const secondFriday = addLocalDays(firstFriday, 7);

  return [toStableDateString(firstFriday), toStableDateString(secondFriday)];
}

function toTimeSlots(times: string[]): TimeSlot[] {
  return times.map((time) => ({ time }));
}

export const bookingService = {
  async getAvailableSlots(date: string): Promise<TimeSlot[]> {
    // TODO: Replace this mock with GET /api/availability?date=YYYY-MM-DD.
    // TODO: Validate availability server-side with Google Calendar FreeBusy.
    // TODO: Enforce Friday-only availability rules server-side.
    await delay(250);

    if (!date) {
      return [];
    }

    const [firstFriday, secondFriday] = getNextTwoFridayDateStrings();

    if (date === firstFriday) {
      return toTimeSlots(FIRST_FRIDAY_SLOTS);
    }

    if (date === secondFriday) {
      return toTimeSlots(SECOND_FRIDAY_SLOTS);
    }

    return [];
  },

  async createBooking(
    request: BookingRequest,
  ): Promise<BookingConfirmationData> {
    // TODO: Replace this mock with POST /api/bookings.
    // TODO: Prevent double-booking server-side before creating the booking.
    // TODO: Validate training type server-side before creating the booking.
    await delay(500);

    return {
      date: request.date,
      time: request.time,
      trainingType: request.trainingType,
      fullName: request.fullName,
      phone: request.phone,
      notes: request.notes,
    };
  },
};
