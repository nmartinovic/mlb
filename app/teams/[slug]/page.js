import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLockup, DiamondGlyph } from "@/components/brand";
import { MLB_TEAMS, TEAMS_BY_SLUG } from "@/lib/teams";
import { createClient } from "@/lib/supabase-server";

const SITE_URL = process.env.SITE_URL || "https://ninthinning.email";

export function generateStaticParams() {
  return MLB_TEAMS.map((t) => ({ slug: t.slug }));
}

// Generate at build time only; static across deploys.
export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const team = TEAMS_BY_SLUG[slug];
  if (!team) return {};
  const title = `Spoiler-free ${team.name} highlights by email`;
  const description = `Follow the ${team.shortName} without spoilers. Ninth Inning Email sends you the official MLB recap the morning after every ${team.shortName} game — no scores, no winner, just the highlights when you press play.`;
  const url = `${SITE_URL}/teams/${team.slug}`;
  return {
    title,
    description,
    alternates: { canonical: `/teams/${team.slug}` },
    openGraph: {
      title,
      description,
      url,
      siteName: "Ninth Inning Email",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function TeamLandingPage({ params }) {
  const { slug } = await params;
  const team = TEAMS_BY_SLUG[slug];
  if (!team) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);
  const ctaHref = isSignedIn
    ? `/dashboard?team=${team.slug}`
    : `/login?next=signup&team=${team.slug}`;
  const ctaLabel = isSignedIn
    ? `Follow the ${team.shortName}`
    : `Get spoiler-free ${team.shortName} recaps`;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          aria-label="ninthinning.email"
          className="text-[15px] text-[#f7f5ef]"
        >
          <BrandLockup glyphSize={28} dark />
        </Link>
        <Link
          href={isSignedIn ? "/dashboard" : "/login"}
          className="text-sm font-medium text-[#a8a299] transition hover:text-[#f7f5ef]"
        >
          {isSignedIn ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      {/* Hero with team color accent */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${team.color}55, transparent 70%)`,
          }}
          aria-hidden="true"
        />
        <div className="mx-auto max-w-4xl px-6 pb-16 pt-10 sm:pt-16 lg:pt-20">
          <div className="text-center">
            <span
              className="inline-block rounded px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: team.color }}
            >
              {team.abbr}
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#f7f5ef] sm:text-5xl lg:text-6xl">
              Get spoiler-free {team.name} highlights by email.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[#a8a299] sm:text-xl">
              Follow the {team.shortName} without waking up to spoiled scores.
              Ninth Inning Email sends you the official MLB recap the morning
              after every {team.shortName} game — no score, no winner, no push
              notifications.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href={ctaHref}
                className="w-full rounded-lg px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:opacity-90 sm:w-auto"
                style={{ backgroundColor: team.color }}
              >
                {ctaLabel}
              </Link>
              <Link
                href="/#sample"
                className="text-sm font-medium text-[#a8a299] transition hover:text-[#f7f5ef]"
              >
                See a sample email &amp; recap &rarr;
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#a8a299]">
              Free · No ads · Unsubscribe anytime
            </p>
          </div>
        </div>
      </section>

      {/* How it works for this team */}
      <section className="mx-auto max-w-3xl px-6 pb-16 sm:pb-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-[#f7f5ef] sm:text-3xl">
          How it works for {team.shortName} fans
        </h2>
        <ul className="mx-auto mt-8 max-w-2xl space-y-3 text-[#a8a299]">
          {[
            `Pick the ${team.shortName} (and any other MLB teams) on your dashboard.`,
            `The morning after every ${team.shortName} game, we email you one spoiler-free recap.`,
            "The subject line and preview text never reveal the score.",
            "Tap through to a branded page on ninthinning.email — still no score on screen.",
            "Press play to watch the 3–5 minute official MLB recap on your schedule.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-base">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Spoiler-safe promise — reused from the home page so the trust copy is consistent */}
      <section className="border-y border-[#1f3a2c] bg-[#0f1311]/60">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="rounded-2xl border border-[#3f6e57]/50 bg-[#0f2a1f]/60 p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <DiamondGlyph size={28} />
              <h2 className="text-xl font-bold tracking-tight text-[#f7f5ef] sm:text-2xl">
                Spoiler-safe promise
              </h2>
            </div>
            <p className="mt-5 text-base leading-relaxed text-[#a8a299] sm:text-lg">
              No scores, no winner, no losing pitcher, no &ldquo;walk-off win&rdquo;
              language, no comeback hints, and no subject lines that give away
              what happened. The email and delivery are spoiler-free; the
              video is the official MLB recap, which of course shows the score
              once you press play — you decide when that happens.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div
          className="rounded-3xl border px-6 py-14 text-center sm:px-12"
          style={{
            borderColor: `${team.color}55`,
            background: `linear-gradient(135deg, ${team.color}22, #0f2a1f55)`,
          }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-[#f7f5ef] sm:text-4xl">
            Ready for spoiler-free {team.shortName} recaps?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#a8a299]">
            Sign in with a magic link — we&apos;ll pre-select the {team.shortName} so you can start with one click.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href={ctaHref}
              className="rounded-lg px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
              style={{ backgroundColor: team.color }}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#1f3a2c]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-[#a8a299] sm:flex-row">
          <p className="text-center sm:text-left">
            Ninth Inning Email is not affiliated with, endorsed by, or sponsored
            by MLB or any MLB club. Video links courtesy of MLB.com.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/" className="transition hover:text-[#f7f5ef]">
              Home
            </Link>
            <Link href="/privacy" className="transition hover:text-[#f7f5ef]">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
