import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Point — Transcript to Study Deck",
  description: "Upload VTT transcripts, extract facts, build flashcards, study with spaced repetition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
