import Link from "next/link";
import { LEGAL_UPDATED, CONTACT_EMAIL } from "@/lib/site";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

/** Shared shell for the privacy policy and terms — same typography, one place. */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
      <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">
        Last updated {LEGAL_UPDATED}
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">{intro}</p>

      <div className="mt-12 space-y-10">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              <span className="mr-2.5 text-accent">{i + 1}.</span>
              {s.heading}
            </h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="mt-3 text-[15px] leading-relaxed text-muted">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-4 space-y-2.5">
                {s.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-3 text-[15px] leading-relaxed text-muted"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-line bg-surface p-6 shadow-book-sm">
        <h2 className="font-display text-lg font-semibold">Questions about this page?</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {CONTACT_EMAIL ? (
            <>
              Write to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="cursor-pointer font-medium text-accent-deep underline underline-offset-2 transition-colors hover:text-accent"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              or use the contact form — a person reads every message.
            </>
          ) : (
            <>Use the contact form — a person reads every message.</>
          )}
        </p>
        <Link
          href="/contact"
          className="mt-5 inline-block cursor-pointer rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
