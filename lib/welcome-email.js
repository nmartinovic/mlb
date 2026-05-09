import { buildWelcomeEmailHtml } from "@/lib/email-template";
import { sendEmail } from "@/lib/brevo";

// Sentinel game_pk used to record that a user has received the one-time
// welcome email. Re-using mlb_sent_notifications keeps the schema unchanged
// (issue #26) and the existing unique (user_id, game_pk) constraint enforces
// idempotency atomically.
export const WELCOME_SENTINEL_GAME_PK = 0;

const WELCOME_SUBJECT = "Welcome to Ninth Inning Email";

// Idempotently send the welcome email. Claim-then-send order: insert the
// sentinel row first so concurrent calls (e.g. rapid-fire team toggles) can't
// both win the race. If the send fails, the sentinel is rolled back so the
// next attempt can retry.
//
// Returns { sent: true } on first successful send,
//         { sent: false, reason: "already_sent" } if previously sent,
//         { sent: false, reason: "no_email" } if the user has no email.
export async function sendWelcomeEmailIfNeeded({ supabase, userId, email, sendImpl = sendEmail }) {
  if (!email) {
    return { sent: false, reason: "no_email" };
  }

  const { error: insertError } = await supabase
    .from("mlb_sent_notifications")
    .insert({ user_id: userId, game_pk: WELCOME_SENTINEL_GAME_PK });

  if (insertError) {
    if (insertError.code === "23505") {
      return { sent: false, reason: "already_sent" };
    }
    throw new Error(
      `Failed to claim welcome sentinel: ${insertError.message}`
    );
  }

  try {
    const html = buildWelcomeEmailHtml(userId);
    await sendImpl(email, WELCOME_SUBJECT, html);
  } catch (err) {
    await supabase
      .from("mlb_sent_notifications")
      .delete()
      .eq("user_id", userId)
      .eq("game_pk", WELCOME_SENTINEL_GAME_PK);
    throw err;
  }

  return { sent: true };
}
