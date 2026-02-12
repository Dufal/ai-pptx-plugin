/**
 * build-presentation.cjs - Orchestrator for AI-background presentations
 *
 * Adapted for ai-pptx plugin: paths resolve relative to plugin root.
 *
 * Phases:
 *   1. Generate background images via Whisk API (or fallback to gradients)
 *   2. Create HTML slides from templates
 *   3. Assemble PPTX via PptxGenJS + html2pptx
 *   4. Generate thumbnails for validation
 *
 * CLI: node lib/build-presentation.cjs --name <name> --style "<style>" [--refs img1.png,img2.png]
 * Module: const { buildPresentation } = require('./lib/build-presentation.cjs');
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const whisk = require('./whisk-client.cjs');
const templates = require('./slide-templates.cjs');
const html2pptx = require('../scripts/html2pptx.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

const TEMPLATE_FNS = {
  title: templates.titleSlide,
  content: templates.contentSlide,
  data: templates.dataSlide,
  features: templates.featuresSlide,
  closing: templates.closingSlide,
};

const TYPE_INSTRUCTIONS = {
  title: 'Central focal point, slightly darker edges, space for centered text',
  content: 'Subtle, not distracting, darker left area for text overlay',
  data: 'Clean, professional, muted tones, will not compete with charts',
  features: 'Subtle pattern, even lighting for placing white cards on top',
  closing: 'Warm, inviting, central focal point, space for centered text',
};

/**
 * Build a full prompt for background generation
 */
function buildBgPrompt(styleDescription, slideType) {
  const instruction = TYPE_INSTRUCTIONS[slideType] || '';
  return `${styleDescription}. ${instruction}. No text, no logos, no people. Abstract background only. 16:9.`;
}

/**
 * Generate gradient fallback backgrounds using Sharp (when Whisk unavailable)
 */
async function generateFallbackBackground(outputDir, slideType, index) {
  const gradients = {
    title: { from: '#0f0c29', via: '#302b63', to: '#24243e' },
    content: { from: '#1a1a2e', via: '#16213e', to: '#0f3460' },
    data: { from: '#0d1117', via: '#161b22', to: '#21262d' },
    features: { from: '#1a1a2e', via: '#1f2937', to: '#111827' },
    closing: { from: '#2d1b69', via: '#1e1145', to: '#0f0c29' },
  };

  const g = gradients[slideType] || gradients.content;
  const width = 1920;
  const height = 1080;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${g.from}"/>
        <stop offset="50%" stop-color="${g.via}"/>
        <stop offset="100%" stop-color="${g.to}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width * 0.7}" cy="${height * 0.3}" r="${height * 0.4}" fill="${g.via}" opacity="0.3"/>
    <circle cx="${width * 0.3}" cy="${height * 0.7}" r="${height * 0.25}" fill="${g.to}" opacity="0.2"/>
  </svg>`;

  const outPath = path.join(outputDir, `bg-${index}-${slideType}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return outPath;
}

/**
 * Generate backgrounds via Whisk API with style consistency
 * @param {string} outputDir
 * @param {string} styleDescription
 * @param {string[]} refPaths
 * @param {{type: string}[]} slides - array of slide descriptors
 * @returns {Promise<string[]|null>} array of background paths per slide, or null
 */
