/**
 * Slide HTML templates for AI-background presentations
 * Each function returns an HTML string (720pt x 405pt, Arial, UTF-8)
 *
 * html2pptx rules:
 *   - body background-image → slide background
 *   - <div> with background/border → shape (no text, no bg-image)
 *   - <p>, <h1>-<h6>, <ul>, <ol> → text elements
 *   - class="placeholder" → extracted as chart/table areas
 */

const SLIDE_W = 720;
const SLIDE_H = 405;

function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${SLIDE_W}pt;
      height: ${SLIDE_H}pt;
      font-family: Arial, Helvetica, sans-serif;
      color: #ffffff;
      overflow: hidden;
      position: relative;
      background-size: cover;
      background-position: center;
    }
  `;
}

function wrapSlide(bgImagePath, overlayDivs, innerHtml, extraStyles) {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><style>
${baseStyles()}
${extraStyles || ''}
</style></head>
<body style="background-image: url('${bgImagePath}');">
${overlayDivs}
${innerHtml}
</body></html>`;
}

/**
 * Title slide - centered title, subtitle, date
 * Full dark overlay (0.45 opacity)
 */
function titleSlide({ bgImage, title, subtitle, date }) {
  const extra = `
    .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); }
    h1 { position: absolute; top: 140pt; left: 60pt; width: 600pt; text-align: center; font-size: 38pt; font-weight: 700; line-height: 1.2; }
    .subtitle { position: absolute; top: 200pt; left: 80pt; width: 560pt; text-align: center; font-size: 19pt; font-weight: 400; line-height: 1.4; color: rgba(255,255,255,0.9); }
    .date { position: absolute; top: 260pt; left: 80pt; width: 560pt; text-align: center; font-size: 13pt; color: rgba(255,255,255,0.7); }
  `;
  const inner = `
<h1>${esc(title)}</h1>
${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
${date ? `<p class="date">${esc(date)}</p>` : ''}
  `;
  return wrapSlide(bgImage, '<div class="overlay"></div>', inner, extra);
}

/**
 * Content slide - title + bullet list
 * Left 65% overlay for text area
 */
function contentSlide({ bgImage, title, bullets }) {
  const extra = `
    .overlay { position: absolute; top: 0; left: 0; width: 65%; height: 100%; background: rgba(0,0,0,0.45); }
    h2 { position: absolute; top: 36pt; left: 32pt; width: 410pt; font-size: 26pt; font-weight: 700; line-height: 1.2; }
    ul { position: absolute; top: 85pt; left: 32pt; width: 410pt; list-style: none; padding: 0; }
    li { font-size: 15pt; line-height: 1.5; margin-bottom: 10pt; padding-left: 20pt; position: relative; }
    li::before { content: "\\2022"; position: absolute; left: 0; color: rgba(255,255,255,0.7); }
  `;
  const bulletHtml = (bullets || [])
    .map(b => `  <li>${esc(b)}</li>`)
    .join('\n');
  const inner = `
<h2>${esc(title)}</h2>
<ul>
${bulletHtml}
</ul>
  `;
  return wrapSlide(bgImage, '<div class="overlay"></div>', inner, extra);
}

/**
 * Data slide - metrics on the left, chart placeholder on the right
 * Left column 42% overlay
 */
function dataSlide({ bgImage, title, metrics, chartLabel }) {
  const extra = `
    .overlay { position: absolute; top: 0; left: 0; width: 42%; height: 100%; background: rgba(0,0,0,0.50); }
    h2 { position: absolute; top: 32pt; left: 28pt; width: 270pt; font-size: 24pt; font-weight: 700; line-height: 1.2; }
    .m0-val { position: absolute; top: 85pt; left: 28pt; width: 270pt; font-size: 28pt; font-weight: 700; }
    .m0-lbl { position: absolute; top: 115pt; left: 28pt; width: 270pt; font-size: 12pt; color: rgba(255,255,255,0.75); }
    .m1-val { position: absolute; top: 150pt; left: 28pt; width: 270pt; font-size: 28pt; font-weight: 700; }
    .m1-lbl { position: absolute; top: 180pt; left: 28pt; width: 270pt; font-size: 12pt; color: rgba(255,255,255,0.75); }
    .m2-val { position: absolute; top: 215pt; left: 28pt; width: 270pt; font-size: 28pt; font-weight: 700; }
    .m2-lbl { position: absolute; top: 245pt; left: 28pt; width: 270pt; font-size: 12pt; color: rgba(255,255,255,0.75); }
    .placeholder {
      position: absolute; top: 60pt; left: 320pt; width: 370pt; height: 285pt;
      background: rgba(128,128,128,0.3); border-radius: 8pt;
    }
  `;

  const m = metrics || [];
  let metricsHtml = '';
  for (let i = 0; i < Math.min(m.length, 3); i++) {
    metricsHtml += `<p class="m${i}-val">${esc(m[i].value)}</p>\n`;
    metricsHtml += `<p class="m${i}-lbl">${esc(m[i].label)}</p>\n`;
  }

  const inner = `
<h2>${esc(title)}</h2>
${metricsHtml}
<div class="placeholder" id="chart-area"></div>
  `;
  return wrapSlide(bgImage, '<div class="overlay"></div>', inner, extra);
}

