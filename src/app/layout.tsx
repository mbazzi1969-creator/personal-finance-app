import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Finance MVP", description: "Personal finance + accounting (MVP)", manifest: "/manifest.webmanifest" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><div className="min-h-dvh">{children}</div></body></html>);
}
