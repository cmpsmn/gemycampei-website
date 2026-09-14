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

// The React form asks for JSON with the header "Accept: application/json"
$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

/**
 * Sends the answer and stops the script.
 * `never` as return type means: this function never returns (it always exits).
 */
function respond(bool $ok, string $error = '', int $status = 200): never
{
    global $wantsJson;
    if ($wantsJson) {
        http_response_code($ok ? 200 : $status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
    } else {
        // 303 = "see other page": the browser loads the thank-you or error page
        header('Location: ' . ($ok ? '/thank-you/' : '/message-error/'), true, 303);
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
$date        = field('date', 20);
$venue       = field('venue', 200);
$shootType   = field('shootType', 60);
$message     = field('message', 5000);
$referral    = field('referral', 60);
$consent     = ($_POST['consent'] ?? '') === 'yes';

if ($name === '' || $message === '') {
    respond(false, 'Please fill in your name and message.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please enter a valid email address.', 422);
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { // date inputs send YYYY-MM-DD
    respond(false, 'Please choose a date.', 422);
}
if ($venue === '') {
    respond(false, 'Please tell me the venue or area.', 422);
}
if (!in_array($shootType, SHOOT_TYPES, true)) {
    respond(false, 'Please choose the type of shooting.', 422);
}
if (!in_array($referral, REFERRAL_SOURCES, true)) {
    respond(false, 'Please tell me how you heard about me.', 422);
}
if (!$consent) {
    respond(false, 'Please agree to the privacy notice.', 422);
}

// --- 4. Load the mailbox settings ------------------------------------------------
$configFile = dirname(__DIR__) . '/contact-config.php'; // one folder above public_html
if (!is_file($configFile)) {
    error_log('contact.php: missing config file ' . $configFile);
    respond(false, 'The form is not configured yet.', 500);
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
    respond(false, 'The message could not be sent right now.', 502);
}
