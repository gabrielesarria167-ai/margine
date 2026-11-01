---
name: Margine
description: Personal Finance Tracker. Owned money drawn to scale as one signage band, protected stone beside spendable green.
colors:
  canvas: "#ECEDE9"
  surface: "#F8F8F5"
  ink: "#17191B"
  ink-soft: "#5E6461"
  rule: "#CDD0CB"
  rule-strong: "#A9AEA9"
  rail: "#2E3033"
  rail-2: "#3B3E41"
  rail-ink: "#F1F2EE"
  rail-ink-soft: "#AEB4B0"
  protected: "#52565A"
  protected-ink: "#F1F2EE"
  accent: "#007A43"
  accent-strong: "#006637"
  accent-ink: "#FFFFFF"
  accent-wash: "#D3E8DB"
  signal: "#C8261E"
  signal-strong: "#A81E17"
  signal-ink: "#FFFFFF"
  signal-wash: "#F5DCD9"
  signal-on-stone: "#F5DCD9"
  dark-canvas: "#1C1E20"
  dark-surface: "#25282A"
  dark-ink: "#E9EAE6"
  dark-ink-soft: "#A0A7A3"
  dark-rule: "#34383A"
  dark-rule-strong: "#4B5053"
  dark-rail: "#131516"
  dark-rail-2: "#232628"
  dark-rail-ink-soft: "#969D99"
  dark-protected: "#474B4E"
  dark-accent: "#3DBB7A"
  dark-accent-strong: "#5CCB91"
  dark-accent-ink: "#08140D"
  dark-accent-wash: "#1E3A2A"
  dark-signal: "#F0645A"
  dark-signal-strong: "#F5837B"
  dark-signal-ink: "#1A0B0A"
  dark-signal-wash: "#3D2220"
  dark-signal-on-stone: "#F8C9C4"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "5.5rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  signage-amount:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  signage-label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-lg:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  r: "4px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
  s12: "48px"
  s16: "64px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "38px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-signal:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.signal-ink}"
    rounded: "{rounded.r}"
    padding: "0 16px"
    height: "38px"
  button-signal-hover:
    backgroundColor: "{colors.signal-strong}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.r}"
    padding: "0 12px"
    height: "40px"
  input-money-lg:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "0 12px 0 36px"
    height: "52px"
  nav-item:
    textColor: "{colors.rail-ink-soft}"
    rounded: "{rounded.r}"
    padding: "0 12px"
    height: "38px"
  nav-item-active:
    backgroundColor: "{colors.rail-2}"
    textColor: "{colors.rail-ink}"
  fascia-protected:
    backgroundColor: "{colors.protected}"
    textColor: "{colors.protected-ink}"
    padding: "0 20px"
    height: "64px"
  fascia-spendable:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    padding: "0 20px"
    height: "64px"
  fascia-crossing:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.signal-ink}"
    padding: "0 16px"
    height: "64px"
  toast:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.r}"
    padding: "12px 16px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    width: "440px"
---

# Design System: Margine

## Overview

**Creative North Star: "La Fascia"**

Margine is drawn like a Milan Metropolitana platform: a dark stone rail on the left, enamel panels for content, and one continuous band of colour at eye level across the top that tells the user, in two stretches, what is protected and what is spendable. The band is to scale. Its stone stretch is Risparmio protetto, its line-green stretch is Denaro spendibile, and each stretch carries exactly one message: a small uppercase label over a large signage amount. Everything else on screen is quieter than the band.

The system is a working desk tool, not a showcase. Density is moderate, structure comes from hairline rules and ruled rows rather than cards, and there is one grotesque (Archivo) set with tabular figures everywhere. Colour is committed and sparse: stone and green carry meaning, red appears only for an exception or a deficit, and everything else is enamel, ink and tinted grey. A system-dark variant swaps every token through `prefers-color-scheme` while keeping the same roles.

Rejected by the build: three equal stat cards and a donut as the dashboard answer; cards as structural containers; a second type family.

**Key Characteristics:**
- One full-width signage band (64px) holds the money state, segments sized to amounts.
- Stone rail, enamel ground, ink text; one accent green; signal red reserved for exception and deficit.
- Archivo only, tabular numerals on every amount, tracking tightens as size grows.
- Hairline rules and ruled rows instead of cards; square-ish 4px corners.
- Motion is short (100 to 200ms), on transform, opacity and clip-path, with one ease-out curve.

## Colors

A metro-signage palette: warm-grey enamel and stone, one line-green, one signal red, never pure black.

### Primary
- **Linea Green** (accent): the spendable stretch of the fascia, the single primary action (Nuova spesa, form submit), income amounts, links, the active nav icon, the focus ring and the caret. Taken one step darker than Linea 2 so green text clears 4.5:1 on enamel. Accent Strong is its hover; Accent Wash is the focus halo on inputs and the text-selection fill.

### Secondary
- **Ceppo Stone** (protected): the protected stretch of the fascia and the 3px top rule over the savings goal block. Deliberately lighter than the rail so the band never merges into it.

