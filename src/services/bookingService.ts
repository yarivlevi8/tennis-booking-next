import type {
  BookingConfirmationData,
  BookingRequest,
  TimeSlot,
} from "@/types/booking";

interface AvailabilityResponse {
  slots: TimeSlot[];
}

export const bookingService = {
  async getAvailableSlots(date: string): Promise<TimeSlot[]> {
    if (!date) {
      return [];
    }

    const response = await fetch(
      `/api/availability?date=${encodeURIComponent(date)}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to load availability");
    }

    const data = (await response.json()) as AvailabilityResponse;

    return Array.isArray(data.slots) ? data.slots : [];
  },

  async createBooking(
    request: BookingRequest,
  ): Promise<BookingConfirmationData> {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error("Failed to create booking");
    }

    return (await response.json()) as BookingConfirmationData;
  },
};
