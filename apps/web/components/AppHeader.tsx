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
                "px-4 py-2 text-sm font-bold border-2 border-transparent hover:border-black transition-none",
                active ? "bg-black text-white border-black" : "text-black hover:bg-neutral-200"
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
        <header className="sticky top-0 z-50 border-b-4 border-black bg-white">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/" className="flex items-center gap-3 font-bold tracking-tight text-black group">
                    <div className="border-2 border-black p-1 bg-neutral-100 group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <img src="/icon.png" alt="OTT" className="h-8 w-8 pixelated" style={{ imageRendering: "pixelated" }} />
                    </div>
                    <span className="text-xl uppercase">On the Timeline</span>
                </Link>

                <nav className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                    <NavLink href="/" label="나의 기록" icon={User} />
                    <NavLink href="/timeline" label="시청 이력" icon={Clock} />
                    <NavLink href="/public" label="수다방" icon={MessageCircle} />
                    <NavLink href="/account" label="설정" icon={Settings} />
                </nav>
            </div>
        </header>
    );
}
