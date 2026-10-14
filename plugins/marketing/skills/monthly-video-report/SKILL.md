---
name: monthly-video-report
description: Build a branded PowerPoint slide from Digiteka videofeed report data. Use when the user asks for a Digiteka report, video performance slide, deck or presentation (impressions, completion rates, by group or device).
---

# Digiteka report slide

## Workflow

1. **Fetch data** with the `get-videofeed-report` tool of the digiteka MCP server.
   If it returns an error, report it to the user and stop. Never invent figures.
2. **Analyse**: compute streams, per month, and flag notable changes (vs previous
  month, vs same month last year).
3. **Apply the brand**: read the `brand-guidelines` skill first and use its colors,
  fonts, logo and layout rules. Do not hardcode your own styling.
4. **Build the slide** with the `pptx` skill:
   - Title: NOMBRE DE STREAMS PAR MOIS – 9:16
   - One chart, stacked bar streams per month, over the last 13 months.
   - Legend: the groups.
   - Footer: source "Digiteka", generation date.
5. **Verify**: render the slide to an image and check for overflow, legibility
  and brand compliance before delivering.

## Rules

- Use only numbers returned by the tool.
- Format numbers for French readers (space as thousands separator, comma as decimal)
  unless the user asks otherwise.
- Keep one message per slide. Offer extra slides rather than overloading one.
- Rates come back as raw values; check whether they are percentages or ratios
  before displaying.