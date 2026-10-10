# PAYO Direction B — "Glass / voice orb" implementation spec

Source of truth: the Pen pages B1–B28 + NAV-options in `payo-v8-samples.pen`
(PNG exports in `exports/`). This file turns those pages into tokens and rules
for the React Native app in `apps/mobile`. When the PNG and this file disagree,
follow this file (it resolves the few places the pages were inconsistent).

Owner decisions (2026-10-11): ship Direction B on every screen; navigation =
**NAV option 1** (floating glass pill with the amber voice orb in the middle).

## 1. Palette (one theme — the app is always dark navy; no light mode)

| token | value | use |
|---|---|---|
| `navy` | `#0D2A3D` | gradient top, text on amber, user bubble text |
| `navyDeep` | `#071A28` | gradient bottom, PIN sheet body |
| `bg` | `#0D2A3D` | fallback flat background (same as navy) |
| `surface` (glass fill) | `rgba(255,255,255,0.08)` | cards, tiles, keypad keys, inputs, nav pill |
| `surface2` (glass fill 2) | `rgba(255,255,255,0.14)` | pressed / selected / secondary button |
| `separator` (glass line) | `rgba(255,255,255,0.15)` | 1 px border on every glass object, list separators |
| `ink` | `#F7F4EE` | primary text (cream) |
| `ink2` | `#C9D8E6` | secondary text |
| `ink3` | `#8FB8D6` | muted text, section labels, inactive icons |
| `amber` | `#F2A93B` | orb, primary button, active tab, accent icons |
| `amberDeep` | `#F2A93B` | (same as amber on dark — kept for API compat) |
| `amberTint` | `rgba(242,169,59,0.18)` | icon squares behind amber icons, active-tab halo |
| `cream` | `#FBEBD0` | people avatars (navy initials) |
| `green` / `greenTint` | `#3FC48A` / `rgba(63,196,138,0.18)` | success, "Family" pill, +amounts |
| `red` / `redTint` | `#F06A6A` / `rgba(240,106,106,0.18)` | errors, −amounts, End/stop |
| `onAmber` | `#0D2A3D` | text/icon on amber |
| `avatarBlueTint` / `avatarBlue` | `#1E4A66` / `#F7F4EE` | self avatar (AJ) and list avatars |
| `avatarVioletTint` / `avatarViolet` | `#2A2236` / `#B9A3DA` | alt list avatar |
| `white` | `#FFFFFF` | |

Background = vertical gradient `navy` → `navyDeep` filling the whole screen
(including behind the status bar and the nav). Status bar is always light.

## 2. Glass objects

- **Card** — fill `surface`, 1 px `separator` line, radius **24**, padding 20.
  No shadow. (Smaller tiles: radius 20.)
- **Tile** (quick action / family / pay hub) — glass card, radius 20–24,
  icon in a 44–56 pt square of `amberTint` with an amber icon (radius 14–16).
- **Primary button** — amber pill, 56 pt, navy 700 text. Unchanged.
- **Secondary button** — glass fill + line, cream text. **Ghost** — no fill, ink2.
  **Danger** — redTint fill, red text.
- **Chip** — 36 pt glass pill with line; selected = amber fill, navy text.
- **Input** — 56 pt glass field, 1 px line, radius 16; focus = 1.5 px amber line.
  Placeholder ink3.
- **Keypad key** — glass fill + line, radius 20, 64 pt (72 on PIN), digit 26/600 cream.
- **PIN dots** — filled = amber, empty = glass line.
- **Avatar** — default (self / list rows): `avatarBlueTint` with `avatarBlue`
  initials. People you pay (family tiles, confirmation card, Pay chips): `cream`
  with `navy` initials — pass `bg`/`color` explicitly.
- **Section label** — 12/600 uppercase, letter-spacing 0.96, `ink3` ("FAMILY",
  "RECENT ACTIVITY", "MONEY", "ACCOUNT").
