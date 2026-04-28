import type { TimeSlot } from "@/types/booking";

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedTime: string;
  hasSelectedDate: boolean;
  isLoading: boolean;
  error?: string;
  onSelect: (time: string) => void;
}

export function TimeSlotPicker({
  slots,
  selectedTime,
  hasSelectedDate,
  isLoading,
  error,
  onSelect,
}: TimeSlotPickerProps) {
  const errorId = error ? "booking-time-error" : undefined;

  return (
    <fieldset className="booking-section" aria-describedby={errorId}>
      <legend>שעות פנויות</legend>
      {!hasSelectedDate ? (
        <p className="slot-empty-state">יש לבחור יום שישי כדי לראות שעות פנויות.</p>
      ) : null}
      {hasSelectedDate ? (
        <div className="time-slot-panel">
          <p className="section-helper">אלו השעות הפנויות ליום שישי שנבחר.</p>
          {isLoading ? <p className="slot-status">בודק שעות פנויות...</p> : null}
          {!isLoading && slots.length === 0 ? (
            <p className="slot-status">אין שעות פנויות ליום שישי שנבחר.</p>
          ) : null}
          {!isLoading && slots.length > 0 ? (
            <div className="time-slot-grid">
              {slots.map((slot) => {
                const isSelected = selectedTime === slot.time;

                return (
                  <button
                    className="time-slot-button"
                    type="button"
                    key={slot.time}
                    aria-pressed={isSelected}
                    data-selected={isSelected}
                    onClick={() => onSelect(slot.time)}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="field-error" id="booking-time-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
