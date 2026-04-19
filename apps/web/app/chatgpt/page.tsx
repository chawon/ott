import type { Metadata } from "next";
import { headers } from "next/headers";

import { getChatGptCopy, resolveChatGptLocale } from "@/lib/chatgpt/copy";

const canonicalUrl = "https://ottline.app/chatgpt";

async function getPageCopy() {
  const requestHeaders = await headers();
  return getChatGptCopy(
    resolveChatGptLocale(requestHeaders.get("accept-language")),
  ).page;
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getPageCopy();

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      url: canonicalUrl,
    },
  };
}

export default async function ChatGptPage() {
  const copy = await getPageCopy();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_#f7fbff_0%,_#eef5ff_45%,_#f8fafc_100%)] px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="grid gap-8 rounded-[2rem] border border-sky-100 bg-white/90 p-8 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-5">
            <p className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-sky-700 uppercase">
              {copy.heroEyebrow}
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                {copy.heroTitle}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                {copy.heroDescription}
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="font-medium text-slate-900">
                  {copy.cards.connectTitle}
                </p>
                <p className="mt-2">{copy.cards.connectBody}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="font-medium text-slate-900">
                  {copy.cards.timelineTitle}
                </p>
                <p className="mt-2">{copy.cards.timelineBody}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="font-medium text-slate-900">
                  {copy.cards.promptTitle}
                </p>
                <p className="mt-2">{copy.cards.promptBody}</p>
              </div>
            </div>
          </div>
          <aside className="rounded-[1.75rem] bg-slate-950 p-6 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">
              {copy.accessTitle}
            </p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
              {copy.accessItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              {copy.privacyLabel}:{" "}
              <a className="text-sky-300 underline" href="/privacy">
                ottline.app/privacy
              </a>
              <br />
              {copy.supportLabel}:{" "}
              <a
                className="text-sky-300 underline"
                href="mailto:contact@ottline.app"
              >
                contact@ottline.app
              </a>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-xl font-semibold text-slate-950">
              {copy.toolSurfaceTitle}
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              {copy.toolItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-xl font-semibold text-slate-950">
              {copy.reviewTitle}
            </h2>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              {copy.reviewBody}
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