- **Due-bill card** — glass card tinted amber: fill `amberTint`-ish
  (`rgba(242,169,59,0.10)`), line `rgba(242,169,59,0.35)`, amber bolt icon,
  amber "Pay" pill on the right.
- **Head row** (every screen with a person) — 40 pt avatar, name 17/700 cream,
  sub-line 14 ink2, and a **right slot**: a 56 pt amber **mini orb** (mic) on
  money screens, or the round glass language toggle ("اردو"/"EN") on Home.
- **User bubble** (chat) — amber pill, navy 17/600 text, max 78 %, radius 20
  with a 4 pt tail. **Assistant bubble** — glass card.

## 3. The voice orb

- **Hero orb (Home, greet + listening)** — 120 pt amber circle, centered,
  glow = `shadowColor amber, shadowOpacity 0.55, shadowRadius 28, offset 0/0`
  (Android: an amber `rgba(242,169,59,0.25)` 150 pt disc behind it). Icon:
  `Mic` 44 navy (idle) → `AudioLines` 44 navy (listening) with `ListeningRings`.
  Tap = start the hands-free loop; while live, tap = interrupt/stop.
- **Mini orb (head right slot, 56 pt)** — same amber + glow; on Home in the
  conversation state it IS the mic (start/stop); on Wallet/Pay it navigates to
  Home and starts listening (via `orbBus`).
- **Nav orb (60 pt, in the nav pill)** — same look, raised 10 pt above the pill.
  On Home: toggles the loop. Elsewhere: go Home + start. Shows `AudioLines`
  while listening.

## 4. Navigation — NAV option 1

Floating glass pill, in normal flow (not absolute): margin 16 horizontal,
`insets.bottom + 8` below, height 72, radius 36, fill
`rgba(16,40,58,0.92)` (glass over the gradient must stay legible), 1 px line.
Five slots: Home · Wallet · **orb** · Pay · More. Icons 24 (lucide `House`,
`Wallet`, `Send`, `Ellipsis`), labels 11/600. Active item: amber icon + label
and a 56 pt circle of `amberTint` behind it. Inactive: `ink2`. testIDs stay
`tab-home`, `tab-wallet`, `tab-pay`, `tab-more`; the orb is `nav-orb`.
The old docked `AIBar` above the tab bar is **removed** (the nav orb replaces it).
Urdu: the pill does not mirror (orb stays centre; order stays Home·Wallet·orb·Pay·More
reading from the leading edge in the RTL row — i.e. use `row-reverse` for the
labels row so Home is on the right in Urdu).

## 5. Screens (what each page shows — see the PNG for the look)

- **Home greet (B11/B1, B28 Urdu)** — head row (avatar · name · "Rs 84,500
  available" / language toggle on the right), greeting centered 34/800 (Urdu:
  Nastaliq, no forced line-height), hint "Tap the orb once, then just talk."
  (ink2, centered), hero orb, example line «“Send 2,000 to my father” · “Pay my
  bill” · “My statement”» (ink3 13, centered), FAMILY label + 4 glass tiles
  (Abbu/Bilal/Sara/Add, cream avatars 56, label 15/700), due-bill card, nav.
  Keyboard entry stays reachable: a 44 pt round glass keyboard button
  (`composer-keyboard`) to the right of the hint line opens the typed composer.
