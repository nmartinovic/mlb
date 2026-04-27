import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://ninthinning.email"),
  title: {
    default: "Ninth Inning Email — Spoiler-free MLB recaps in your inbox",
    template: "%s · Ninth Inning Email",
  },
  description:
    "Spoiler-free MLB game recap videos delivered to your inbox the morning after. No scores, no spoilers — just the highlights.",
  keywords: ["MLB", "baseball", "highlights", "spoiler-free", "recap", "email"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ninth Inning Email — Spoiler-free MLB recaps",
    description:
      "Pick your teams. We email the recap. No scores, no spoilers.",
    url: "/",
    siteName: "Ninth Inning Email",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ninth Inning Email — Spoiler-free MLB recaps",
    description:
      "Pick your teams. We email the recap. No scores, no spoilers.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a1410] text-[#f5f1e6] antialiased">
        {children}
      </body>
    </html>
  );
}
