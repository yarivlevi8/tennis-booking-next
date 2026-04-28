import type { TrainingType } from "@/types/booking";

export type AdminBookingStatus = "confirmed" | "cancelled";

export interface AdminBooking {
  id: string;
  date: string;
  time: string;
  trainingType: TrainingType;
  fullName: string;
  phone: string;
  notes: string | null;
  status: AdminBookingStatus;
  createdAt: string;
  googleEventId?: string;
}

export interface AdminSessionResponse {
  authenticated: boolean;
}

export interface AdminBookingsResponse {
  bookings: AdminBooking[];
}
