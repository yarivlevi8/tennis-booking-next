import {
  trainingTypeLabels,
  type BookingConfirmationData,
} from "@/types/booking";
import { TRAINING_LOCATION } from "@/config/bookingConfig";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
} from "@/utils/calendar";

interface BookingConfirmationProps {
  confirmation: BookingConfirmationData;
  formattedDate: string;
  onBookAnother: () => void;
}

export function BookingConfirmation({
  confirmation,
  formattedDate,
  onBookAnother,
}: BookingConfirmationProps) {
  const googleCalendarUrl = buildGoogleCalendarUrl(confirmation);

  return (
    <section className="confirmation-panel" aria-labelledby="confirmation-title">
      <p className="confirmation-kicker">הבקשה התקבלה</p>
      <h1 id="confirmation-title">האימון נקבע בהצלחה</h1>
      <p className="confirmation-message" aria-live="polite">
        פרטי האימון נשמרו וניצור קשר במידת הצורך.
      </p>
      <dl className="confirmation-details">
        <div>
          <dt>תאריך</dt>
          <dd>{formattedDate}</dd>
        </div>
        <div>
          <dt>שעה</dt>
          <dd>{confirmation.time}</dd>
        </div>
        <div>
          <dt>סוג אימון</dt>
          <dd>{trainingTypeLabels[confirmation.trainingType]}</dd>
        </div>
        <div>
          <dt>מיקום האימון</dt>
          <dd>{TRAINING_LOCATION}</dd>
        </div>
        <div>
          <dt>שם מלא</dt>
          <dd>{confirmation.fullName}</dd>
        </div>
        <div>
          <dt>טלפון</dt>
          <dd>{confirmation.phone}</dd>
        </div>
        {confirmation.notes ? (
          <div>
            <dt>הערות</dt>
            <dd>{confirmation.notes}</dd>
          </div>
        ) : null}
      </dl>

      <p className="calendar-helper">
        ניתן להוסיף את האימון ליומן האישי כדי לקבל תזכורת.
      </p>

      <div className="confirmation-actions" aria-label="פעולות יומן">
        <a
          className="primary-action"
          href={googleCalendarUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          הוספה ל-Google Calendar
        </a>
        <button
          className="secondary-action"
          type="button"
          onClick={() => downloadIcsFile(confirmation)}
        >
          הורדת קובץ יומן
        </button>
      </div>

      <button className="tertiary-action" type="button" onClick={onBookAnother}>
        קביעת אימון נוסף
      </button>
    </section>
  );
}