### Tertiary
- **Signal Red** (signal): exceptions and deficits only. The red crossing stretch on the fascia, the signal button that continues into an exception, field errors, the over-spendable verdict, the Eccezione tag and the deficit status. Signal Wash backs warnings and form-level errors; Signal Strong is hover and the deficit segment's text. Signal On Stone (#F5DCD9, dark #F8C9C4, 5.7:1 on the protected stone) is a deficit message set on the stone when its own stretch is too narrow to hold it.

### Neutral
- **Enamel** (canvas): app ground and fascia ground.
- **Bright Enamel** (surface): inputs and the side sheet, one step lifted from canvas.
- **Platform Ink** (ink): primary text, the fascia stop marker.
- **Soft Ink** (ink-soft): secondary text, column headers, hints, the zero-state hero figure. Tinted green-grey, never a neutral grey.
- **Hairline** (rule) and **Strong Hairline** (rule-strong): row dividers and section rules; control borders and table header underline.
- **Rail Stone** (rail, rail-2, rail-ink, rail-ink-soft): the left navigation rail, its hover and active fill, and its text. The toast also wears the rail.

### Named Rules
**The Two Stretches Rule.** Stone means protected and green means spendable, everywhere. Neither colour is used for anything that could be read as the other's money.

**The Red Means Exception Rule.** Signal red appears only when protected money is touched or the goal is in deficit. It is never decoration, never a generic destructive colour, never a second accent.

**The Enamel Not Black Rule.** Text is Platform Ink, surfaces are tinted enamel; no pure black or pure white grounds.

## Typography

**Display Font:** Archivo (variable, self-hosted, OFL; fallback system-ui, sans-serif)
**Body Font:** Archivo
**Label Font:** Archivo

**Character:** One grotesque in the Noorda signage tradition, used across a wide weight range (400 to 700, with 550 and 650 as working intermediates) and always with tabular figures, so amounts align and read as signage.

### Hierarchy
- **Display** (650, 5.5rem, line-height 1, -0.035em): the one hero figure per view, Denaro spendibile on the dashboard and Risparmio protetto on Risparmi. Steps down to 4.25rem when the main column is under 900px.
- **Headline** (650, 2rem, 1.1, -0.02em): view titles; the savings goal figure.
- **Title** (650, 1.25rem, -0.01em): section headings; sheet titles step up to 1.5rem.
- **Signage Amount** (700, 1.5rem, 1.2, -0.015em): amounts inside the fascia; one size smaller (1.25rem) when a stretch is tight.
- **Signage Label** (600, 0.75rem, 0.04em, uppercase): the one-word name on each fascia stretch and table column headers. Uppercase is reserved for these two signage roles.
- **Body** (400, 0.875rem, 1.5): default UI text, table cells.
- **Body Large** (400, 1rem, 1.6): prose explanations (max 62ch), inputs, answer notes (max 52ch), table amounts at 600.
- **Label** (600, 0.8125rem): form labels, legends, small headings above figures.

### Named Rules
**The Tight At Size Rule.** Letter-spacing tightens as size grows: -0.035em at display, -0.02em at headline, -0.01em at title, normal at body; only the small uppercase signage label opens up (+0.04em).

**The Tabular Everything Rule.** Every amount uses tabular numerals; the body sets `tnum` globally.

## Layout

A fixed two-column shell: a 232px stone rail on the left (drag region, wordmark, three nav items, the primary Nuova spesa button pinned to the foot) and the content column. The content column is a grid of the 64px fascia on top and a scrolling main area below, padded 40px top, 48px sides, 64px bottom, with views capped at 1120px.

The dashboard answers first: the hero figure on the left and the goal state in a 300px column on the right, 48px apart; under 900px of main width (container query) they stack and the goal state turns into one wrapped row. Below sits one ruled row of "stations" (Patrimonio, Contanti, Conto, Ultimo controllo), auto-fit columns of at least 150px separated by vertical hairlines, then the movements table.

Spacing follows a 4px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). Section gaps are 48px, view-head to content 32px, form fields 20px apart inside the sheet. The minimum window is 960x640.

## Elevation & Depth

Flat by default. Depth comes from tonal steps (rail darker than canvas, surface lighter than canvas) and hairline rules, not shadows. Only two elements float, and only because they overlay content.

### Shadow Vocabulary
- **Sheet** (`box-shadow: -16px 0 40px -16px rgb(23 25 27 / 0.32)`): the right-hand form sheet, casting leftwards over the content.
- **Toast** (`box-shadow: 0 2px 4px rgb(23 25 27 / 0.08), 0 12px 28px -10px rgb(23 25 27 / 0.35)`): the confirmation toast.

### Named Rules
**The Only Overlays Float Rule.** A shadow means the element sits above the page (sheet, toast). Nothing at rest in the page flow carries a shadow.

## Shapes

