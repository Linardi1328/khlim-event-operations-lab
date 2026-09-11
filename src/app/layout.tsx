import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "KHLIM · Event Operations Lab",
    template: "%s · KHLIM Lab",
  },
  description:
    "A synthetic one-day 3×3 basketball tournament. Astra Experiment #002.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
