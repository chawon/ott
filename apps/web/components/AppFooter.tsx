"use client";

import Link from "next/link";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

export default function AppFooter() {
  const currentYear = new Date().getFullYear();
  const { isRetro } = useRetro();

  return (
    <footer className={cn(
      "mt-20 border-t py-12",
      isRetro ? "border-black bg-white" : "border-neutral-100 bg-neutral-50/50"
    )}>
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className={cn(
              "text-sm font-bold tracking-tighter",
              isRetro ? "text-black uppercase" : "text-neutral-900"
            )}>
              {isRetro ? "으뜸과 버금" : "On the Timeline"}
            </div>
            <p className={cn(
              "text-xs leading-relaxed",
              isRetro ? "font-bold text-neutral-600" : "text-neutral-500"
            )}>
              {isRetro 
                ? "봤니? 그럼 날적이 해보자~ 한 번 적어 두면 발자취가 또렷해져요." 
                : "로그인 없이 10초 만에 남기는 OTT 시청 기록. 나만의 필모그래피를 가장 빠르게 기록하고 공유하세요."}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={cn(
              "text-xs font-bold uppercase tracking-widest",
              isRetro ? "text-black" : "text-neutral-900"
            )}>
              {isRetro ? "둘러보기" : "서비스"}
            </h3>
            <ul className={cn(
              "space-y-2 text-xs",
              isRetro ? "font-bold text-neutral-800" : "text-neutral-600"
            )}>
              <li>
                <Link href="/" className="hover:underline">{isRetro ? "날적이" : "기록하기"}</Link>
              </li>
              <li>
                <Link href="/timeline" className="hover:underline">{isRetro ? "발자취" : "타임라인"}</Link>
              </li>
              <li>
                <Link href="/public" className="hover:underline">{isRetro ? "서로 날적이" : "함께"}</Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className={cn(
              "text-xs font-bold uppercase tracking-widest",
              isRetro ? "text-black" : "text-neutral-900"
            )}>
              {isRetro ? "도움말" : "안내"}
            </h3>
            <ul className={cn(
              "space-y-2 text-xs",
              isRetro ? "font-bold text-neutral-800" : "text-neutral-600"
            )}>
              <li>
                <Link href="/about" className="hover:underline">{isRetro ? "소개" : "서비스 소개"}</Link>
              </li>
              <li>
                <Link href="/faq" className="hover:underline">{isRetro ? "물음방" : "자주 묻는 질문"}</Link>
              </li>
            </ul>
          </div>

          <div className={cn(
            "space-y-4 text-xs",
            isRetro ? "font-bold text-neutral-400" : "text-neutral-400"
          )}>
            <p>© {currentYear} {isRetro ? "으뜸과 버금" : "On the Timeline"}. All rights reserved.</p>
            <p>{isRetro ? "당신의 비디오를 기억하며." : "Designed for the moments you watch."}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
