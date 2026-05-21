import { buildAccountDeletedEmailHtml } from "@/lib/email-template";
import { sendEmail } from "@/lib/brevo";

const DELETED_SUBJECT = "Your Ninth Inning Email account was deleted";

// Permanently delete a user account and everything tied to it (#24).
//
// mlb_user_teams and mlb_sent_notifications both declare their user_id foreign
// key as `on delete cascade` against auth.users (see supabase-schema.sql), so
// removing the auth.users row drops every related mlb_* row in the same
// database transaction. That cascade is the "single transaction" the deletion
// needs — it leaves no orphan rows for the cron's next run to trip over, which
// three separate PostgREST deletes could not guarantee.
//
// The confirmation email is best-effort: by the time it sends the account is
// already gone and the delete is irreversible, so a Brevo failure must not be
// reported back as a failed deletion.
export async function deleteAccount({ admin, userId, email, sendImpl = sendEmail }) {
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete account: ${error.message}`);
  }

  let emailSent = false;
  if (email) {
    try {
      await sendImpl(email, DELETED_SUBJECT, buildAccountDeletedEmailHtml());
      emailSent = true;
    } catch (err) {
      console.error("Account deleted but confirmation email failed:", err);
    }
  }

  return { deleted: true, emailSent };
}
