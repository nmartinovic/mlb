import Link from "next/link";
import { TEAMS_BY_ID } from "@/lib/teams";

const PREVIEW_TEAM_ID = 119; // Dodgers — matches default in app/api/test-email/route.js

function EmailPreview({ size = "sm" }) {
  const team = TEAMS_BY_ID[PREVIEW_TEAM_ID];
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const isLarge = size === "lg";

  return (
    <div
      className={`mx-auto w-full ${
        isLarge ? "max-w-md sm:max-w-lg" : "max-w-sm"
      }`}
    >
      <div className="mb-2 flex items-center justify-center">
        <span className="rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Preview
        </span>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
        <div
          className="h-1.5"
          style={{ backgroundColor: team.color }}
          aria-hidden="true"
        />
        <div className="px-6 pt-6 sm:px-8">
          <div className="flex items-center justify-between">
            <span
              className="inline-block rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: team.color }}
            >
              {team.abbr}
            </span>
            <span className="text-xs text-gray-500">{today}</span>
          </div>
          <h3 className="mt-5 text-lg font-bold leading-snug text-gray-900 sm:text-xl">
            {team.name.split(" ").slice(-1)[0]} highlights are ready
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Your spoiler-free game recap is waiting for you.
          </p>
        </div>
        <div className="px-6 pb-6 pt-5 sm:px-8">
          <div
            className="block w-full rounded-lg py-3 text-center text-sm font-semibold text-white"
            style={{ backgroundColor: team.color }}
          >
            Watch Highlights ▶
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              <strong className="text-gray-700">Highlight Reel</strong>
              <div>Spoiler-free MLB recaps</div>
            </div>
            <span className="underline">Unsubscribe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ n, title, body }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 text-sm font-semibold text-gray-300">
        {n}
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-100">{title}</h3>
      <p className="mt-2 text-sm text-gray-400">{body}</p>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-3xl font-bold text-gray-100 sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-400">{label}</div>
    </div>
  );
}

function FaqItem({ q, children }) {
  return (
    <details className="group rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-4 open:bg-gray-900/60">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-gray-200 list-none [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span className="ml-4 text-gray-500 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-gray-400">
        {children}
      </div>
    </details>
  );
}

export default function Home() {
  const tipUrl = process.env.TIP_URL;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-gray-200">
          Highlight Reel
        </span>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-400 hover:text-gray-200 transition"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,99,235,0.25), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-16 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="inline-block rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1 text-xs font-medium text-gray-400">
                Free · For MLB fans
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-50 sm:text-5xl lg:text-6xl">
                Spoiler-free MLB recaps in your inbox.
              </h1>
              <p className="mt-5 text-lg text-gray-400 sm:text-xl">
                Pick your teams. We email the recap the next morning. No
                scores, no spoilers — just the highlights.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/login"
                  className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition"
                >
                  Get my recaps
                </Link>
                <a
                  href="#sample"
                  className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 hover:border-gray-500 transition"
                >
                  See a sample email
                </a>
              </div>
              <p className="mt-4 text-xs text-gray-500">
                Free · No ads · Unsubscribe anytime
              </p>
            </div>
            <div className="lg:justify-self-end">
              <EmailPreview size="sm" />
            </div>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-gray-900 bg-gray-950/60">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-3">
          <Stat value="30" label="MLB teams supported" />
          <Stat value="0" label="Scores spoiled" />
          <Stat value="~1" label="Email per game day, per team" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-gray-400">
            Three steps. No app to install. No score in sight.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          <StepCard
            n="1"
            title="Pick your teams"
            body="Follow one or all 30 MLB teams."
          />
          <StepCard
            n="2"
            title="Watch the game (or don't)"
            body="After the game ends, we find the recap video automatically."
          />
          <StepCard
            n="3"
            title="Check your inbox"
            body="A spoiler-free email with a direct link to the 3–5 minute game highlights. No scores, no outcomes."
          />
        </div>
      </section>

      {/* Sample email */}
      <section id="sample" className="border-t border-gray-900 bg-gray-950/60">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
              Here's what lands in your inbox
            </h2>
            <p className="mt-3 text-gray-400">
              Just the link. No score, no spoiler, no clickbait.
            </p>
          </div>
          <div className="mt-12">
            <EmailPreview size="lg" />
          </div>
        </div>
      </section>

      {/* Built by a fan */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl">
          Built by a fan, for fans
        </h2>
        <p className="mt-5 text-gray-400">
          I built Highlight Reel because I kept getting scores spoiled before I
          could watch the recap — push notifications, group chats, the home
          page of every sports site. So I made the email I wanted: one link,
          no score, no fuss.
        </p>
        {tipUrl && (
          <p className="mt-6 text-sm">
            <a
              href={tipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 underline hover:text-gray-200 transition"
            >
              Support this project
            </a>
          </p>
        )}
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl">
          Questions
        </h2>
        <div className="mt-8 space-y-3">
          <FaqItem q="Is it free?">
            Yes. Highlight Reel is free for personal use. There's a tip link
            if you want to chip in for hosting, but nothing is gated.
          </FaqItem>
          <FaqItem q="Will I see the score by accident?">
            No. The email subject and body are written to be spoiler-free —
            no scores, no outcomes, no who-won-what. The link sends you to
            the official MLB.com video page for the recap.
          </FaqItem>
          <FaqItem q="Does it work in the postseason?">
            Yes. As long as MLB publishes a recap video for the game, you'll
            get it the next morning, including the playoffs and World Series.
          </FaqItem>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-gray-800 bg-gradient-to-br from-blue-600/10 to-gray-900/40 px-6 py-14 text-center sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-50 sm:text-4xl">
            Ready for spoiler-free recaps?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Sign in with a magic link, pick your teams, and we'll handle the
            rest.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 transition"
            >
              Get my recaps
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-gray-500 sm:flex-row">
          <p className="text-center sm:text-left">
            Highlight Reel is not affiliated with, endorsed by, or sponsored
            by MLB or any MLB club. Video links courtesy of MLB.com.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-gray-300 transition">
              Sign in
            </Link>
            <Link
              href="/unsubscribe"
              className="hover:text-gray-300 transition"
            >
              Unsubscribe
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
