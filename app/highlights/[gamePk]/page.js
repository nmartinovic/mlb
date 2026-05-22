import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLockup } from "@/components/brand";
import { TEAMS_BY_ID } from "@/lib/teams";
import { createClient } from "@/lib/supabase-server";
import {
  extractHighlightUrl,
  extractSeriesContext,
  fetchGameContent,
  fetchSchedule,
  formatDisplayDate,
} from "@/lib/mlb";
import HighlightsViewTracker from "./view-tracker";

// Per-game pages carry no SEO value and reference internal game PKs — keep
// them out of search indexes.
export const metadata = {
  title: "Game highlights",
  description: "Watch the spoiler-free recap of your team's game.",
  robots: { index: false },
};

function parseGamePk(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Spoiler-safe opponent line, e.g. "vs Yankees · Game 2 of 3". The series
// position is dropped if the numbers are missing or malformed — mirrors the
// recap email's seriesContextLine so the two surfaces never disagree (#69).
function seriesLine(seriesContext) {
  if (!seriesContext) return null;
  const { opponentName, isHome, seriesGameNumber, gamesInSeries } = seriesContext;
  if (!opponentName) return null;
  let line = `${isHome ? "vs" : "@"} ${opponentName}`;
  if (
    Number.isInteger(seriesGameNumber) &&
    seriesGameNumber >= 1 &&
    Number.isInteger(gamesInSeries) &&
    gamesInSeries >= 1 &&
    seriesGameNumber <= gamesInSeries
  ) {
    line += ` · Game ${seriesGameNumber} of ${gamesInSeries}`;
  }
  return line;
}

// The email CTA only ever links to games the cron has already processed, so a
// mlb_game_cache row is the source of truth. An unknown gamePk 404s rather than
// guessing. The highlight URL is normally cached on that row; if the cron wrote
// the row before MLB published a recap we make one live re-fetch attempt.
async function loadGame(gamePk) {
  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("mlb_game_cache")
    .select("game_pk, team_id, game_date, highlight_url")
    .eq("game_pk", gamePk)
    .maybeSingle();

  if (!cached) return null;

  let highlightUrl = cached.highlight_url;
  if (!highlightUrl) {
    try {
      highlightUrl = extractHighlightUrl(await fetchGameContent(gamePk));
    } catch {
      // Leave null — the page degrades to a "not posted yet" state.
    }
  }

  let seriesContext = null;
  try {
    const schedule = await fetchSchedule(cached.team_id, cached.game_date);
    const game = (schedule?.dates?.[0]?.games || []).find(
      (g) => g.gamePk === gamePk
    );
    const raw = game ? extractSeriesContext(game, cached.team_id) : null;
    const opponent = raw ? TEAMS_BY_ID[raw.opponentId] : null;
    if (opponent) {
      seriesContext = {
        opponentName: opponent.shortName,
        isHome: raw.isHome,
        seriesGameNumber: raw.seriesGameNumber,
        gamesInSeries: raw.gamesInSeries,
      };
    }
  } catch {
    // The opponent line is optional context — omit it on any failure.
  }

  return {
    gamePk,
    teamId: cached.team_id,
    gameDate: cached.game_date,
    highlightUrl,
    seriesContext,
  };
}

function NextStepCard({ href, external, title, body }) {
  const className =
    "block rounded-xl border border-[#1f3a2c] bg-[#0f2a1f]/40 px-5 py-4 transition hover:border-[#3f6e57]";
  const inner = (
    <>
      <span className="text-sm font-semibold text-[#f7f5ef]">{title}</span>
      <span className="mt-1 block text-sm text-[#a8a299]">{body}</span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export default async function HighlightsPage({ params }) {
  const { gamePk: gamePkParam } = await params;
  const gamePk = parseGamePk(gamePkParam);
  if (!gamePk) notFound();

  const game = await loadGame(gamePk);
  if (!game) notFound();

  const team = TEAMS_BY_ID[game.teamId];
  const teamName = team?.name || "Your team";
  const teamColor = team?.color || "#2d5a3d";
  const displayDate = formatDisplayDate(game.gameDate);
  const series = seriesLine(game.seriesContext);
  const tipUrl = process.env.TIP_URL;
  const { highlightUrl } = game;
  const isMp4 =
    typeof highlightUrl === "string" && /\.mp4(\?|$)/i.test(highlightUrl);

  return (
    <div className="min-h-screen">
      <HighlightsViewTracker gamePk={gamePk} teamId={game.teamId} />

      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          aria-label="ninthinning.email"
          className="text-[15px] text-[#f7f5ef] transition hover:opacity-90"
        >
          <BrandLockup glyphSize={26} dark />
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#a8a299] transition hover:text-[#f7f5ef]"
        >
          Dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <div className="flex items-center justify-between">
          {team?.abbr ? (
            <span
              className="inline-block rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: teamColor }}
            >
              {team.abbr}
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs uppercase tracking-wider text-[#a8a299]">
            {displayDate}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#f7f5ef] sm:text-4xl">
          {teamName} highlights
        </h1>
        {series && (
          <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-[#a8a299]">
            {series}
          </p>
        )}
        <p className="mt-2 text-[#a8a299]">
          Your spoiler-free game recap — no score, just the plays.
        </p>

        <div className="mt-8">
          {isMp4 ? (
            <>
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: teamColor }}
              >
                <div
                  className="h-1.5"
                  style={{ backgroundColor: teamColor }}
                  aria-hidden="true"
                />
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="block aspect-video w-full bg-black"
                >
                  <source src={highlightUrl} type="video/mp4" />
                </video>
              </div>
              <p className="mt-3 text-center text-xs text-[#a8a299]">
                Trouble playing?{" "}
                <a
                  href={highlightUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline transition hover:text-[#f7f5ef]"
                >
                  Open the video directly &#8599;
                </a>
              </p>
            </>
          ) : highlightUrl ? (
            <a
              href={highlightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-6 py-5 text-center text-base font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: teamColor }}
            >
              Watch the recap &#9654;
            </a>
          ) : (
            <div className="rounded-xl border border-[#1f3a2c] bg-[#0f2a1f]/40 p-8 text-center">
              <p className="font-semibold text-[#f7f5ef]">
                The highlight reel isn&apos;t posted yet.
              </p>
              <p className="mt-2 text-sm text-[#a8a299]">
                MLB usually publishes recaps within a few hours of the final
                out. Check back a little later.
              </p>
              <a
                href="https://www.mlb.com/video"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-[#7fb295] underline transition hover:text-[#f7f5ef]"
              >
                Browse recaps on MLB.com &#8599;
              </a>
            </div>
          )}
        </div>

        <section className="mt-12 border-t border-[#1f3a2c] pt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
            What&apos;s next
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NextStepCard
              href="/dashboard"
              title="Manage your teams &rarr;"
              body="Follow another team or update your email preferences."
            />
            {tipUrl && (
              <NextStepCard
                href={tipUrl}
                external
                title="Tip the developer &#9829;"
                body="Tips keep the servers running and the recaps free."
              />
            )}
          </div>
        </section>

        <p className="mt-12 text-xs leading-relaxed text-[#71717a]">
          Ninth Inning Email is not affiliated with, endorsed by, or sponsored
          by MLB or any MLB club. Highlight video courtesy of MLB.com.
        </p>
      </main>
    </div>
  );
}