async function generateWhiskBackgrounds(outputDir, styleDescription, refPaths, slides) {
  const tokenData = whisk.loadToken();
  if (!tokenData) {
    return null; // Signal to use fallback
  }

  const token = tokenData.accessToken;
  const results = [];

  // Phase 1a: Upload user reference images (if provided)
  const userRefs = [];
  for (const refPath of (refPaths || [])) {
    if (!fs.existsSync(refPath)) continue;
    const base64 = fs.readFileSync(refPath).toString('base64');
    const analysis = await whisk.uploadAndAnalyze(base64, 'MEDIA_CATEGORY_STYLE', token);
    if (analysis.success) {
      userRefs.push({
        category: 'MEDIA_CATEGORY_STYLE',
        mediaId: analysis.mediaId,
        caption: analysis.caption,
      });
    }
  }

  // Phase 1b: Generate first slide background as style anchor
  const firstType = slides[0].type;
  const anchorPrompt = buildBgPrompt(styleDescription, firstType);
  let anchorResult;

  if (userRefs.length > 0) {
    anchorResult = await whisk.generateWithReference(anchorPrompt, '16:9', token, userRefs);
  } else {
    anchorResult = await whisk.generateImage(anchorPrompt, '16:9', token);
  }

  if (!anchorResult.success) {
    console.error('Anchor background generation failed:', anchorResult.error);
    return null;
  }

  const anchorPath = path.join(outputDir, `bg-0-${firstType}.png`);
  whisk.saveBase64Image(anchorResult.images[0], anchorPath);
  results.push(anchorPath);

  // Phase 1c: Upload anchor as style reference for consistency
  const anchorBase64 = anchorResult.images[0];
  const anchorRef = await whisk.uploadAndAnalyze(anchorBase64, 'MEDIA_CATEGORY_STYLE', token);
  const consistencyRefs = [...userRefs];
  if (anchorRef.success) {
    consistencyRefs.push({
      category: 'MEDIA_CATEGORY_STYLE',
      mediaId: anchorRef.mediaId,
      caption: anchorRef.caption,
    });
  }

  // Phase 1d: Generate remaining backgrounds with consistency refs
  for (let i = 1; i < slides.length; i++) {
    const slideType = slides[i].type;
    const prompt = buildBgPrompt(styleDescription, slideType);
    let result;

    if (consistencyRefs.length > 0) {
      result = await whisk.generateWithReference(prompt, '16:9', token, consistencyRefs);
    } else {
      result = await whisk.generateImage(prompt, '16:9', token);
    }

    if (!result.success) {
      console.error(`Background ${i} ("${slideType}") failed: ${result.error}, using fallback`);
      const fallbackPath = await generateFallbackBackground(outputDir, slideType, i);
      results.push(fallbackPath);
      continue;
    }

    const outPath = path.join(outputDir, `bg-${i}-${slideType}.png`);
    whisk.saveBase64Image(result.images[0], outPath);
    results.push(outPath);
  }

  return results;
}

/**
 * Render SVG icon as PNG file via Sharp
 */
async function renderIconPng(iconSvg, outputPath, size, color) {
  const s = size || 48;
  const c = color || '#1a1a2e';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}">
    ${iconSvg}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return outputPath;
}

/**
 * Write HTML slide file
 */
