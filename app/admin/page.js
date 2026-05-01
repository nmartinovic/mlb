import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const STATUS_COLORS = {
  success: "text-green-400",
  partial: "text-yellow-400",
  failure: "text-red-400",
  running: "text-blue-400",
  paused: "text-gray-400",
  no_subscribers: "text-gray-500",
  no_new_highlights: "text-gray-500",
};

function formatRelative(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function formatDuration(start, end) {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) {
    notFound();
  }

  const admin = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [usersRes, emailsRes, runsRes] = await Promise.all([
    admin.from("mlb_users").select("*", { count: "exact", head: true }),
    admin
      .from("mlb_sent_notifications")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", sevenDaysAgo),
    admin
      .from("mlb_cron_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const totalUsers = usersRes.count ?? 0;
  const emailsLast7d = emailsRes.count ?? 0;
  const runs = runsRes.data || [];
  const lastRun = runs[0];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-gray-400">
          Health snapshot for {process.env.SITE_URL || "ninthinning.email"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total users" value={totalUsers} />
        <Stat label="Emails sent (7d)" value={emailsLast7d} />
        <Stat
          label="Last cron run"
          value={lastRun ? formatRelative(lastRun.started_at) : "never"}
          sub={
            lastRun ? (
              <span className={STATUS_COLORS[lastRun.status] || "text-gray-400"}>
                {lastRun.status}
              </span>
            ) : null
          }
        />
      </div>

      <h2 className="mt-12 mb-3 text-sm font-medium text-gray-300">
        Recent cron runs
      </h2>
      {runs.length === 0 ? (
        <p className="text-sm text-gray-500">No runs logged yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Games</th>
                <th className="px-4 py-2 font-medium text-right">Emails</th>
                <th className="px-4 py-2 font-medium text-right">Errors</th>
                <th className="px-4 py-2 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {runs.map((run) => (
                <tr key={run.id} className="text-gray-300">
                  <td className="px-4 py-2 text-gray-400">
                    {formatRelative(run.started_at)}
                  </td>
                  <td className={`px-4 py-2 font-medium ${STATUS_COLORS[run.status] || ""}`}>
                    {run.status}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {run.games_processed}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {run.emails_sent}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {run.errors_count > 0 ? (
                      <span className="text-red-400">{run.errors_count}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500 tabular-nums">
                    {formatDuration(run.started_at, run.finished_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastRun?.errors?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-gray-300">
            Errors in last run
          </h3>
          <ul className="space-y-1 rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-xs text-red-300">
            {lastRun.errors.map((err, i) => (
              <li key={i} className="font-mono">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-100">{value}</div>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </div>
  );
}
