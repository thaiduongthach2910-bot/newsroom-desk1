"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Newspaper, Search, Sparkles } from "lucide-react";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/source/vneconomy", label: "VnEconomy" },
  { href: "/source/nghiencuuquocte", label: "Nghiên cứu Quốc tế" },
  { href: "/archive", label: "Lưu trữ" },
];

function formatDateVi(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function TopNav() {
  // Render server-side với 1 ngày placeholder để tránh hydration mismatch,
  // sau đó update sang ngày thật ở client — cách này đảm bảo ngày luôn đúng
  // dù page bị cache ở Vercel.
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setToday(formatDateVi(new Date()));
  }, []);

  return (
    <header className="border-b border-black/10 bg-white/65 backdrop-blur">
      <div className="page-shell">
        <div className="flex flex-col gap-4 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
              <CalendarDays className="h-4 w-4" />
              <span className="capitalize">{today || "\u00A0"}</span>
            </div>
            <Link href="/" className="inline-flex items-end gap-3">
              <div className="rounded-full border border-[var(--accent-navy)] bg-[var(--accent-navy)] p-2 text-white">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent-red)]">
                  Personal Briefing Desk
                </p>
                <h1 className="headline-display text-4xl sm:text-5xl">Newsroom Desk</h1>
              </div>
            </Link>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-pill rounded-full px-4 py-2 text-sm font-medium text-[var(--accent-navy)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-[var(--ink-soft)]">
              <Sparkles className="h-4 w-4 text-[var(--accent-red)]" />
              <span>Bản đọc tin cá nhân, có giải thích và chat hỏi lại từng bài</span>
              <Search className="hidden h-4 w-4 lg:block" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
