export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-3">
      <span className="kicker">{eyebrow}</span>
      <div className="flex flex-col gap-3 border-t border-black/80 pt-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="section-title text-3xl md:text-4xl">{title}</h2>
          {description ? <p className="max-w-3xl text-sm leading-7 text-[var(--ink-soft)]">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
