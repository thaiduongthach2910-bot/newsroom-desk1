import Link from "next/link";
import { getArticles } from "@/lib/supabase";
import { DailyDigest } from "@/lib/types";

function deriveKicker(title: string): string {
  if (/morning/i.test(title)) return "Morning edition";
  if (/midday|noon/i.test(title)) return "Midday edition";
  if (/evening/i.test(title)) return "Evening edition";
  return "Today's edition";
}

export async function DigestStrip({ digest }: { digest: DailyDigest | null }) {
  if (!digest) return null;

  const articleMap = new Map((await getArticles()).map((article) => [article.slug, article]));
  const kicker = deriveKicker(digest.title);

  return (
    <section className="paper-card grid overflow-hidden rounded-[2rem] lg:grid-cols-[0.9fr_1.1fr]">
      <div className="texture-dots p-6 sm:p-8">
        <span className="kicker">{kicker}</span>
        <h2 className="headline-display mt-4 text-3xl sm:text-4xl">{digest.title}</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-soft)]">{digest.intro}</p>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
        {digest.articleSlugs.map((slug, index) => {
          const article = articleMap.get(slug);
          return (
            <Link
              key={slug}
              href={`/article/${slug}`}
              className="rounded-[1.4rem] border border-black/10 bg-white/75 p-4 transition hover:-translate-y-1"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent-red)]">Mục {index + 1}</p>
              <p className="mt-3 headline-serif text-lg font-bold line-clamp-3">
                {article?.title || slug.replaceAll("-", " ")}
              </p>
              {article?.sourceLabel ? (
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  {article.sourceLabel}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
