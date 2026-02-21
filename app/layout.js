import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "TrendForge — Opportunity Intelligence",
  description:
    "AI-powered opportunity intelligence for indie hackers and solo founders",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background font-sans">
        <header className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-foreground">
                TrendForge
              </span>
              <span className="text-xs text-muted-foreground font-mono mt-0.5">
                v1
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Ideas
              </Link>
              <Link
                href="/buckets"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Buckets
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
