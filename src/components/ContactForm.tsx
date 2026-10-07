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
 *
 * LANGUAGES: the `lang` prop picks the texts below. The values sent to the
 * server always stay English (so contact.php understands them); only what the
 * visitor reads is translated. A hidden "lang" field tells contact.php which
 * language to answer in.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode, SubmitEvent } from 'react';
import { site } from '../site.config';
import { routes, type Lang } from '../i18n';
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
  guestCount: string;
  budget: string;
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
  guestCount: '',
  budget: '',
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

/** Options for "Investment you have in mind". Keep in sync with public/contact.php */
export const budgetRanges = [
  'Under €3,000',
  '€3,000 – €5,000',
  '€5,000 – €8,000',
  '€8,000+',
  "I'd like guidance",
];

/** Options for "How did you hear about me?". Keep in sync with public/contact.php */
export const referralSources = ['Google', 'Instagram', 'TikTok', 'Pinterest', 'Event', 'Referral'];

/** German labels for the options above (the values sent stay English) */
const optionLabelsDe: Record<string, string> = {
  Wedding: 'Hochzeit',
  Elopement: 'Elopement',
  'Couple Session': 'Paarshooting',
  'Pre Wedding': 'Pre-Wedding-Shooting',
  'Surprise Proposal': 'Überraschender Heiratsantrag',
  Maternity: 'Babybauch-Shooting',
  Others: 'Etwas anderes',
  'Under €3,000': 'Unter 3.000 €',
  '€3,000 – €5,000': '3.000 – 5.000 €',
  '€5,000 – €8,000': '5.000 – 8.000 €',
  '€8,000+': 'Über 8.000 €',
  "I'd like guidance": 'Ich hätte gern eine Beratung',
  Event: 'Veranstaltung',
  Referral: 'Empfehlung',
};

/** Everything the visitor reads, per language */
const texts = {
  en: {
    thanksTitle: 'Thank you!',
    thanks: "Your message is on its way. I do my best to respond to every inquiry within 48 hours. If you don't hear from me by then, please check your spam folder or write to",
    sendError: 'Something went wrong.',
    offline: 'The message could not be sent. Please check your connection.',
    name: 'Full name',
    email: 'Email address',
    partner: "Partner's name",
    phone: 'Phone number',
    date: 'Date or dates',
    datePlaceholder: 'e.g. 14 June 2027, or 12–15 June',
    venue: 'Venue',
    venuePlaceholder: 'or the area, e.g. Dolomites',
    type: 'Type of shooting',
    select: 'Select option',
    guests: 'Estimated guest count',
    budget: 'Investment you have in mind',
    message: 'Message',
    referral: 'How did you hear about me?',
    honeypot: 'Leave this field empty',
    consentBefore: 'I agree that my details are used to answer my inquiry. More in the',
    consentLink: 'privacy policy',
    directly: 'You can also write directly to',
    sending: 'Sending…',
    send: 'Send message',
    noteBefore: 'I do my best to respond to every inquiry within',
    noteHours: '48 hours',
    noteAfter: "If you don't hear from me by then, please check your spam folder, or reach out directly at",
  },
  de: {
    thanksTitle: 'Danke!',
    thanks: 'Eure Nachricht ist unterwegs. Ich antworte auf jede Anfrage so schnell wie möglich, meist innerhalb von 48 Stunden. Falls ihr bis dahin nichts von mir hört, schaut bitte in euren Spam-Ordner oder schreibt an',
    sendError: 'Etwas ist schiefgelaufen.',
    offline: 'Die Nachricht konnte nicht gesendet werden. Bitte prüft eure Internetverbindung.',
    name: 'Vor- und Nachname',
    email: 'E-Mail-Adresse',
    partner: 'Name eures Partners oder eurer Partnerin',
    phone: 'Telefonnummer',
    date: 'Datum oder Zeitraum',
    datePlaceholder: 'z. B. 14. Juni 2027 oder 12.–15. Juni',
    venue: 'Location',
    venuePlaceholder: 'oder die Gegend, z. B. Dolomiten',
    type: 'Art des Shootings',
    select: 'Bitte wählen',
    guests: 'Ungefähre Gästezahl',
    budget: 'Euer geplantes Budget',
    message: 'Nachricht',
    referral: 'Wie habt ihr von mir erfahren?',
    honeypot: 'Dieses Feld bitte leer lassen',
    consentBefore: 'Ich bin einverstanden, dass meine Angaben zur Beantwortung meiner Anfrage verwendet werden. Mehr in der',
    consentLink: 'Datenschutzerklärung',
    directly: 'Ihr könnt mir auch direkt schreiben:',
    sending: 'Wird gesendet…',
    send: 'Nachricht senden',
    noteBefore: 'Ich antworte auf jede Anfrage so schnell wie möglich, meist innerhalb von',
    noteHours: '48 Stunden',
    noteAfter: 'Falls ihr bis dahin nichts von mir hört, schaut bitte in euren Spam-Ordner oder schreibt direkt an',
  },
} as const;

