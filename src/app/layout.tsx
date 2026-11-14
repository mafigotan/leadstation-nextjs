import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { GlobalLoading } from "@/components/global-loading";

const font = Noto_Sans_KR({ subsets: ["latin"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: "LEADstation",
  description: "AI Powered Marketing Platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={font.variable}>
      <body>
        <GlobalLoading />
        {children}
      </body>
    </html>
  );
}
