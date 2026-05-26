import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { TEAMS_BY_ID } from "@/lib/teams";
import { createClient } from "@/lib/supabase-server";
import { formatDisplayDate } from "@/lib/mlb";

// The recap archive is the only Ninth Inning page that lists multiple games at
// once. Spoiler discipline (#196): one team per row, no score column, no
// outcome adjectives. The destination /highlights/[gamePk] page (#77) already
// enforces the same rules at the per-game level — this page just has to avoid
// leaking the matchup or result before the visitor opts in.
export const metadata = {
  title: "Recent recaps",
  description:
    "Recent spoiler-free MLB game recaps from the last two weeks — one click to watch each, with no score on the way in.",
  alternates: { canonical: "/recaps" },
  robots: { index: true },
};

const WINDOW_DAYS = 14;

function isoDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function loadRecentRecaps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mlb_game_cache")
    .select("game_pk, team_id, game_date, highlight_url")
    .not("highlight_url", "is", null)
    .gte("game_date", isoDaysAgo(WINDOW_DAYS))
    .order("game_date", { ascending: false })
    .order("game_pk", { ascending: false })
    .limit(500);
  if (error) return [];
  return data || [];
}

export default async function RecapsPage() {
  const rows = await loadRecentRecaps();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          aria-label="ninthinning.email"
          className="text-[15px] text-[#f7f5ef] transition hover:opacity-90"
        >
          <BrandLockup glyphSize={26} dark />
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-[#a8a299] transition hover:text-[#f7f5ef]"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#f7f5ef] sm:text-4xl">
          Recent recaps
        </h1>
        <p className="mt-3 text-[#a8a299]">
          The last two weeks of recaps Ninth Inning Email has delivered. One
          team per row, no scores, no winners — press play on a game when
          you&apos;re ready to see how it ended.
        </p>

        {rows.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[#1f3a2c] bg-[#0f2a1f]/40 p-8 text-center">
            <p className="font-semibold text-[#f7f5ef]">
              No recaps in the last two weeks.
            </p>
            <p className="mt-2 text-sm text-[#a8a299]">
              The MLB regular season runs late March through October. Check
              back after the next game day.
            </p>
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-[#1f3a2c] overflow-hidden rounded-xl border border-[#1f3a2c] bg-[#0f2a1f]/40">
            {rows.map((row) => {
              const team = TEAMS_BY_ID[row.team_id];
              const teamName = team?.name || "MLB team";
              const teamColor = team?.color || "#2d5a3d";
              const teamAbbr = team?.abbr || "MLB";
              const displayDate = formatDisplayDate(row.game_date);
              return (
                <li key={row.game_pk}>
                  <Link
                    href={`/highlights/${row.game_pk}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#0f2a1f]/80"
                  >
                    <span
                      className="inline-block flex-shrink-0 rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: teamColor }}
                    >
                      {teamAbbr}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#f7f5ef]">
                        {teamName} highlights
                      </p>
                      <p className="text-xs uppercase tracking-wider text-[#a8a299]">
                        {displayDate}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-medium text-[#7fb295]">
                      Watch recap &rarr;
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <section className="mt-12 border-t border-[#1f3a2c] pt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
            Want these in your inbox?
          </h2>
          <p className="mt-3 text-[#a8a299]">
            Ninth Inning Email sends one spoiler-free recap the morning after
            every game your teams play. Free, no ads, unsubscribe anytime.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-lg bg-[#2d5a3d] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          >
            Get started with a magic link
          </Link>
        </section>

        <p className="mt-12 text-xs leading-relaxed text-[#71717a]">
          Ninth Inning Email is not affiliated with, endorsed by, or sponsored
          by MLB or any MLB club. Highlight videos courtesy of MLB.com.
        </p>
      </main>
    </div>
  );
}
