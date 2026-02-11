# Slide Types Reference

Five slide templates are available. Each renders as 720pt x 405pt HTML (16:9) with positioned overlay elements on an AI-generated or gradient background.

## 1. Title Slide

Full dark overlay (45% opacity). Centered title, optional subtitle and date.

**Data:**
```json
{
  "title": "Main Title Text",
  "subtitle": "Optional subtitle line",
  "date": "12.02.2026"
}
```

**Layout:** Title at y=140pt, subtitle at y=200pt, date at y=260pt. All centered within 600pt width.

**Background prompt suffix:** "Central focal point, slightly darker edges, space for centered text"

---

## 2. Content Slide

Left 65% dark overlay for text. Title + bullet list.

**Data:**
```json
{
  "title": "Section Title",
  "bullets": [
    "First point with detail",
    "Second point with detail",
    "Third point with detail",
    "Fourth point with detail",
    "Fifth point with detail"
  ]
}
```

**Layout:** Title at y=36pt, bullets start at y=85pt. Text area 410pt wide, left-aligned at x=32pt.

**Background prompt suffix:** "Subtle, not distracting, darker left area for text overlay"

---

## 3. Data Slide

Left 42% overlay with up to 3 metrics. Right side has a chart placeholder (370pt x 285pt).

**Data:**
```json
{
  "title": "Metrics Title",
  "metrics": [
    { "value": "42%", "label": "Metric description" },
    { "value": "1.2M", "label": "Another metric" },
    { "value": "99.9%", "label": "Third metric" }
  ],
  "chartLabel": "Optional chart area label"
}
```

**Layout:** Metrics stacked vertically (y=85, 150, 215). Value in 28pt bold, label in 12pt at 75% opacity. Chart placeholder at x=320pt.

**Background prompt suffix:** "Clean, professional, muted tones, will not compete with charts"

---

## 4. Features Slide

Top band overlay (80pt). Three white cards (200pt x 250pt) below.

**Data:**
```json
{
  "title": "Features Title",
  "features": [
    { "title": "Feature 1", "description": "Description of first feature" },
    { "title": "Feature 2", "description": "Description of second feature" },
    { "title": "Feature 3", "description": "Description of third feature" }
  ]
}
```

**Layout:** Title centered in top band. Cards at y=110pt, spaced at x=32, 260, 488. Card titles in 14pt dark bold, descriptions in 11pt dark.

**Background prompt suffix:** "Subtle pattern, even lighting for placing white cards on top"

---

## 5. Closing Slide

Full dark overlay (45% opacity). Centered heading + contact lines.

**Data:**
```json
{
  "heading": "Thank You",
  "contactLines": [
    "email@example.com",
    "www.example.com",
    "+7 (999) 123-45-67"
  ]
}
```

**Layout:** Heading at y=150pt in 36pt bold. Contact lines start at y=220pt, 28pt spacing between lines.

**Background prompt suffix:** "Warm, inviting, central focal point, space for centered text"

---

## Common Properties

- **Font:** Arial, Helvetica, sans-serif
- **Text color:** #ffffff (white) with varying opacity
- **Background images:** 1920x1080 PNG, referenced via `background-image: url()`
- **Overlay divs:** Semi-transparent black shapes for text readability
- **All bullet symbols** rendered via CSS `::before` pseudo-elements
