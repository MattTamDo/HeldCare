import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CareFall — Room Camera",
  description:
    "Fall detection and room camera monitoring for the CareFall emergency-response demo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
