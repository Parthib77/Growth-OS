import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Field, type Status } from './ui';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function DialogFrame({
  titleId,
  closeLabel,
  onClose,
  children,
}: {
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : [];
    focusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button className="close" onClick={onClose} aria-label={closeLabel}>
          Close
        </button>
        {children}
      </section>
    </div>
  );
}

export type DialogCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  service: string;
  source: string;
  quotedMoney: { currency: string; minorUnits: number } | null;
  consent: { channel: string; decision: string } | null;
  lifecycle: string;
  lastInteractionAt: string;
  reasons?: string[];
  nextAction?: string;
};

export function TodayDialogs({
  selected,
  showCustomer,
  showBooking,
  status,
  onCloseCustomer,
  onOpenBooking,
  onCloseBooking,
  onCustomerSubmit,
  onBookingSubmit,
}: {
  selected: DialogCustomer | null;
  showCustomer: boolean;
  showBooking: boolean;
  status: Status;
  onCloseCustomer: () => void;
  onOpenBooking: () => void;
  onCloseBooking: () => void;
  onCustomerSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBookingSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      {selected && !showBooking && (
        <DialogFrame
          titleId="customer-title"
          closeLabel="Close customer details"
          onClose={onCloseCustomer}
        >
          <h2 id="customer-title">
            {selected.firstName} {selected.lastName}
          </h2>
          <dl className="facts">
            <div>
              <dt>Service</dt>
              <dd>{selected.service}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{selected.source}</dd>
            </div>
            <div>
              <dt>Consent</dt>
              <dd>
                {selected.consent?.decision === 'granted'
                  ? `Granted for ${selected.consent.channel}`
                  : 'Needs review'}
              </dd>
            </div>
            <div>
              <dt>Quoted value</dt>
              <dd>
                {selected.quotedMoney
                  ? `${selected.quotedMoney.currency} ${(selected.quotedMoney.minorUnits / 100).toFixed(2)}`
                  : 'Not provided'}
              </dd>
            </div>
          </dl>
          <p className="reason-box">
            <strong>Why this is here</strong>
            <br />
            {selected.reasons?.join(' · ')}
          </p>
          {selected.consent?.decision === 'granted' && (
            <button className="button primary" onClick={onOpenBooking}>
              Record booking
            </button>
          )}
          <p className="muted small">
            A booking is stored with an idempotency key and appears in Results.
          </p>
        </DialogFrame>
      )}
      {showCustomer && (
        <DialogFrame
          titleId="customer-form-title"
          closeLabel="Close add enquiry"
          onClose={onCloseCustomer}
        >
          <h2 id="customer-form-title">Add an enquiry</h2>
          <form onSubmit={onCustomerSubmit}>
            <div className="form-grid">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" required={false} />
              <Field label="Phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" />
              <Field label="Email" name="email" type="email" required={false} />
              <Field label="Service" name="service" defaultValue="Consultation" />
              <Field label="Source" name="source" defaultValue="Phone call" />
              <Field
                label="Quoted value (cents)"
                name="quotedMinorUnits"
                type="number"
                required={false}
              />
              <label className="field">
                <span>Consent channel</span>
                <select name="consentChannel" defaultValue="whatsapp">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <label className="field">
                <span>Consent decision</span>
                <select name="consentDecision" defaultValue="granted">
                  <option value="granted">Granted</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
            </div>
            <button className="button primary" disabled={status.kind === 'pending'}>
              {status.kind === 'pending' ? 'Saving…' : 'Save enquiry'}
            </button>
          </form>
        </DialogFrame>
      )}
      {showBooking && selected && (
        <DialogFrame
          titleId="booking-title"
          closeLabel="Close booking form"
          onClose={onCloseBooking}
        >
          <h2 id="booking-title">Record booking</h2>
          <form onSubmit={onBookingSubmit}>
            <Field label="Service" name="service" defaultValue={selected.service} />
            <Field label="Appointment" name="appointmentAt" type="datetime-local" />
            <Field
              label="Agreed value (cents)"
              name="agreedMinorUnits"
              type="number"
              defaultValue={String(selected.quotedMoney?.minorUnits || 0)}
            />
            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={3} />
            </label>
            <button className="button primary" disabled={status.kind === 'pending'}>
              {status.kind === 'pending' ? 'Recording…' : 'Record booking'}
            </button>
          </form>
        </DialogFrame>
      )}
    </>
  );
}
