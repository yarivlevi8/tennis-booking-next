"use client";

import { useEffect, useMemo, useState } from "react";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { BookingForm } from "@/components/booking/BookingForm";
import {
  DateSelector,
  type FridayOption,
} from "@/components/booking/DateSelector";
import { TimeSlotPicker } from "@/components/booking/TimeSlotPicker";
import { TrainingTypeSelector } from "@/components/booking/TrainingTypeSelector";
import { bookingService } from "@/services/bookingService";
import {
  trainingTypeLabels,
  type BookingConfirmationData,
  type BookingRequest,
  type TimeSlot,
  type TrainingType,
} from "@/types/booking";

interface FormValues {
  fullName: string;
  phone: string;
  notes: string;
}

interface ValidationErrors {
  date?: string;
  time?: string;
  trainingType?: string;
  fullName?: string;
  phone?: string;
  submit?: string;
}

const EMPTY_FORM_VALUES: FormValues = {
  fullName: "",
  phone: "",
  notes: "",
};

const FRIDAY_DAY_INDEX = 5;

function toStableDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getNextTwoFridayOptions(referenceDate = new Date()): FridayOption[] {
  const daysUntilFriday =
    (FRIDAY_DAY_INDEX - referenceDate.getDay() + 7) % 7;
  const firstFriday = addLocalDays(referenceDate, daysUntilFriday);
  const secondFriday = addLocalDays(firstFriday, 7);

  return [firstFriday, secondFriday].map((date) => {
    const value = toStableDateString(date);

    return {
      value,
      weekdayLabel: "יום שישי",
      dateLabel: formatShortDate(value),
      ariaLabel: formatFridayDisplay(value),
    };
  });
}

function formatShortDate(dateString: string) {
  const [, month, day] = dateString.split("-");

  return `${day}.${month}`;
}

function formatFridayDisplay(dateString: string) {
  if (!dateString) {
    return "";
  }

  return `יום שישי, ${formatShortDate(dateString)}`;
}

function isValidIsraeliPhone(phone: string) {
  const normalized = phone.trim().replace(/[\s-]/g, "");

  return /^0\d{8,9}$/.test(normalized) || /^\+972\d{8,9}$/.test(normalized);
}

function validateBooking(
  date: string,
  selectedTime: string,
  trainingType: TrainingType,
  slots: TimeSlot[],
  values: FormValues,
) {
  const errors: ValidationErrors = {};
  const selectedSlot = slots.find((slot) => slot.time === selectedTime);

  if (!date) {
    errors.date = "יש לבחור יום שישי";
  }

  if (!selectedTime || !selectedSlot) {
    errors.time = "יש לבחור שעה פנויה";
  }

  if (!trainingType) {
    errors.trainingType = "יש לבחור סוג אימון";
  }

  if (!values.fullName.trim()) {
    errors.fullName = "יש להזין שם מלא";
  }

  if (!isValidIsraeliPhone(values.phone)) {
    errors.phone = "יש להזין מספר טלפון תקין";
  }

  return errors;
}

export function BookingPage() {
  const fridayOptions = useMemo(() => getNextTwoFridayOptions(), []);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [trainingType, setTrainingType] = useState<TrainingType>("single");
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM_VALUES);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] =
    useState<BookingConfirmationData | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    if (!selectedDate) {
      setTimeSlots([]);
      setSelectedTime("");
      return;
    }

    setIsLoadingSlots(true);
    setSelectedTime("");

    bookingService
      .getAvailableSlots(selectedDate)
      .then((slots) => {
        if (isCurrentRequest) {
          setTimeSlots(slots);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setTimeSlots([]);
          setErrors((currentErrors) => ({
            ...currentErrors,
            time: "לא הצלחנו לטעון שעות פנויות. נסו לבחור יום אחר.",
          }));
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoadingSlots(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setErrors((currentErrors) => ({
      ...currentErrors,
      date: undefined,
      time: undefined,
      submit: undefined,
    }));
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setErrors((currentErrors) => ({
      ...currentErrors,
      time: undefined,
      submit: undefined,
    }));
  };

  const handleTrainingTypeChange = (nextTrainingType: TrainingType) => {
    setTrainingType(nextTrainingType);
    setErrors((currentErrors) => ({
      ...currentErrors,
      trainingType: undefined,
      submit: undefined,
    }));
  };

  const handleFormChange = (field: keyof FormValues, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      submit: undefined,
    }));
  };

  const handleSubmit = async () => {
    const nextErrors = validateBooking(
      selectedDate,
      selectedTime,
      trainingType,
      timeSlots,
      formValues,
    );

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const bookingRequest: BookingRequest = {
      date: selectedDate,
      time: selectedTime,
      trainingType,
      fullName: formValues.fullName.trim(),
      phone: formValues.phone.trim(),
      notes: formValues.notes.trim() || undefined,
    };

    setIsSubmitting(true);
    setErrors({});

    try {
      const bookingConfirmation =
        await bookingService.createBooking(bookingRequest);
      setConfirmation(bookingConfirmation);
    } catch {
      setErrors({
        submit: "לא הצלחנו לקבוע את האימון. נסו שוב בעוד רגע.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    setSelectedDate("");
    setSelectedTime("");
    setTrainingType("single");
    setFormValues(EMPTY_FORM_VALUES);
    setTimeSlots([]);
    setErrors({});
    setConfirmation(null);
  };

  if (confirmation) {
    return (
      <main className="booking-page" lang="he" dir="rtl">
        <BookingConfirmation
          confirmation={confirmation}
          formattedDate={formatFridayDisplay(confirmation.date)}
          onBookAnother={handleBookAnother}
        />
      </main>
    );
  }

  return (
    <main className="booking-page" lang="he" dir="rtl">
      <section className="booking-card" aria-labelledby="booking-title">
        <header className="booking-intro">
          <h1 id="booking-title">קביעת אימון טניס</h1>
          <p>
            יש לבחור יום שישי פנוי, לבחור שעה מתאימה ולהשאיר פרטים קצרים
            לתיאום האימון.
          </p>
        </header>

        <aside className="booking-summary-strip" aria-label="האימון שנבחר">
          <h2>האימון שנבחר</h2>
          {!selectedDate ? (
            <p>לא נבחר אימון עדיין</p>
          ) : (
            <dl>
              <div>
                <dt>תאריך</dt>
                <dd>{formatFridayDisplay(selectedDate)}</dd>
              </div>
              <div>
                <dt>שעה</dt>
                <dd>{selectedTime || "טרם נבחרה שעה"}</dd>
              </div>
              <div>
                <dt>סוג אימון</dt>
                <dd>{trainingTypeLabels[trainingType]}</dd>
              </div>
            </dl>
          )}
        </aside>

        <div className="booking-flow">
          <DateSelector
            options={fridayOptions}
            selectedDate={selectedDate}
            error={errors.date}
            onChange={handleDateChange}
          />

          <TimeSlotPicker
            slots={timeSlots}
            selectedTime={selectedTime}
            hasSelectedDate={Boolean(selectedDate)}
            isLoading={isLoadingSlots}
            error={errors.time}
            onSelect={handleTimeSelect}
          />

          <TrainingTypeSelector
            value={trainingType}
            error={errors.trainingType}
            onChange={handleTrainingTypeChange}
          />

          <section className="booking-section form-section">
            <h2>פרטים לתיאום</h2>
            <BookingForm
              values={formValues}
              errors={errors}
              isSubmitting={isSubmitting}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
            />
            {errors.submit ? (
              <p className="submit-error" role="alert" aria-live="assertive">
                {errors.submit}
              </p>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
