import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: { default: "Lectoire — read, explore, create books", template: "%s · Lectoire" },
  description:
    "A home for books: explore the store, build your library, and create books with an AI writing partner.",
  applicationName: "Lectoire",
  // Installed on an iPhone, open full-screen under our own title rather than Safari's chrome.
  appleWebApp: { capable: true, title: "Lectoire", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${dmSans.variable}`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
