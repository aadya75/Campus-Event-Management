// Notification module. Dev build: logs to console.
// TODO (Increment 3): send real e-mail with Nodemailer/SMTP.
function notify(to, subject, body) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[NOTIFY] to=${to} | ${subject} | ${body}`);
  }
}

module.exports = { notify };
