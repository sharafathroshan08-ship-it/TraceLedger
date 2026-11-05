import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceLedger — Follow the money. Understand the network.",
  description:
    "A mini banking fraud detection simulator that uses graphs and depth-first search to investigate synthetic transaction networks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
