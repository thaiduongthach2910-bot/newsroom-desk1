import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
});

const serif = Merriweather({
  subsets: ["latin", "vietnamese"],
  variable: "--font-serif",
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Newsroom Desk",
  description: "Dashboard đọc tin hằng ngày với tóm tắt, giải thích và chat hỏi lại theo từng bài.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${sans.variable} ${serif.variable} bg-[var(--paper)] text-[var(--ink)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
