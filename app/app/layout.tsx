import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TopLoader from "./components/TopLoader";
import { NetworkProvider } from "@/context/NetworkContext";
import NetworkFloatingToggle from "./components/NetworkFloatingToggle";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nocturne Markets | Public Prices. Private People.",
  description: "Private prediction markets mirroring Polymarket with shielded Zcash parimutuel pools.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans bg-black text-zinc-100">
        <NetworkProvider>
          <TopLoader />
          {children}
          <NetworkFloatingToggle />
        </NetworkProvider>
      </body>
    </html>
  );
}

