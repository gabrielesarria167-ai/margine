---
version: 1
slug: "src-renderer-index-html"
primary_target: "src/renderer/index.html"
related_targets: []
---

# Margine app shell (src/renderer)

Scope: the whole Electron renderer (setup, Dashboard, Transazioni, Risparmi, every form). Mode: Operate.
Audience and job: the owner and a few people they share it with, at a desk, logging movements and answering "how much can I spend?" before buying.
Constraints: Italian copy; Scrollcraft taste floor binding (see PRODUCT.md Brand Commitments); fonts served locally; works at 960x640 minimum window.
Memorable moment: typing an expense amount and watching the marker on the fascia cross from green into stone.
Build path: code-led (no image generation on this machine).

## Direction contract

THESIS: Margine's state is one continuous band at eye level, the fascia of the Milan Metropolitana, drawn to scale: a stone stretch for Risparmio protetto, a line-green stretch for Denaro spendibile. It refuses the category default of three equal stat cards and a donut.

OWN-WORLD: stone rail #2E3033 with enamel ground #ECEDE9, ink #17191B, tinted soft ink #5E6461, one accent line-green #007A43 (Linea 2 #00874A taken one step darker because green is also text on enamel and #00874A reads 3.9:1 there; Linea 1 red translated because "in rosso" means overdrawn); protected stone #52565A, lighter than the rail so the band never merges with it, signal red #C8261E only for exception and deficit. Archivo alone, tabular figures. Square-ish 4px radius, hairline rules, no cards-as-structure.

STORY: the user sees what they can spend before anything else, understands why (the band shows the protected stretch beside it), and acts through one primary action, Nuova spesa.

FIRST VIEWPORT: left stone rail (traffic lights, Margine wordmark, Dashboard, Transazioni, Risparmi, Nuova spesa primary at the rail foot). Across the content top, the fascia at full width, 64px tall (to carry 24px signage amounts under 12px labels), segments sized to amounts, white label and amount on each. Beneath, Denaro spendibile at ~6rem with its status line; to its right the goal state. One ruled row: Patrimonio, Contanti, Conto, Ultimo controllo. Then Ultimi movimenti.

FORM: Milan Metro signage band (Noorda), position 7 of the ordered list; seed key 0a7ea5d7. Signature move: the fascia, live; an expense amount moves a marker along it and a crossing into stone becomes a red Eccezione stop that opens the exception step. Raises: one message per band stretch (airport); one grotesque (annual); spendable owns the first viewport (feed); history header names the date span in view (lexicon); total palette commitment (datamatics).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
