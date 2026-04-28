interface BookingFormValues {
  fullName: string;
  phone: string;
  notes: string;
}

interface BookingFormErrors {
  fullName?: string;
  phone?: string;
}

interface BookingFormProps {
  values: BookingFormValues;
  errors: BookingFormErrors;
  isSubmitting: boolean;
  onChange: (field: keyof BookingFormValues, value: string) => void;
  onSubmit: () => void;
}

export function BookingForm({
  values,
  errors,
  isSubmitting,
  onChange,
  onSubmit,
}: BookingFormProps) {
  return (
    <form
      className="customer-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="booking-field">
        <label htmlFor="full-name">שם מלא</label>
        <input
          id="full-name"
          type="text"
          value={values.fullName}
          placeholder="שם מלא"
          autoComplete="name"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "full-name-error" : undefined}
          onChange={(event) => onChange("fullName", event.target.value)}
        />
        {errors.fullName ? (
          <p className="field-error" id="full-name-error">
            {errors.fullName}
          </p>
        ) : null}
      </div>

      <div className="booking-field">
        <label htmlFor="phone">טלפון</label>
        <input
          id="phone"
          type="tel"
          value={values.phone}
          placeholder="מספר טלפון"
          autoComplete="tel"
          inputMode="tel"
          dir="rtl"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          onChange={(event) => onChange("phone", event.target.value)}
        />
        {errors.phone ? (
          <p className="field-error" id="phone-error">
            {errors.phone}
          </p>
        ) : null}
      </div>

      <div className="booking-field">
        <label htmlFor="notes">הערות</label>
        <textarea
          id="notes"
          value={values.notes}
          rows={4}
          placeholder="אפשר לציין רמת משחק, מטרה לאימון או כל דבר שחשוב לדעת מראש"
          onChange={(event) => onChange("notes", event.target.value)}
        />
      </div>

      <button className="primary-action" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "קובע אימון..." : "קביעת אימון"}
      </button>
    </form>
  );
}
