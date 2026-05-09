import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description:
    "What Ninth Inning Email collects, who processes it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-[#f5f1e6]"
        >
          Ninth Inning Email
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-[#a8a299] hover:text-[#f5f1e6] transition"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#f5f1e6] sm:text-4xl">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-[#a8a299]">
          Last updated May 9, 2026.
        </p>

        <div className="mt-10 space-y-8 text-[#a8a299] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              What we collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-[#f5f1e6]">Your email address</strong>,
                so we can send you the recap emails you signed up for.
              </li>
              <li>
                <strong className="text-[#f5f1e6]">The teams you follow</strong>,
                so we know which recaps to send.
              </li>
              <li>
                <strong className="text-[#f5f1e6]">A log of which recaps we've sent you</strong>,
                so we don't email the same game twice.
              </li>
            </ul>
            <p className="mt-3">
              That's it. We don't ask for a name, a password, a phone number,
              or any payment information. There are no third-party advertising
              trackers on this site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              Who processes your data
            </h2>
            <p className="mt-3">
              We use a small number of vendors to operate the service. Each
              has its own privacy policy.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-[#f5f1e6]">Supabase</strong> stores
                your account, the teams you follow, and your sent-email log.
                It also handles magic-link sign-in.
              </li>
              <li>
                <strong className="text-[#f5f1e6]">Brevo</strong> delivers the
                recap emails (and the magic-link emails) on our behalf.
              </li>
              <li>
                <strong className="text-[#f5f1e6]">Cloudflare</strong> hosts
                the website and the cron jobs that send the emails.
              </li>
              <li>
                <strong className="text-[#f5f1e6]">Stripe</strong> processes
                tips, only if you choose to leave one. We don't see your card
                details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              How long we keep it
            </h2>
            <p className="mt-3">
              For as long as you have an account. The sent-email log is what
              prevents duplicate sends, so it sticks around with your account.
              When you delete your account, we delete all of it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              How to delete your data
            </h2>
            <p className="mt-3">
              You can unsubscribe from any recap email using the link in the
              footer of that email — that stops further sends but leaves your
              account in place.
            </p>
            <p className="mt-3">
              To delete your account and all associated data, email{" "}
              <a
                href="mailto:highlights@ninthinning.email?subject=Delete%20my%20account"
                className="text-[#f5f1e6] underline hover:text-[#c41e3a] transition"
              >
                highlights@ninthinning.email
              </a>{" "}
              from the address you signed up with. We'll confirm and delete
              within 7 days. Self-serve account deletion is on the roadmap.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              Children
            </h2>
            <p className="mt-3">
              Ninth Inning Email is not directed at children under 13, and we
              do not knowingly collect data from them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              Affiliation
            </h2>
            <p className="mt-3">
              Ninth Inning Email is not affiliated with, endorsed by, or
              sponsored by MLB or any MLB club. Recap video links go to
              MLB.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#f5f1e6]">
              Contact
            </h2>
            <p className="mt-3">
              Questions about this policy? Email{" "}
              <a
                href="mailto:highlights@ninthinning.email"
                className="text-[#f5f1e6] underline hover:text-[#c41e3a] transition"
              >
                highlights@ninthinning.email
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-14">
          <Link
            href="/"
            className="text-sm text-[#a8a299] hover:text-[#f5f1e6] transition"
          >
            &larr; Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
