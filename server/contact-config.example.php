<?php
/**
 * SMTP settings for public/contact.php.
 *
 * 1. Create a mailbox in hPanel (Emails), e.g. info@gemycampei.com.
 * 2. Copy this file to the server ONE LEVEL ABOVE public_html and name it contact-config.php:
 *      /home/<your-user>/domains/gemycampei.com/contact-config.php
 *    (hPanel > File Manager, or scp over SSH.)
 * 3. Fill in the password. Never commit the real file to Git.
 */

return [
    'smtp_host'  => 'smtp.hostinger.com',
    'smtp_port'  => 465,                       // 465 = SSL, 587 = STARTTLS
    'smtp_user'  => 'info@gemycampei.com',
    'smtp_pass'  => 'CHANGE-ME',
    'from_email' => 'info@gemycampei.com',    // must be the same mailbox as smtp_user
    'from_name'  => 'gemycampei.com contact form',
    'to_email'   => 'info@gemycampei.com',    // where inquiries are delivered
];
