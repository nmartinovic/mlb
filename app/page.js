import Link from "next/link";

export default function Home() {
  const bmcUrl = process.env.BMC_URL;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Highlight Reel
        </h1>
        <p className="mt-4 text-lg text-gray-400">
          Spoiler-free MLB game recaps, delivered to your inbox.
        </p>
        <p className="mt-2 text-gray-500">
          No scores. No spoilers. Just the highlights.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 hover:border-gray-500 transition"
          >
            Sign in
          </Link>
        </div>

        {bmcUrl && (
          <p className="mt-4 text-sm text-gray-500">
            <a
              href={bmcUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 underline hover:text-gray-300 transition"
            >
              Support this project
            </a>
          </p>
        )}

        <div className="mt-16 space-y-6 text-left text-sm text-gray-500">
          <div className="flex gap-4">
            <span className="text-2xl">1.</span>
            <div>
              <p className="font-medium text-gray-300">Pick your teams</p>
              <p>Follow one or all 30 MLB teams.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="text-2xl">2.</span>
            <div>
              <p className="font-medium text-gray-300">Watch the game (or don't)</p>
              <p>After the game ends, we find the recap video automatically.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="text-2xl">3.</span>
            <div>
              <p className="font-medium text-gray-300">Check your inbox</p>
              <p>
                A spoiler-free email with a direct link to the 3-5 minute game
                highlights. No scores, no outcomes.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-12 text-xs text-gray-600">
          Highlight Reel is not affiliated with, endorsed by, or sponsored by MLB or any MLB club. Video links courtesy of MLB.com.
        </p>
      </div>
    </main>
  );
}
