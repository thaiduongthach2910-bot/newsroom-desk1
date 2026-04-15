import Link from "next/link";
import { DailyDigest } from "@/lib/types";

export function DigestStrip({ digest }: { digest: DailyDigest | null }) {
  if (!digest) {
    return null;
  }

  return (
    <section className="paper-card grid overflow-hidden rounded-[2rem] lg:grid-cols-[0.9fr_1.1fr]">
      <div className="texture-dots p-6 sm:p-8">
        <span className="kicker">06:00 edition</span>
        <h2 className="headline-display mt-4 text-3xl sm:text-4xl">{digest.title}</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-soft)]">{digest.intro}</p>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
        {digest.articleSlugs.map((slug, index) => (
          <Link
            key={slug}
            href={`/article/${slug}`}
            className="rounded-[1.4rem] border border-black/10 bg-white/75 p-4 transition hover:-translate-y-1"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-red)]">Mục {index + 1}</p>
            <p className="mt-3 headline-serif text-lg font-bold line-clamp-3">
              {slug.replaceAll("-", " ")}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