Square-ish. One radius (4px) for buttons, inputs, nav items, choice rows, warnings and the toast. The fascia and its segments are unrounded full-bleed rectangles, as is the sheet. Borders are 1px hairlines; heavier strokes appear only with meaning: the 3px stone rule over the goal state, the 2px dashed outline inset 6px marking a missing or deficit stretch of the band, and the 8px ink stop marker with 2px enamel edges.

The wordmark is a miniature fascia: a 22x8px bar split 3:1 into soft stone and green.

## Components

### Buttons
Plain, outlined, confident; one filled button per context.
- **Shape:** gently squared (4px), 38px tall (42px at the rail foot), 16px horizontal padding, weight 600, optional 16px icon with 8px gap.
- **Default:** transparent with a strong-hairline border and ink text. Hover tints the ground with 6% ink and darkens the border to soft ink.
- **Primary:** Linea Green fill and border, white text; hover to Accent Strong. Only one per surface: Nuova spesa in the rail, the submit in a sheet.
- **Signal:** Signal Red fill, used only to continue into or confirm an exception.
- **Ghost:** no border, for low-weight additive actions (Aggiungi un conto).
- **States:** active nudges down 1px; disabled at 45% opacity with not-allowed cursor; busy at 70% with progress cursor; focus-visible draws a 2px accent ring offset 2px (rail-ink ring on the green rail button).

### Inputs / Fields
- **Style:** Bright Enamel ground, strong-hairline border, 4px radius, 40px tall, 1rem text. Labels sit above at 0.8125rem/600 with a 6px gap; hints and errors below in soft ink or signal.
- **Money input:** a soft-ink euro sign inset at 12px, amount at weight 600; the large variant (52px tall, 1.5rem) is the amount field that drives the fascia preview.
- **Focus:** border turns accent with a 3px Accent Wash halo. Invalid: signal border, signal-wash halo on focus.
- **Choice rows:** full-width outlined radio rows (12px 16px padding) with a bold title and soft-ink description; the checked row takes an ink border and a 4% ink tint.

### Navigation
The rail nav: 38px rows, 12px padding, 18px stroked icon plus label at 500 in Rail Ink Soft. Hover and active fill with rail-2 and brighten to Rail Ink; the active item is 650 with a green icon.

### Tables and ruled rows
Movements and goal history are open tables: uppercase signage-label headers in soft ink over a strong hairline, rows divided by hairlines, first and last columns flush, amounts right-aligned at 1rem/600 (income in green, transfers in soft ink at 500). Inline tags are small outlined pills in soft ink; the exception tag is outlined in signal.

### Sheet
All forms open in a 440px right-hand sheet starting below the fascia, so the band stays visible while typing. Head, scrolling body and foot are separated by hairlines; Annulla or Indietro sits left, the submit right. Enters with 24px slide and fade over 200ms.

### La Fascia (signature)
The 64px band across the content top, drawn to scale with the larger of patrimonio and goal. Stretches in order: stone (Protetto, or Coperto when the goal is not yet met), then a dashed Mancano or red-washed Deficit stretch if the goal exceeds what is owned, then green Spendibile. Each stretch carries one label and one amount in protected-ink or accent-ink, every label on one shared top line. Fitting is measured, not guessed: a stretch tries full size, then tight (1.25rem amount, 12px padding), then compact (1rem amount, 8px padding); a stretch too narrow even for compact keeps its full-size message beside it, inside the neighbouring stretch against their shared edge and in that neighbour's ink, while the sliver itself drops its padding to stay at its true width. When the first stretch places its message into the next one, the host's own message moves to its far end so the two never collide. The band is never widened to make text fit. While an expense amount is typed, the band is cut back from the right (canvas fill, a "Spesa" label), an 8px ink stop marks where the balance will land, and any part that crosses into stone turns Signal Red labelled "Dal risparmio". Transitions are 200ms clip-path and transform on the ease-out curve; reduced motion drops them.

## Do's and Don'ts

### Do:
- **Do** keep the fascia as the first thing on every view and give each stretch exactly one label and one amount.
- **Do** use stone only for protected money and Linea Green only for spendable money, primary actions, income and focus.
- **Do** set every amount in Archivo with tabular numerals, tightening tracking as size grows (-0.035em at 5.5rem).
- **Do** build structure from hairline rules (1px rule, rule-strong for control borders) and ruled rows.
- **Do** keep motion at 100 to 200ms on transform, opacity or clip-path with `cubic-bezier(0.23, 1, 0.32, 1)`, and drop it under reduced motion.
- **Do** give every control hover, focus-visible, active and disabled states.
- **Do** open forms in the right-hand sheet below the fascia so the band can preview the change live.

### Don't:
- **Don't** answer "how much can I spend" with stat cards or a donut; the band and one hero figure carry it.
- **Don't** use Signal Red for anything other than exceptions and deficits.
- **Don't** add a second type family or use pure black.
- **Don't** put shadows on in-flow elements; only the sheet and toast float.
- **Don't** wrap content sections in cards or rounded panels.
- **Don't** use uppercase outside the fascia labels and table column headers.
