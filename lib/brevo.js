export const SENDER_NAME = "Ninth Inning Email";
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(to, subject, html, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": process.env.EMAIL_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.FROM_EMAIL, name: SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
  }

  return res;
}
