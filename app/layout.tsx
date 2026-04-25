import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tallea — Know your fit before you buy",
  description:
    "Tallea is a Buenos Aires fit-intelligence company building shopper-confidence guidance for online apparel commerce.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} bg-background`}>
      <body className="bg-background text-foreground min-h-screen antialiased">
        <SiteNav />
        <main className="pb-32">{children}</main>
      </body>
    </html>
  );
}
