import {
  Apple,
  Bot,
  ExternalLink,
  Globe,
  type LucideIcon,
  MonitorDown,
  Puzzle,
  Smartphone,
  Store,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link as IntlLink } from "@/i18n/routing";

type PlatformLink = {
  href: string;
  label: string;
  external: boolean;
  icon: LucideIcon;
};

type PlatformItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  links?: PlatformLink[];
  status?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: "https://ottline.app/about",
      languages: {
        ko: "https://ottline.app/about",
        en: "https://ottline.app/en/about",
        "x-default": "https://ottline.app/about",
      },
    },
    openGraph: {
      title: `${t("title")} | ottline`,
      description: t("description"),
      url: "https://ottline.app/about",
    },
  };
}

export default function AboutPage() {
  const tAbout = useTranslations("About");
  const platforms: PlatformItem[] = [
    {
      title: tAbout("platformWebTitle"),
      description: tAbout("platformWebDesc"),
      icon: Globe,
      links: [
        {
          href: "/",
          label: tAbout("platformWebLink"),
          external: false,
          icon: Globe,
        },
      ],
    },
    {
      title: tAbout("platformAndroidTitle"),
      description: tAbout("platformAndroidDesc"),
      icon: Smartphone,
      links: [
        {
          href: "https://play.google.com/store/apps/details?id=app.ottline",
          label: tAbout("platformAndroidLink"),
          external: true,
          icon: Store,
        },
      ],
    },
    {
      title: tAbout("platformIosTitle"),
      description: tAbout("platformIosDesc"),
      icon: Apple,
      links: [
        {
          href: "https://apps.apple.com/app/ottline/id6780318110",
          label: tAbout("platformIosLink"),
          external: true,
          icon: Store,
        },
      ],
    },
    {
      title: tAbout("platformWindowsTitle"),
      description: tAbout("platformWindowsDesc"),
      icon: MonitorDown,
      links: [
        {
          href: "https://apps.microsoft.com/detail/9nsvnzgdmgf5",
          label: tAbout("platformWindowsLink"),
          external: true,
          icon: Store,
        },
      ],
    },
    {
      title: tAbout("platformExtensionTitle"),
      description: tAbout("platformExtensionDesc"),
      icon: Puzzle,
      links: [
        {
          href: "https://chromewebstore.google.com/detail/achangjgnpbideilpolbohbkmmkmojpo",
          label: tAbout("platformExtensionChromeLink"),
          external: true,
          icon: Store,
        },
        {
          href: "https://microsoftedge.microsoft.com/addons/detail/egghbkekjopgknhggoeiekgdooofihbo?hl=ko",
          label: tAbout("platformExtensionEdgeLink"),
          external: true,
          icon: Store,
        },
        {
          href: "https://store.whale.naver.com/detail/fdifiinpckjcafdndikchfhmkejhdfhc",
          label: tAbout("platformExtensionWhaleLink"),
          external: true,
          icon: Store,
        },
      ],
    },
    {
      title: tAbout("platformTossTitle"),
      description: tAbout("platformTossDesc"),
      icon: Wallet,
      links: [
        {
          href: "https://minion.toss.im/XYvjpUB2",
          label: tAbout("platformTossLink"),
          external: true,
          icon: Wallet,
        },
      ],
    },
    {
      title: tAbout("platformChatGptTitle"),
      description: tAbout("platformChatGptDesc"),
      icon: Bot,
      status: tAbout("platformPreparing"),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10 text-foreground">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{tAbout("subtitle")}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tAbout("description")}
        </p>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(224,242,254,0.82))] p-6 text-slate-900">
        <h2 className="text-lg font-semibold">
          {tAbout("pairingHighlightTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {tAbout("pairingHighlightDesc")}
        </p>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="border-b border-border pb-2 text-xl font-semibold">
            {tAbout("platformsTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {tAbout("platformsDesc")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.map((platform, index) => {
            const PlatformIcon = platform.icon;

            return (
              <article
                key={platform.title}
                className="rounded-2xl border border-border bg-muted/30 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-foreground">
                    <PlatformIcon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-3 font-medium">{platform.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {platform.description}
                </p>
                {platform.links ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {platform.links.map((link) => {
                      const LinkIcon = link.icon;
                      const content = (
                        <>
                          <LinkIcon className="h-3.5 w-3.5" />
                          <span>{link.label}</span>
                          {link.external ? (
                            <ExternalLink className="h-3 w-3" />
                          ) : null}
                        </>
                      );
                      const className =
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card";
                      return link.external ? (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className={className}
                        >
                          {content}
                        </a>
                      ) : (
                        <IntlLink
                          key={link.href}
                          href={link.href}
                          className={className}
                        >
                          {content}
                        </IntlLink>
                      );
                    })}
                  </div>
                ) : null}
                {platform.status ? (
                  <div className="mt-4 inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900">
                    {platform.status}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-border pb-2 text-xl font-semibold">
          {tAbout("howToUseTitle")}
        </h2>
        <div className="grid gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="font-medium">{tAbout("step1Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("step1Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-medium">{tAbout("step2Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("step2Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-medium">{tAbout("step3Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("step3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-border pb-2 text-xl font-semibold">
          {tAbout("moreTipsTitle")}
        </h2>
        <div className="grid gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="font-medium">{tAbout("tip1Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("tip1Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="font-medium">{tAbout("tip2Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("tip2Desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h3 className="font-medium">{tAbout("tip3Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {tAbout("tip3Desc")}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <figure className="space-y-2">
                  <Image
                    src="/og/share-card?sample=video"
                    alt={tAbout("exampleVideo")}
                    className="w-full rounded-2xl border border-border bg-muted/40"
                    width={1200}
                    height={630}
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {tAbout("exampleVideo")}
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  <Image
                    src="/og/share-card?sample=book"
                    alt={tAbout("exampleBook")}
                    className="w-full rounded-2xl border border-border bg-muted/40"
                    width={1200}
                    height={630}
                  />
                  <figcaption className="text-xs text-muted-foreground">
                    {tAbout("exampleBook")}
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-muted/60 p-6 italic text-muted-foreground">
        {tAbout("closing")}
      </section>
    </div>
  );
}
