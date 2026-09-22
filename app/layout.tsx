import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hockey Live",
  description: "Community-powered live hockey scores, updates and shareable match graphics."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
