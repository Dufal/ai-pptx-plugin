---
name: ai-pptx
description: Create PowerPoint presentations with AI-generated backgrounds via Whisk API. Triggers on requests for presentations, PPTX files, AI backgrounds, slides with Whisk-generated images.
allowed-tools: Read, Write, Bash, AskUserQuestion, Task
---

# AI-PPTX: Presentation Builder with AI Backgrounds

Create professional PowerPoint presentations where every slide has a unique AI-generated background image, with consistent style across all slides.

## Capabilities

- **AI backgrounds** via Google Whisk API (IMAGEN 3.5 / GEM_PIX / R2I)
- **Style consistency** — title slide sets the style anchor, remaining slides use it as reference
- **Reference images** — upload your own images to match brand style
- **Gradient fallback** — works offline with Sharp-generated gradient backgrounds
- **Flexible slide list** — any number of slides in any order (title, content, data, features, closing templates)
- **HTML→PPTX** — precise positioning via Playwright + PptxGenJS
- **Thumbnail validation** — auto-generated grid for visual review

## Workflow

### Step 1: Gather Content

Ask the user for:
1. **Presentation name** (used for output directory)
2. **Style description** (e.g. "dark minimalist with neon accents", "warm corporate with gold tones")
3. **Reference images** (optional — paths to images for style matching)
4. **Slide content** for each slide type needed (see `references/slide-types.md`)

### Step 2: Prepare the Config

Build a JSON config object. `slides` is an array — use any number of slides in any order, repeating types as needed:

```json
{
  "name": "my-presentation",
  "style": "dark minimalist with subtle blue glow",
  "refs": ["/path/to/style-ref.png"],
  "slides": [
    { "type": "title", "title": "...", "subtitle": "...", "date": "..." },
    { "type": "content", "title": "...", "bullets": ["...", "..."] },
    { "type": "content", "title": "...", "bullets": ["...", "..."] },
    { "type": "data", "title": "...", "metrics": [{"value": "...", "label": "..."}], "chartLabel": "..." },
    { "type": "features", "title": "...", "features": [{"title": "...", "description": "..."}] },
    { "type": "closing", "heading": "...", "contactLines": ["...", "..."] }
  ]
}
```

Available types: `title`, `content`, `data`, `features`, `closing` (see `references/slide-types.md`).
You can have multiple slides of the same type, omit types you don't need, and order them freely.

### Step 3: Write Config and Run

1. Write the config to a temporary JSON file in the output directory
2. Run the builder:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/build-presentation.cjs" --name "<name>" --style "<style>" [--refs img1.png,img2.png]
```

Or use the module API programmatically:

```bash
node -e "
const { buildPresentation } = require('${CLAUDE_PLUGIN_ROOT}/lib/build-presentation.cjs');
const config = $(cat config.json);
buildPresentation(config).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); });
"
```

### Step 4: Validate

1. Check the thumbnail grid at `outputs/<name>/thumbnails.jpg`
2. Show the thumbnail to the user
3. If issues found, regenerate specific slides

### Step 5: Deliver

Report the final file location: `outputs/<name>/presentation.pptx`

## Whisk Token

The Whisk API requires authentication. Tokens are stored at `~/.whisk-proxy/token.json`.

To authenticate:
1. Run `/opt/homebrew/bin/whisk` in terminal
2. Complete browser-based Google auth
3. Token is saved automatically (valid ~1 hour)

If no valid token exists, the builder automatically falls back to gradient backgrounds.

## Environment Requirements

- **Node.js** with npm dependencies installed in plugin root
- **Python 3** with `python-pptx` and `Pillow` (for thumbnails)
- **LibreOffice** (`soffice`) and **Poppler** (`pdftoppm`) for thumbnail generation
- **Chrome/Chromium** for HTML→PPTX rendering (Playwright)

## Output Structure

```
outputs/<name>/
├── presentation.pptx      # Final presentation
├── images/
│   ├── bg-0-title.png     # AI or gradient backgrounds (per slide)
│   ├── bg-1-content.png
│   ├── bg-2-content.png
│   └── ...
├── slide0-title.html      # Intermediate HTML slides
├── slide1-content.html
├── slide2-content.html
└── thumbnails.jpg          # Validation thumbnail grid
```
