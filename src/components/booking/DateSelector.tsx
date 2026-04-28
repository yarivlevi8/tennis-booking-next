export interface FridayOption {
  value: string;
  weekdayLabel: string;
  dateLabel: string;
  ariaLabel: string;
}

interface DateSelectorProps {
  options: FridayOption[];
  selectedDate: string;
  error?: string;
  onChange: (date: string) => void;
}

export function DateSelector({
  options,
  selectedDate,
  error,
  onChange,
}: DateSelectorProps) {
  const errorId = error ? "booking-date-error" : undefined;

  return (
    <fieldset className="booking-section" aria-describedby={errorId}>
      <legend>בחירת יום שישי</legend>
      <p className="section-helper">
        האימונים זמינים בימי שישי בלבד. ניתן לבחור אחד משני ימי השישי הקרובים.
      </p>
      <div className="friday-options">
        {options.map((option) => {
          const isSelected = selectedDate === option.value;

          return (
            <button
              className="friday-button"
              type="button"
              key={option.value}
              aria-label={option.ariaLabel}
              aria-pressed={isSelected}
              data-selected={isSelected}
              onClick={() => onChange(option.value)}
            >
              <span>{option.weekdayLabel}</span>
              <strong>{option.dateLabel}</strong>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="field-error" id="booking-date-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