- **Home listening (B2)** — head row sub-line "Listening…", hero orb with
  `AudioLines` + rings, "Listening… just talk" (amber 17/700, centered), the
  live transcript line 28/800 centered (or the hint "Speak in Urdu, English, or
  both"), footnote ink2, amber waveform, two glass pills: "Type instead"
  (`composer-keyboard`) and "End" (`composer-stop-listening`).
- **Home conversation (B3)** — head row with status sub-line ("Speaking… tap
  to interrupt") and the mini orb on the right (`composer-stop-listening` while
  live, `composer-mic` when off), transcript (amber user bubbles, glass
  assistant cards), a slim glass composer bar above the nav: keyboard button
  (`composer-keyboard`) + the status/hint text. The PIN sheet rises over it.
- **PIN sheet (B3 bottom)** — body `navyDeep`, top corners 28, 1 px glass line
  on top, handle, title "Your PIN releases it — PAYO never sees it" (use the
  existing `pin.sheetTitle` copy), summary ink2, dots, 72 pt glass keys,
  "Cancel" ink2. Backdrop black 0.5.
- **Wallet (B5)** — head row + mini orb; "Available balance" ink2; balance
  44/800 cream + eye toggle; Send (amber pill) · Request (glass pill) · QR
  (glass round 64); 4 glass quick tiles (Send/Bills/Top-up/Savings, amber
  icons); due-bill card; RECENT ACTIVITY + "See all" (amber); one glass card
  holding the 3 rows (avatars `avatarBlueTint`, amounts −cream / +green).
- **Pay hub (B6)** — head row + mini orb; "What would you like to pay?" 32/800;
  glass search field; 2×3 glass tiles (Send money, Pay a bill, Top-up, Scan QR,
  Request, Pockets) with amber icon squares, title 20/700, sub 15 ink2; FAMILY
  row of glass chips with cream avatars.
- **More (B13)** — "More" 36/800; profile glass card (cream avatar 72, name,
  phone · PAYO wallet, chevron); MONEY group card (Savings, My card,
  Statements, Requests) and ACCOUNT group card (Language, Settings, Security &
  PIN, Notifications, Help & support) — rows with 56 pt amberTint icon squares,
  glass separators, chevrons.
- **Sign-in phone (B7)** — 72 pt orb + "PAYO" wordmark (28/800, letter-spacing 2),
  title 32/800, body ink2, phone glass field with amber focus line and a "PK +92"
  glass chip, glass keypad, amber "Send code", footnote ink3.
- **Sign-in PIN (B8) / OTP (B12) / Create PIN** — same vocabulary: orb +
  wordmark, title, dots or code boxes (glass), keypad, primary button.
- **Scam check-in (B9)** — glass card with a red-tinted header strip, the
  questions as glass choice rows, danger/secondary buttons.
- **Statement card (B4) / Statements (B14) / Receipt (B27)** — glass cards,
  amber "Open PDF" primary, totals in green/red tints.
- **Activity (B15)** — filter chips (glass / amber selected), grouped glass
  list cards.
- **Send flow (B16 who → B17 bank → B18 amount → B19 success)** — glass search,
  cream-avatar rows, amount 48/800 with glass keypad, success = 96 pt green
  check disc on glass card.
- **Bills (B20), Card (B21), Pockets (B22), Requests (B23), Profile (B24),
  Top-up (B25), QR (B26), Settings (B10)** — the same glass vocabulary; the
  card on B21 is a navy→deep gradient card with a 1 px line.

## 6. Rules

1. Never hard-code a colour in a screen — use `useTheme().c` (the glass palette)
   or the tokens. The only literal colours live in `src/theme/tokens.ts`.
2. Every glass object carries the 1 px `separator` line; no drop shadows except
   the orb glow.
3. Urdu: every row that reads as a sentence mirrors (`row-reverse`), numbers and
   amounts stay LTR (`ltrIsolate`), Nastaliq keeps its line height (Text.tsx
   already does this). The nav pill and the orb never mirror.
4. Keep every `testID` that exists today — the QA scripts and jest tests use
   them (`home-suggestion-*`, `home-family-*`, `composer-mic`,
   `composer-stop-listening`, `composer-keyboard`, `tab-*`, `keypad-*`,
   `pin-sheet-*`, `wallet-head`, `home-sheet`, `chat-statement-download`, …).
5. Motion stays as is (Rise/WordRise/Sheet settle/press scale). Reduced-motion
   paths unchanged.
6. Do not touch behaviour hooks (`useVoiceLoop`, `useConverse`, `usePinSheet`,
   API client). This is a skin + layout change.
