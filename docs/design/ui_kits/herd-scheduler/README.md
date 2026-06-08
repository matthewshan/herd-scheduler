# Herd Scheduler — UI Kit

An interactive, **mobile-first** prototype of the Doodle-style group scheduler, built inside a ~390px phone frame. This is the primary deliverable of the design system: a click-through realization of the brief's screens using the shared tokens in `../../colors_and_type.css`.

## Run it

Open `index.html`. A small dev-nav below the phone switches screens; on the Results screen a toggle flips between **Host view** (with "Finalize" buttons) and **Viewer**, and on **My polls** a toggle cycles the three states (**Has polls / Empty / Not a creator**). Signing in (Continue with Google) lands a creator on **My polls**.

## Screens (wired flows)

| Screen | File | Notes |
|---|---|---|
| **My polls** *(creator home)* | `MyPollsScreen.jsx` | The signed-in creator's landing screen (after sign-in). Lists the polls **you've** created, newest first; each card shows title, the dates it's for, a status pill (**Open / Closed / Finalized**), the response count, and the **leading or finalized** time (with ET + tabular figures). Per-card actions: **open results** and **copy link**. Sticky **New poll** primary action. Includes an **empty state** (no polls yet) and the **non-creator state** (signed in, but not on the host allowlist). |
| **Vote** *(core)* | `VoteScreen.jsx` | Header + host line + timezone chip, guest-name identity row (with low-key Google sign-in), one card per slot with the 3-way segmented control, sticky bottom bar with "N of M marked" progress + submit → "Saved — you can update anytime". Name validation fires on submit. |
| **Results** | `ResultsScreen.jsx` | Sorted best-fit-first; best card gets the cerulean ring + "★ Best fit"; zero-No slots get "Works for everyone"; per-card tally + stacked bar + avatars. Host-only "Finalize this time" → top "Finalized" banner + "Finalized" card marker. Viewer variant hides finalize buttons. |
| **Create** | `CreateScreen.jsx` | Title / description / location, timezone select defaulting to Eastern Time (ET), an **integrated month calendar** (`Calendar.jsx`) for picking **multiple days at once**, a time-range picker whose value becomes the **default for the next add** ("last time range selected"), a removable list of added slots, then "Create poll" → share state with copy-link. |
| **Sign in** | `SecondaryScreens.jsx` | Minimal "Continue with Google" + guest path. |
| **Admin** | `SecondaryScreens.jsx` | Owner-only approved-creator allowlist with add/remove. |

## Building blocks (`Shared.jsx`)

`Avatar`, `AvatarStack`, `TzChip`, `Segmented` (the signature control), `StackedBar`, `Tally`, `Phone` (device shell + status bar), plus the `POLL` / `PEOPLE` sample data. Icons come from `Icons.jsx` (Lucide path data, copied — see ICONOGRAPHY in the root README).

## Notes / shortcuts

- This is a **cosmetic prototype**: state is in-memory React, no persistence or real backend. Flows are wired enough to feel real (vote → submit, finalize → banner, create → share).
- Styling lives in `kit.css`; design tokens come from the root `colors_and_type.css`. No new colors are introduced.
- Fonts and Lucide icons load from CDN — needs network. For an offline skill build, self-host them.
