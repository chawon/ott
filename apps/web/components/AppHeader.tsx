"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, MessageCircle, Settings, User } from "lucide-react";

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon?: React.ComponentType<{ className?: string }> }) {
    const pathname = usePathname();
    const active = pathname === href;
    return (
        <Link
            href={href}
            className={[
                "rounded-lg px-2 py-1.5 text-xs transition sm:px-3 sm:py-2 sm:text-sm",
                active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
            ].join(" ")}
        >
            <span className="flex items-center gap-2">
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {label}
            </span>
        </Link>
    );
}

export default function AppHeader() {
    return (
        <header className="border-b bg-white">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-neutral-900">
                    <img src="/icon.png" alt="On the Timeline" className="h-6 w-6 rounded-md" />
                    On the Timeline (OTT)
                </Link>

                <nav className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:flex-nowrap">
                    <NavLink href="/" label="나의 기록" icon={User} />
                    <NavLink href="/timeline" label="시청 기록" icon={Clock} />
                    <NavLink href="/public" label="함께 기록" icon={MessageCircle} />
                    <NavLink href="/account" label="설정" icon={Settings} />
                </nav>
            </div>
        </header>
    );
}
