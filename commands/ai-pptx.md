---
description: Create a PowerPoint presentation with AI-generated backgrounds
argument-hint: <style> [--refs img1,img2]
allowed-tools: Read, Write, Bash, AskUserQuestion, Task
---

# /ai-pptx — AI Presentation Builder

You are creating a PowerPoint presentation with AI-generated background images using the ai-pptx plugin.

## Quick Start Flow

1. **Parse arguments**: The user may provide a style description and optional `--refs` flag with image paths.

2. **If no arguments**, ask:
   - Presentation name (short, for output directory)
   - Visual style (e.g. "dark tech with neon accents", "warm minimalist corporate")
   - Reference images? (optional paths for style matching)

3. **Gather slide content** — ask the user what slides they need. Available template types:
   - **title** — main title, subtitle, date
   - **content** — title + bullet points
   - **data** — title + up to 3 metrics + chart placeholder
   - **features** — title + 3 feature cards
   - **closing** — heading + contact lines

   Any number of slides in any order. Types can repeat (e.g. multiple `content` slides).

4. **Build the presentation**:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/build-presentation.cjs" --name "<name>" --style "<style>" [--refs <paths>]
```

For custom slide content (not demo), write a Node.js script that calls `buildPresentation()` from the module:

```bash
node -e "
const { buildPresentation } = require('${CLAUDE_PLUGIN_ROOT}/lib/build-presentation.cjs');
buildPresentation({
  name: '<name>',
  style: '<style>',
  refs: [/* optional ref image paths */],
  slides: [
    { type: 'title', title: '...', subtitle: '...', date: '...' },
    { type: 'content', title: '...', bullets: ['...', '...'] },
    { type: 'content', title: '...', bullets: ['...', '...'] },
    { type: 'data', title: '...', metrics: [{value: '...', label: '...'}] },
    { type: 'features', title: '...', features: [{title: '...', description: '...'}] },
    { type: 'closing', heading: '...', contactLines: ['...'] }
  ]
}).then(r => console.log('Done:', r.pptxPath)).catch(e => { console.error(e); process.exit(1); });
"
```

5. **Show thumbnails**: Read and display `outputs/<name>/thumbnails.jpg`

6. **Report result**: Tell the user where the `.pptx` file is located.

## Notes

- If Whisk token is missing/expired, the builder auto-falls back to gradient backgrounds
- To authenticate Whisk: run `/opt/homebrew/bin/whisk` and complete browser auth
- Output goes to `./outputs/<name>/` relative to current working directory
- Reference the skill at `${CLAUDE_PLUGIN_ROOT}/skills/ai-pptx/SKILL.md` for detailed docs
- Slide type reference: `${CLAUDE_PLUGIN_ROOT}/skills/ai-pptx/references/slide-types.md`