export default function ContactForm({ lang = 'en' }: { lang?: Lang }) {
  const t = texts[lang];
  /** The visible label of an option value */
  const label = (value: string) => (lang === 'de' ? (optionLabelsDe[value] ?? value) : value);
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
        setErrorMessage(result?.error ?? t.sendError);
      }
    } catch {
      // Network problem (offline, server unreachable)
      setStatus('error');
      setErrorMessage(t.offline);
    }
  }

  // After a successful send, the form is replaced by a thank-you message
  if (status === 'success') {
    return (
      <div className="form-status success" role="status">
        <p className="form-status-title">{t.thanksTitle}</p>
        <p>
          {t.thanks} <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" action="/contact.php" method="post" onSubmit={handleSubmit} noValidate>
      <div className="field-row">
        <Field label={t.name} required>
          <input name="name" type="text" autoComplete="name" required maxLength={200} value={values.name} onChange={handleChange} />
        </Field>
        <Field label={t.email} required>
          <input name="email" type="email" autoComplete="email" required maxLength={200} value={values.email} onChange={handleChange} />
        </Field>
      </div>

      <div className="field-row">
        <Field label={t.partner}>
          <input name="partnerName" type="text" maxLength={200} value={values.partnerName} onChange={handleChange} />
        </Field>
        <Field label={t.phone}>
          <input name="phone" type="tel" autoComplete="tel" maxLength={50} value={values.phone} onChange={handleChange} />
        </Field>
      </div>

      <div className="field-row">
        {/* Free text instead of a calendar, so couples can give a range or a season */}
        <Field label={t.date} required>
          <input
            name="date"
            type="text"
            required
            maxLength={100}
            placeholder={t.datePlaceholder}
            value={values.date}
            onChange={handleChange}
          />
        </Field>
        <Field label={t.venue} required>
          <input
            name="venue"
            type="text"
            required
            maxLength={200}
            placeholder={t.venuePlaceholder}
            value={values.venue}
            onChange={handleChange}
          />
        </Field>
      </div>

      <div className="field-row">
        <Field label={t.type} required>
          <select name="shootType" required value={values.shootType} onChange={handleChange}>
            <option value="" disabled>
              {t.select}
            </option>
            {shootTypes.map((type) => (
              <option key={type} value={type}>
                {label(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.guests}>
          <input name="guestCount" type="text" maxLength={50} value={values.guestCount} onChange={handleChange} />
        </Field>
      </div>

      <Field label={t.budget}>
        <select name="budget" value={values.budget} onChange={handleChange}>
          <option value="">{t.select}</option>
          {budgetRanges.map((range) => (
            <option key={range} value={range}>
              {label(range)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.message} required>
        <textarea name="message" rows={5} required maxLength={5000} value={values.message} onChange={handleChange} />
      </Field>

      <Field label={t.referral} required>
        <select name="referral" required value={values.referral} onChange={handleChange}>
          <option value="" disabled>
            {t.select}
          </option>
          {referralSources.map((source) => (
            <option key={source} value={source}>
              {label(source)}
            </option>
          ))}
        </select>
      </Field>

      {/* Honeypot: hidden from people, but bots fill in every field. Filled = rejected. */}
      <div className="hp" aria-hidden="true">
        <label>
          {t.honeypot}
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="startedAt" value={startedAt} />
      <input type="hidden" name="lang" value={lang} />

      {/* GDPR: consent to process the inquiry, with a link to the privacy policy */}
      <label className="consent">
        <input name="consent" type="checkbox" value="yes" required checked={values.consent} onChange={handleChange} />
        <span>
          {t.consentBefore}{' '}
          <a href={routes.privacy[lang]} target="_blank">
            {t.consentLink}
          </a>
          . *
        </span>
      </label>

      {status === 'error' && (
        <p className="form-status error" role="alert">
          {errorMessage} {t.directly} <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      )}

      <div className="center">
        <button className="button" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? t.sending : t.send}
        </button>
      </div>

      <p className="response-note">
        {t.noteBefore} <strong>{t.noteHours}</strong>. {t.noteAfter}{' '}
        <a href={`mailto:${site.email}`}>
          <strong>{site.email}</strong>
        </a>
        .
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
