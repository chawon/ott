<!-- omd:deprecated
replaced_at: 2026-06-14T00:00:00+09:00
replaced_by: ./DESIGN.md (bootstrapped from cookpad)
reason: omd:init bootstrap
-->

---
omd: 0.1
brand: ottline
bootstrapped_from: custom-ottline-recordbook
bootstrapped_at: 2026-06-14T00:00:00+09:00
---

# ottline Design System

## 1. Brand Frame

ottline is a personal recordbook for what people watch and read. The product should feel close enough to revisit often, but clear enough to trust with a growing timeline.

The visual direction is warm, familiar, and quietly structured. It should not feel like a submission form, a productivity dashboard, or a streaming recommendation feed.

## 2. Visual Principles

1. **Record first**: the primary surface should feel like a place to leave a note, not a task to complete.
2. **Soft but not cute**: use warmth through paper tone, calm contrast, and friendly copy. Avoid mascot-like decoration.
3. **Familiar over novel**: controls should remain recognizable. Warmth must not hide the workflow.
4. **Memory has texture**: posters, dates, small chips, and notes create the emotional signal. Do not flatten every item into identical data rows.
5. **Keep operations quiet**: admin, analytics, and settings flows can stay denser and more utilitarian than the home recording flow.

## 3. Color Tokens

Canonical light theme:

```css
--background: oklch(0.987 0.01 86);
--foreground: oklch(0.205 0.035 255);
--card: oklch(0.996 0.006 88);
--primary: oklch(0.32 0.085 250);
--primary-foreground: oklch(0.985 0.006 88);
--muted: oklch(0.956 0.014 88);
--muted-foreground: oklch(0.48 0.028 255);
--accent: oklch(0.94 0.035 210);
--accent-foreground: oklch(0.28 0.07 245);
--border: oklch(0.895 0.018 86);
--ring: oklch(0.62 0.1 230);
--ott-paper: oklch(0.984 0.014 86);
--ott-paper-strong: oklch(0.958 0.024 84);
--ott-warm: oklch(0.94 0.052 72);
--ott-warm-foreground: oklch(0.38 0.07 68);
--ott-sage: oklch(0.91 0.055 155);
--ott-sage-foreground: oklch(0.34 0.08 155);
--ott-sky-soft: oklch(0.94 0.035 220);
```

Use warm paper as a surface, not as the only palette. Balance it with brand navy, soft sky, sage, and small amber accents.

## 4. Typography

Use the existing Pretendard/Poppins stack. Keep headings compact and specific. Home and record surfaces may use slightly larger, softer headings, but operational screens should remain dense.

Rules:

1. Section headings use `font-semibold`, not heavy display weight.
2. Metadata uses small text with enough contrast to scan.
3. Button labels should sound like keeping a record, not submitting a form.

## 5. Components

### Record Surface

The QuickLog surface is a record module. It should use a paper-like card, calm border, and a single clear primary action. Search should feel like "find what I want to remember."

### Log Card

Log cards should feel collected, not filed. Poster art is the anchor. The card may have gentle hover lift, soft paper background, and warm/sage chips for place and occasion.

### Shared Records

Shared records remain compact. They should feel like nearby traces from other people, not social-feed posts.

### Buttons

Primary buttons use brand ink/navy. Secondary buttons use paper or muted surfaces. Avoid pure black for primary user-facing actions.

## 6. Voice

Korean copy should be plain, warm, and lightly conversational. English copy should be short and personal, avoiding enterprise phrasing.

Preferred verbs:

1. 남기다 / keep
2. 쌓이다 / grow
3. 이어서 적다 / add more
4. 보관하다 / save for later

Avoid:

1. 제출
2. 완료 처리
3. 데이터 입력
4. workflow-heavy labels unless the screen is operational

## 7. Motion

Motion should be quick and low amplitude. Use small fade/slide transitions already present in the app. Avoid decorative motion that competes with posters or text.

## 8. Accessibility

Warm surfaces still need clear focus states and enough text contrast. Never use low-contrast amber text for primary labels. Preserve touch target sizes already established in the app.

## 9. Scope

This design baseline applies first to user-facing home, timeline, title detail, public records, and account surfaces. Admin analytics and support consoles should inherit tokens but keep their utilitarian structure.
