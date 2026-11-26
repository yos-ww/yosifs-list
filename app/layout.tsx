import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

// Body text: clean and modern.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Receipt numbers and store names.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The "Yosif's List" title: classy italic serif.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: "italic",
});

export const metadata: Metadata = {
  title: "Yosif's List",
  description:
    "Type your grocery list and see which store in Doha gives you the cheapest total.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
