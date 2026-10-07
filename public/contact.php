<?php
/**
 * ============================================================================
 * CONTACT FORM HANDLER  (public/contact.php)  →  https://gemycampei.com/contact.php
 * ============================================================================
 *
 * WHY PHP?
 * The website is static HTML, so it cannot send emails by itself. Hostinger
 * runs PHP on every hosting plan, so this one small script does that job.
 * It only runs on the server. `npm run dev` cannot run it, so test the form on
 * the live or staging site.
 *
 * WHAT IT DOES, STEP BY STEP
 * 1. Accepts only POST requests (a form submission).
 * 2. Rejects bots: a hidden "honeypot" field and a minimum fill time.
 * 3. Checks every field (required fields, email format, allowed options).
 * 4. Sends the inquiry as an email via SMTP using the PHPMailer library.
 *    Nothing is saved on the server (good for GDPR).
 * 5. Answers with JSON for the React form, or redirects for browsers without
 *    JavaScript.
 *
 * PASSWORDS ARE NOT IN THIS FILE
 * The mailbox login lives in contact-config.php ONE LEVEL ABOVE public_html:
 *   /home/<user>/domains/gemycampei.com/contact-config.php
 * so it is never reachable from the web and never stored in Git.
 * Template: server/contact-config.example.php
 * ============================================================================
 */

declare(strict_types=1); // PHP checks value types strictly, which catches mistakes early

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

// The PHPMailer library files (protected from direct access by public/_mail/.htaccess)
require __DIR__ . '/_mail/PHPMailer/Exception.php';
require __DIR__ . '/_mail/PHPMailer/PHPMailer.php';
require __DIR__ . '/_mail/PHPMailer/SMTP.php';

/** Forms sent faster than this are treated as bots */
const MIN_FILL_SECONDS = 3;

/**
 * Allowed options. They MUST match the lists in src/components/ContactForm.tsx,
 * otherwise valid choices are rejected.
 */
const SHOOT_TYPES = ['Wedding', 'Elopement', 'Couple Session', 'Pre Wedding', 'Surprise Proposal', 'Maternity', 'Others'];
const REFERRAL_SOURCES = ['Google', 'Instagram', 'TikTok', 'Pinterest', 'Event', 'Referral'];
// Optional: the ranges offered in the form. Keep in sync with ContactForm.tsx.
const BUDGET_RANGES = ['Under €3,000', '€3,000 – €5,000', '€5,000 – €8,000', '€8,000+', "I'd like guidance"];

// The React form asks for JSON with the header "Accept: application/json"
$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

// Language of the page the form was sent from (hidden field "lang"): answers
// and the thank-you page are in the same language.
$lang = ($_POST['lang'] ?? '') === 'de' ? 'de' : 'en';

/** The English or German text, depending on the form's language */
function t(string $en, string $de): string
{
    global $lang;
    return $lang === 'de' ? $de : $en;
}

/**
 * Sends the answer and stops the script.
 * `never` as return type means: this function never returns (it always exits).
 */
function respond(bool $ok, string $error = '', int $status = 200): never
{
    global $wantsJson, $lang;
    if ($wantsJson) {
        http_response_code($ok ? 200 : $status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
    } else {
        // 303 = "see other page": the browser loads the thank-you or error page
        $pages = $lang === 'de'
            ? ['/de/danke/', '/de/nachricht-nicht-gesendet/']
            : ['/thank-you/', '/message-error/'];
        header('Location: ' . ($ok ? $pages[0] : $pages[1]), true, 303);
    }
    exit;
}

/**
 * Reads one form field safely: always a string, invisible control characters
 * removed (except line breaks and tabs), trimmed, and cut to a maximum length.
 */
function field(string $name, int $maxLength): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value)) {
        return '';
    }
    $value = preg_replace('/[^\P{C}\n\t]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $maxLength);
}

// --- 1. Only accept form submissions -----------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(false, 'Method not allowed.', 405);
}

// --- 2. Spam protection --------------------------------------------------------
// Honeypot: the "website" field is hidden from people. Bots fill in every field.
if (!empty($_POST['website'])) {
    respond(true); // pretend success, so the bot doesn't try again
}

// Minimum fill time. `startedAt` is set by the React form (milliseconds).
$startedAt = (int) ($_POST['startedAt'] ?? 0);
if ($startedAt > 0 && (time() * 1000 - $startedAt) < MIN_FILL_SECONDS * 1000) {
    respond(true);
}

