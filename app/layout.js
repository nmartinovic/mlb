import "./globals.css";
import PostHogProvider from "./posthog-provider";

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://ninthinning.email"),
  title: {
    default: "Ninth Inning Email — Spoiler-free MLB recaps in your inbox",
    template: "%s · Ninth Inning Email",
  },
  description:
    "Spoiler-free MLB game recap videos delivered to your inbox the morning after. No scores, no spoilers — just the highlights.",
  keywords: ["MLB", "baseball", "highlights", "spoiler-free", "recap", "email"],
  openGraph: {
    title: "Ninth Inning Email — Spoiler-Free MLB Game Recaps",
    description:
      "Get a spoiler-free highlight reel in your inbox after every game your team plays. No scores. No spoilers. Just the best plays.",
    url: "/",
    siteName: "Ninth Inning Email",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ninth Inning Email — Spoiler-Free MLB Game Recaps",
    description:
      "Get a spoiler-free highlight reel in your inbox after every game your team plays. No scores. No spoilers. Just the best plays.",
  },
};

// No session lookup here: reading cookies in the root layout makes every route
// dynamic, so each page view becomes a full server render — far over the
// Workers Free plan's 10ms CPU budget. PostHogProvider identifies client-side.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=general-sans@400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-[#0f1311] text-[#f7f5ef] antialiased">
        <PostHogProvider />
        {children}
      </body>
    </html>
  );
}
