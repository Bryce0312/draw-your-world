import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Draw Your World · A creative studio", description: "Draw freely, share what matters, and choose what changes. A creative studio where you decide what your work means." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
