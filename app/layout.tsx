import type { Metadata, Viewport } from "next";
import InstallHockeyLive from "../components/InstallHockeyLive";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hockey-live-eight.vercel.app"),
  title: "Hockey Live",
  applicationName: "Hockey Live",
  description:
    "Fixtures, results, league tables and live match updates for the hockey teams you follow.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Hockey Live",
    description:
      "Fixtures, results, league tables and live match updates for the hockey teams you follow.",
    url: "/",
    siteName: "Hockey Live",
    type: "website"
  },
  appleWebApp: {
    capable: true,
    title: "Hockey Live",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#06111b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <InstallHockeyLive />
      </body>
    </html>
  );
}
