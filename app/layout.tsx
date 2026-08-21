import type { Metadata } from "next";
import { ThemeScript } from "@/components/theme-script";
import { ReportSessionProvider } from "@/components/report-session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodWatch PH",
  description: "Public flood monitoring dashboard for the Philippines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      className="h-full antialiased"
    >
      <body className="min-h-full bg-[var(--color-background)] font-sans text-[var(--color-foreground)]">
        <ThemeScript />
        <ReportSessionProvider>{children}</ReportSessionProvider>
      </body>
    </html>
  );
}
