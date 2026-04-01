import "./globals.css";

export const metadata = {
  title: "Highlight Reel — Spoiler-Free Game Recaps",
  description:
    "Get spoiler-free MLB game recap videos delivered to your inbox. No scores, no spoilers — just the highlights.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
