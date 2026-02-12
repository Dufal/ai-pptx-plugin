# ai-pptx

Claude Code plugin for creating PowerPoint presentations with AI-generated backgrounds via Google Whisk API.

## Features

- **AI-generated backgrounds** — unique images for every slide via Whisk (IMAGEN 3.5 / GEM_PIX / R2I)
- **Style consistency** — title slide anchors the visual style, all other slides follow
- **Reference images** — upload your own brand images for style matching
- **Gradient fallback** — works offline with auto-generated gradient backgrounds
- **Flexible slide list** — any number of slides in any order using available templates
- **HTML-to-PPTX** — pixel-precise positioning via Playwright + PptxGenJS
- **Thumbnail validation** — auto-generated grid for quick visual review

## Installation

### As Claude Code Plugin

```bash
# In Claude Code, add the marketplace and install:
/plugin marketplace add https://github.com/Dufal/ai-pptx-plugin
/plugin install ai-pptx
```

### Manual / Standalone

```bash
git clone https://github.com/Dufal/ai-pptx-plugin.git
cd ai-pptx-plugin
npm install
```

## Prerequisites

- **Node.js** 18+
- **Python 3** with `python-pptx` and `Pillow` (for thumbnails)
- **Chrome** or **Chromium** (Playwright uses it for HTML rendering)
- **LibreOffice** (`soffice`) and **Poppler** (`pdftoppm`) — for thumbnail generation
- **Whisk token** — optional, for AI backgrounds (falls back to gradients without it)

### Whisk Authentication

```bash
/opt/homebrew/bin/whisk   # macOS with Homebrew
# Complete browser-based Google auth
# Token saved to ~/.whisk-proxy/token.json (~1 hour validity)
```

## Usage

### Via Claude Code Slash Command

```
/ai-pptx dark minimalist with neon accents
```

Claude will ask for slide content interactively and build the presentation.

### Via CLI

```bash
node lib/build-presentation.cjs \
  --name my-deck \
  --style "dark minimalist with neon accents" \
  --refs style-ref.png
```

### Via Module API

```javascript
const { buildPresentation } = require('./lib/build-presentation.cjs');

await buildPresentation({
  name: 'quarterly-report',
  style: 'corporate blue with golden accents',
  refs: ['./brand-image.png'],
  slides: [
    { type: 'title', title: 'Q4 Report', subtitle: 'Annual Review', date: '2026' },
    { type: 'content', title: 'Highlights', bullets: ['Revenue up 23%', 'New markets opened'] },
    { type: 'content', title: 'Challenges', bullets: ['Supply chain delays', 'Hiring competition'] },
    {
      type: 'data',
      title: 'Metrics',
      metrics: [
        { value: '$4.2M', label: 'Revenue' },
        { value: '156', label: 'New clients' }
      ]
    },
    {
      type: 'features',
      title: 'Strategy',
      features: [
        { title: 'Expand', description: 'Enter 3 new markets' },
        { title: 'Automate', description: 'Reduce ops costs 30%' },
        { title: 'Hire', description: '50 new engineers' }
      ]
    },
    { type: 'closing', heading: 'Thank You', contactLines: ['ceo@company.com'] }
  ]
});
```

## Slide Types

| Type | Layout | Key Elements |
|------|--------|-------------|
| **Title** | Full dark overlay, centered | Title, subtitle, date |
| **Content** | Left 65% overlay | Title + bullet list |
| **Data** | Left 42% overlay | Up to 3 metrics + chart placeholder |
| **Features** | Top band overlay | Title + 3 white cards |
| **Closing** | Full dark overlay, centered | Heading + contact lines |

## Output Structure

```
outputs/<name>/
├── presentation.pptx       # Final file
├── images/bg-*.png          # AI or gradient backgrounds
├── slide*-*.html            # Intermediate HTML slides
└── thumbnails.jpg           # Validation grid
```

## How It Works

1. **Backgrounds** — Generates title background first via Whisk API, then uploads it as a style reference for remaining slides (ensuring visual consistency). Falls back to SVG gradients rendered via Sharp if Whisk is unavailable.
2. **HTML Slides** — Each slide is an HTML file (720pt x 405pt) with positioned elements and a `background-image` pointing to the generated PNG.
3. **PPTX Assembly** — Playwright renders each HTML, extracts element positions/styles, and PptxGenJS creates the final `.pptx` with precise positioning.
4. **Thumbnails** — LibreOffice converts to PDF, Poppler rasterizes pages, Pillow assembles a grid.

## License

MIT