/**
 * Features slide - 3 cards on background
 * Upper band overlay for title
 */
function featuresSlide({ bgImage, title, features }) {
  const extra = `
    .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 80pt; background: rgba(0,0,0,0.50); }
    h2 { position: absolute; top: 24pt; left: 32pt; width: 656pt; font-size: 24pt; font-weight: 700; text-align: center; line-height: 1.2; }
    .card0 { position: absolute; top: 110pt; left: 32pt; width: 200pt; height: 250pt; background: rgba(255,255,255,0.92); border-radius: 8pt; }
    .card1 { position: absolute; top: 110pt; left: 260pt; width: 200pt; height: 250pt; background: rgba(255,255,255,0.92); border-radius: 8pt; }
    .card2 { position: absolute; top: 110pt; left: 488pt; width: 200pt; height: 250pt; background: rgba(255,255,255,0.92); border-radius: 8pt; }
    .ct0 { position: absolute; top: 140pt; left: 48pt; width: 168pt; font-size: 14pt; font-weight: 700; color: #1a1a2e; text-align: center; }
    .cd0 { position: absolute; top: 170pt; left: 48pt; width: 168pt; font-size: 11pt; line-height: 1.4; color: rgba(26,26,46,0.8); text-align: center; }
    .ct1 { position: absolute; top: 140pt; left: 276pt; width: 168pt; font-size: 14pt; font-weight: 700; color: #1a1a2e; text-align: center; }
    .cd1 { position: absolute; top: 170pt; left: 276pt; width: 168pt; font-size: 11pt; line-height: 1.4; color: rgba(26,26,46,0.8); text-align: center; }
    .ct2 { position: absolute; top: 140pt; left: 504pt; width: 168pt; font-size: 14pt; font-weight: 700; color: #1a1a2e; text-align: center; }
    .cd2 { position: absolute; top: 170pt; left: 504pt; width: 168pt; font-size: 11pt; line-height: 1.4; color: rgba(26,26,46,0.8); text-align: center; }
  `;

  const f = (features || []).slice(0, 3);
  let cardsHtml = '';
  let textsHtml = '';
  for (let i = 0; i < f.length; i++) {
    cardsHtml += `<div class="card${i}"></div>\n`;
    textsHtml += `<p class="ct${i}">${esc(f[i].title)}</p>\n`;
    textsHtml += `<p class="cd${i}">${esc(f[i].description)}</p>\n`;
  }

  const inner = `
<h2>${esc(title)}</h2>
${cardsHtml}
${textsHtml}
  `;
  return wrapSlide(bgImage, '<div class="overlay"></div>', inner, extra);
}

/**
 * Closing slide - centered "thank you" + contact info
 * Full dark overlay (0.45 opacity)
 */
function closingSlide({ bgImage, heading, contactLines }) {
  const lines = contactLines || [];
  const lineCount = lines.length;
  const startTop = 220;

  const extra = `
    .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); }
    h1 { position: absolute; top: 150pt; left: 60pt; width: 600pt; text-align: center; font-size: 36pt; font-weight: 700; line-height: 1.2; }
    ${lines.map((_, i) => `.cl${i} { position: absolute; top: ${startTop + i * 28}pt; left: 80pt; width: 560pt; text-align: center; font-size: 15pt; color: rgba(255,255,255,0.85); line-height: 1.5; }`).join('\n    ')}
  `;

  const linesHtml = lines
    .map((l, i) => `<p class="cl${i}">${esc(l)}</p>`)
    .join('\n');

  const inner = `
<h1>${esc(heading || 'Thank you')}</h1>
${linesHtml}
  `;
  return wrapSlide(bgImage, '<div class="overlay"></div>', inner, extra);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  titleSlide,
  contentSlide,
  dataSlide,
  featuresSlide,
  closingSlide,
  SLIDE_W,
  SLIDE_H,
};
