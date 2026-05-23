// Backstop for the Cloudflare Cron Triggers. The GitHub Actions workflow in
// .github/workflows/cron-backup.yml calls the cron HTTP routes with ?backup=1;
// those routes use this to decide whether Cloudflare's own cron is still alive
// and, if so, skip — keeping Cloudflare's scheduler primary and the backup a
// true no-op. Added after the 2026-05-22 Cloudflare cron outage (INCIDENT.md).
//
// `cronRanRecently` returns true when mlb_cron_runs has a row newer than
// maxAgeMs. Pass statusPrefix to only consider matching statuses (e.g.
// "schedule" for the daily scheduler). On a read error it returns false —
// the caller falls open and runs the job, since missing email is worse than
// a redundant run (mlb_sent_notifications dedup absorbs any overlap anyway).
export async function cronRanRecently(supabase, { maxAgeMs, statusPrefix } = {}) {
  let query = supabase.from("mlb_cron_runs").select("started_at");
  if (statusPrefix) query = query.like("status", `${statusPrefix}%`);
  const { data, error } = await query
    .order("started_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return false;
  return Date.now() - new Date(data[0].started_at).getTime() < maxAgeMs;
}
