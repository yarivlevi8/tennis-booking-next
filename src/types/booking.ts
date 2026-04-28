export type TrainingType = "single" | "couple";

export const trainingTypeLabels: Record<TrainingType, string> = {
  single: "אימון יחיד",
  couple: "אימון זוגי",
};

export interface TimeSlot {
  time: string;
}

export interface BookingRequest {
  date: string;
  time: string;
  trainingType: TrainingType;
  fullName: string;
  phone: string;
  notes?: string;
}

export interface BookingConfirmationData {
  date: string;
  time: string;
  trainingType: TrainingType;
  fullName: string;
  phone: string;
  notes?: string;
}
