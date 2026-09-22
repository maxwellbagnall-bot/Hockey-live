import type { Metadata, Viewport } from "next";
import InstallHockeyLive from "../components/InstallHockeyLive";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hockey Live",
  applicationName: "Hockey Live",
  description:
    "Community-powered live hockey scores, match clocks and updates.",
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