function writeSlideHtml(outputDir, slideType, html, index) {
  const fileName = `slide${index}-${slideType}.html`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

/**
 * Main orchestrator
 * @param {object} config
 * @param {string} config.name - Presentation name (used for output dir)
 * @param {string} config.style - Style description for AI generation
 * @param {string[]} [config.refs] - Reference image paths
 * @param {{type: string, [key: string]: any}[]} config.slides - Array of slide objects, each with a `type` field
 * @param {string} [config.outputBase] - Base output directory (default: cwd)
 */
async function buildPresentation(config) {
  const { name, style, refs, slides } = config;
  const outputBase = config.outputBase || process.cwd();
  const outputDir = path.join(outputBase, 'outputs', name);
  const imagesDir = path.join(outputDir, 'images');

  // Ensure directories
  fs.mkdirSync(imagesDir, { recursive: true });

  console.log(`Building presentation: ${name}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Slides: ${slides.length} (${slides.map(s => s.type).join(', ')})`);

  // === PHASE 1: Background generation ===
  console.log('\n--- Phase 1: Generating backgrounds ---');
  let backgrounds = await generateWhiskBackgrounds(imagesDir, style, refs, slides);

  if (!backgrounds) {
    console.log('Whisk unavailable, using gradient fallbacks...');
    backgrounds = [];
    for (let i = 0; i < slides.length; i++) {
      const bgPath = await generateFallbackBackground(imagesDir, slides[i].type, i);
      backgrounds.push(bgPath);
    }
  }

  console.log(`Backgrounds ready: ${backgrounds.length} images`);

  // === PHASE 2: Create HTML slides ===
  console.log('\n--- Phase 2: Creating HTML slides ---');
  const htmlFiles = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const fn = TEMPLATE_FNS[slide.type];
    if (!fn) {
      console.error(`  Unknown slide type: "${slide.type}", skipping`);
      continue;
    }
    const slideData = { ...slide, bgImage: backgrounds[i] };
    const html = fn(slideData);
    const filePath = writeSlideHtml(outputDir, slide.type, html, i);
    htmlFiles.push(filePath);
    console.log(`  Created: ${path.basename(filePath)}`);
  }

  // === PHASE 3: Assemble PPTX ===
  console.log('\n--- Phase 3: Assembling PPTX ---');
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  for (const htmlFile of htmlFiles) {
    const { slide, placeholders } = await html2pptx(htmlFile, pptx);
    if (placeholders.length > 0) {
      console.log(`  Placeholders in ${path.basename(htmlFile)}: ${placeholders.map(p => p.id).join(', ')}`);
    }
  }

  const pptxPath = path.join(outputDir, 'presentation.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  console.log(`  Saved: ${pptxPath}`);

  // === PHASE 4: Thumbnails ===
  console.log('\n--- Phase 4: Generating thumbnails ---');
  const thumbnailScript = path.join(PLUGIN_ROOT, 'scripts', 'thumbnail.py');

  try {
    const { execSync } = require('child_process');
    const thumbPrefix = path.join(outputDir, 'thumbnails');
    execSync(`python3 "${thumbnailScript}" "${pptxPath}" "${thumbPrefix}" --cols 5`, {
      cwd: outputDir,
      stdio: 'pipe',
    });
    console.log(`  Thumbnails saved to: ${thumbPrefix}.jpg`);
  } catch (err) {
    console.error('  Thumbnail generation failed:', err.message);
    console.error('  (Ensure python-pptx and Pillow are installed: pip3 install python-pptx Pillow)');
  }

  console.log(`\nDone! Presentation at: ${pptxPath}`);
  return { pptxPath, outputDir, backgrounds, htmlFiles };
}

// === CLI interface ===
if (require.main === module) {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) { parsed.name = args[++i]; }
    else if (args[i] === '--style' && args[i + 1]) { parsed.style = args[++i]; }
    else if (args[i] === '--refs' && args[i + 1]) { parsed.refs = args[++i].split(','); }
    else if (args[i] === '--output' && args[i + 1]) { parsed.outputBase = args[++i]; }
  }

  if (!parsed.name || !parsed.style) {
    console.log('Usage: node lib/build-presentation.cjs --name <name> --style "<style>" [--refs img1.png,img2.png] [--output /path]');
    console.log('');
    console.log('Example:');
    console.log('  node lib/build-presentation.cjs --name test-ai --style "dark minimalist with neon accents"');
    process.exit(1);
  }

  // Default demo slides for CLI testing
  const demoSlides = [
    {
      type: 'title',
      title: 'AI-Powered Presentation',
      subtitle: 'Generated with Whisk + PptxGenJS',
      date: new Date().toLocaleDateString('ru-RU'),
    },
    {
      type: 'content',
      title: 'Key Features',
      bullets: [
        'AI-generated backgrounds via Whisk API',
        'Style consistency across all slides',
        'Reference image support for brand matching',
        'Automatic gradient fallback when offline',
        'HTML-to-PPTX conversion with precise positioning',
      ],
    },
    {
      type: 'data',
      title: 'Performance Metrics',
      metrics: [
        { value: '5s', label: 'Average generation time' },
        { value: '98%', label: 'Style consistency' },
        { value: '16:9', label: 'Aspect ratio' },
      ],
      chartLabel: 'Chart placeholder',
    },
    {
      type: 'features',
      title: 'How It Works',
      features: [
        { title: 'Generate', description: 'AI creates unique backgrounds matching your style' },
        { title: 'Template', description: 'HTML templates with overlay for text readability' },
        { title: 'Assemble', description: 'PptxGenJS builds the final .pptx file' },
      ],
    },
    {
      type: 'closing',
      heading: 'Thank You',
      contactLines: [
        'Generated by ai-pptx plugin',
        'Powered by Whisk API + html2pptx',
      ],
    },
  ];

  buildPresentation({
    name: parsed.name,
    style: parsed.style,
    refs: parsed.refs,
    slides: demoSlides,
    outputBase: parsed.outputBase,
  }).catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}

module.exports = { buildPresentation, generateFallbackBackground, renderIconPng };
