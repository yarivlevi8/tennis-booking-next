import { trainingTypeLabels, type TrainingType } from "@/types/booking";

interface TrainingTypeOption {
  value: TrainingType;
  label: string;
}

interface TrainingTypeSelectorProps {
  value: TrainingType;
  error?: string;
  onChange: (trainingType: TrainingType) => void;
}

const TRAINING_TYPE_OPTIONS: TrainingTypeOption[] = [
  {
    value: "single",
    label: trainingTypeLabels.single,
  },
  {
    value: "couple",
    label: trainingTypeLabels.couple,
  },
];

export function TrainingTypeSelector({
  value,
  error,
  onChange,
}: TrainingTypeSelectorProps) {
  const errorId = error ? "training-type-error" : undefined;

  return (
    <fieldset className="booking-section" aria-describedby={errorId}>
      <legend>סוג אימון</legend>
      <div className="training-type-pills">
        {TRAINING_TYPE_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              className="training-type-button"
              type="button"
              key={option.value}
              aria-pressed={isSelected}
              data-selected={isSelected}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="field-error" id="training-type-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