// --- 3. Read and check the fields ----------------------------------------------
$name        = field('name', 200);
$email       = field('email', 200);
$partnerName = field('partnerName', 200);
$phone       = field('phone', 50);
$date        = field('date', 100);
$venue       = field('venue', 200);
$shootType   = field('shootType', 60);
$guestCount  = field('guestCount', 50);
$budget      = field('budget', 60);
$message     = field('message', 5000);
$referral    = field('referral', 60);
$consent     = ($_POST['consent'] ?? '') === 'yes';

if ($name === '' || $message === '') {
    respond(false, t('Please fill in your name and message.', 'Bitte gebt euren Namen und eure Nachricht ein.'), 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, t('Please enter a valid email address.', 'Bitte gebt eine gültige E-Mail-Adresse ein.'), 422);
}
if ($date === '') { // free text: a single date, a range or a season
    respond(false, t('Please tell me your date or dates.', 'Bitte nennt mir euer Datum oder euren Zeitraum.'), 422);
}
if ($venue === '') {
    respond(false, t('Please tell me the venue or area.', 'Bitte nennt mir die Location oder die Gegend.'), 422);
}
if (!in_array($shootType, SHOOT_TYPES, true)) {
    respond(false, t('Please choose the type of shooting.', 'Bitte wählt die Art des Shootings.'), 422);
}
// The investment range is optional, so an empty value is allowed
if ($budget !== '' && !in_array($budget, BUDGET_RANGES, true)) {
    respond(false, t('Please choose one of the given options.', 'Bitte wählt eine der angebotenen Optionen.'));
}
if (!in_array($referral, REFERRAL_SOURCES, true)) {
    respond(false, t('Please tell me how you heard about me.', 'Bitte verratet mir, wie ihr von mir erfahren habt.'), 422);
}
if (!$consent) {
    respond(false, t('Please agree to the privacy notice.', 'Bitte stimmt dem Datenschutzhinweis zu.'), 422);
}

// --- 4. Load the mailbox settings ------------------------------------------------
$configFile = dirname(__DIR__) . '/contact-config.php'; // one folder above public_html
if (!is_file($configFile)) {
    error_log('contact.php: missing config file ' . $configFile);
    respond(false, t('The form is not configured yet.', 'Das Formular ist noch nicht eingerichtet.'), 500);
}
/** @var array{smtp_host:string,smtp_port:int,smtp_user:string,smtp_pass:string,from_email:string,from_name:string,to_email:string} $config */
$config = require $configFile;

// --- 5. Build and send the email -------------------------------------------------
$body = implode("\n", [
    'New inquiry via gemycampei.com',
    '',
    'Name:        ' . $name,
    'Partner:     ' . ($partnerName !== '' ? $partnerName : '-'),
    'Email:       ' . $email,
    'Phone:       ' . ($phone !== '' ? $phone : '-'),
    'Shooting:    ' . $shootType,
    'Date:        ' . $date,
    'Venue:       ' . $venue,
    'Guests:      ' . ($guestCount !== '' ? $guestCount : '-'),
    'Investment:  ' . ($budget !== '' ? $budget : '-'),
    'Heard via:   ' . $referral,
    '',
    'Message:',
    $message,
    '',
    '---',
    'Consent to privacy policy given on ' . date('Y-m-d H:i'),
]);

$mail = new PHPMailer(true); // true = throw an exception when something fails
try {
    $mail->isSMTP();
    $mail->Host       = $config['smtp_host'];
    $mail->Port       = (int) $config['smtp_port'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['smtp_user'];
    $mail->Password   = $config['smtp_pass'];
    // Port 465 uses SSL from the start, port 587 upgrades with STARTTLS
    $mail->SMTPSecure = ((int) $config['smtp_port'] === 465)
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->CharSet    = PHPMailer::CHARSET_UTF8;

    // Sent FROM your own mailbox (so spam filters trust it), "Reply" goes to the visitor
    $mail->setFrom($config['from_email'], $config['from_name']);
    $mail->addAddress($config['to_email']);
    $mail->addReplyTo($email, $name);

    $mail->Subject = 'Inquiry: ' . $shootType . ' – ' . $name . ' – ' . $date;
    $mail->Body    = $body;
    $mail->isHTML(false);

    $mail->send();
    respond(true);
} catch (MailException $e) {
    // Log the technical reason (visible in Hostinger's error log), without personal data
    error_log('contact.php: mail failed: ' . $mail->ErrorInfo);
    respond(false, t('The message could not be sent right now.', 'Die Nachricht konnte gerade nicht gesendet werden.'), 502);
}
