/**
 * ============================================================================
 * CONTACT FORM  (src/components/ContactForm.tsx)  ·  React component
 * ============================================================================
 *
 * The inquiry form on /contact/. It sends the data to /contact.php, a small
 * PHP script on the Hostinger server that emails it to you (public/contact.php).
 *
 * TWO WAYS IT CAN BE SENT
 * - With JavaScript (normal case): React sends the data in the background with
 *   fetch() and shows "Sending…", then a thank-you message, without leaving the page.
 * - Without JavaScript: the browser posts the form normally and the PHP script
 *   redirects to /thank-you/ or /message-error/.
 *
 * REACT CONCEPTS USED HERE
 * - "Controlled inputs": every field's value lives in React state (`values`).
 *   Typing calls handleChange, which updates the state, which re-renders the field.
 * - useEffect with an empty array [] runs once, right after the form appears.
 * - A small child component (<Field>) avoids repeating the label markup.
 *
 * IMPORTANT: the lists `shootTypes` and `referralSources` must match the lists
 * in public/contact.php, otherwise the server rejects the choice.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode, SubmitEvent } from 'react';
import { site } from '../site.config';
import './ContactForm.css';

/** The four states the form can be in */
type Status = 'idle' | 'sending' | 'success' | 'error';

/** All field values. The keys match the `name` attribute of each input. */
interface FormValues {
  name: string;
  email: string;
  partnerName: string;
  phone: string;
  date: string;
  venue: string;
  shootType: string;
  message: string;
  referral: string;
  consent: boolean;
}

const initialValues: FormValues = {
  name: '',
  email: '',
  partnerName: '',
  phone: '',
  date: '',
  venue: '',
  shootType: '',
  message: '',
  referral: '',
  consent: false,
};

/** Options for "Type of shooting". Keep in sync with public/contact.php */
export const shootTypes = [
  'Wedding',
  'Elopement',
  'Couple Session',
  'Pre Wedding',
  'Surprise Proposal',
  'Maternity',
  'Others',
];

/** Options for "How did you hear about me?". Keep in sync with public/contact.php */
export const referralSources = ['Google', 'Instagram', 'TikTok', 'Pinterest', 'Event', 'Referral'];

export default function ContactForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  // When the form appeared. The server rejects forms sent faster than 3 seconds (typical for bots).
  const [startedAt, setStartedAt] = useState('');

  useEffect(() => {
    setStartedAt(String(Date.now()));
  }, []);

  /**
   * One handler for every field. `event.target.name` tells us which field changed.
   * `[name]: next` is a "computed key": it updates only that property.
   */
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = event.target;
    const next = type === 'checkbox' ? (event.target as HTMLInputElement).checked : value;
    setValues((previous) => ({ ...previous, [name]: next }));
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); // don't reload the page, we send it ourselves
    const form = event.currentTarget;

    // Use the browser's built-in validation (required fields, email format)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form), // collects all fields by their `name`
        headers: { Accept: 'application/json' }, // ask PHP for a JSON answer instead of a redirect
      });
      const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (response.ok && result?.ok) {
        setStatus('success');
        setValues(initialValues);
      } else {
        setStatus('error');
        setErrorMessage(result?.error ?? 'Something went wrong.');
      }
    } catch {
      // Network problem (offline, server unreachable)
      setStatus('error');
      setErrorMessage('The message could not be sent. Please check your connection.');
    }
  }

  // After a successful send, the form is replaced by a thank-you message
  if (status === 'success') {
    return (
      <div className="form-status success" role="status">
        <p className="caps-title">Thank you!</p>
        <p>
          Your message is on its way. I do my best to respond to every inquiry within 48 hours. If you don't
          hear from me by then, please check your spam folder or write to <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" action="/contact.php" method="post" onSubmit={handleSubmit} noValidate>
      <div className="field-row">
        <Field label="Full name" required>
          <input name="name" type="text" autoComplete="name" required maxLength={200} value={values.name} onChange={handleChange} />
        </Field>
        <Field label="Email address" required>
          <input name="email" type="email" autoComplete="email" required maxLength={200} value={values.email} onChange={handleChange} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Partner's name">
          <input name="partnerName" type="text" maxLength={200} value={values.partnerName} onChange={handleChange} />
        </Field>
        <Field label="Phone number">
          <input name="phone" type="tel" autoComplete="tel" maxLength={50} value={values.phone} onChange={handleChange} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Date" required>
          <input name="date" type="date" required value={values.date} onChange={handleChange} />
        </Field>
        <Field label="Venue" required>
          <input
            name="venue"
            type="text"
            required
            maxLength={200}
            placeholder="or the area, e.g. Dolomites"
            value={values.venue}
            onChange={handleChange}
          />
        </Field>
      </div>

      <Field label="Type of shooting" required>
        <select name="shootType" required value={values.shootType} onChange={handleChange}>
          <option value="" disabled>
            Select option
          </option>
          {shootTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Message" required>
        <textarea name="message" rows={5} required maxLength={5000} value={values.message} onChange={handleChange} />
      </Field>

      <Field label="How did you hear about me?" required>
        <select name="referral" required value={values.referral} onChange={handleChange}>
          <option value="" disabled>
            Select option
          </option>
          {referralSources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </Field>

      {/* Honeypot: hidden from people, but bots fill in every field. Filled = rejected. */}
      <div className="hp" aria-hidden="true">
        <label>
          Leave this field empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="startedAt" value={startedAt} />

      {/* GDPR: consent to process the inquiry, with a link to the privacy policy */}
      <label className="consent">
        <input name="consent" type="checkbox" value="yes" required checked={values.consent} onChange={handleChange} />
        <span>
          I agree that my details are used to answer my inquiry. More in the{' '}
          <a href="/privacy/" target="_blank">
            privacy policy
          </a>
          . *
        </span>
      </label>

      {status === 'error' && (
        <p className="form-status error" role="alert">
          {errorMessage} You can also write directly to <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      )}

      <div className="center">
        <button className="button" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
      </div>

      <p className="response-note">
        I do my best to respond to every inquiry within <strong>48 hours</strong>. If you don't hear from me by then,
        please check your spam folder, or reach out directly at <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </form>
  );
}

/**
 * A form field: label on top, input below.
 * `children` is whatever is written between <Field> and </Field>.
 */
function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && ' *'}
      </span>
      {children}
    </label>
  );
}
