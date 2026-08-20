import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XGuard AI",
  description: "AI-assisted transaction risk review for X Layer"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
