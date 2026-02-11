/**
 * Whisk API client - CJS port from whisk-proxy TypeScript source
 * Provides image generation via Google Whisk (IMAGEN 3.5, GEM_PIX, R2I)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN_FILE = path.join(os.homedir(), '.whisk-proxy', 'token.json');

const ENDPOINTS = {
  generate: 'https://aisandbox-pa.googleapis.com/v1/whisk:generateImage',
  recipe: 'https://aisandbox-pa.googleapis.com/v1/whisk:runImageRecipe',
  upload: 'https://labs.google/fx/api/trpc/backbone.uploadImage',
  caption: 'https://labs.google/fx/api/trpc/backbone.captionImage',
};

const MODELS = {
  default: 'IMAGEN_3_5',
  refSingle: 'GEM_PIX',
  refMultiple: 'R2I',
};

const ASPECT_RATIO_MAP = {
  '1:1': 'IMAGE_ASPECT_RATIO_SQUARE',
  '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  '4:3': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '3:4': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  IMAGE_ASPECT_RATIO_SQUARE: 'IMAGE_ASPECT_RATIO_SQUARE',
  IMAGE_ASPECT_RATIO_LANDSCAPE: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  IMAGE_ASPECT_RATIO_PORTRAIT: 'IMAGE_ASPECT_RATIO_PORTRAIT',
};

function normalizeAspectRatio(ratio) {
  return ASPECT_RATIO_MAP[ratio] || 'IMAGE_ASPECT_RATIO_SQUARE';
}

function makeSessionId() {
  return ';' + Date.now();
}

function makeSeed() {
  return Math.floor(Math.random() * 2147483647);
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: 'https://labs.google',
  };
}

/**
 * Load and validate Whisk token from ~/.whisk-proxy/token.json
 * @returns {{ accessToken: string, expiresAt: number } | null}
 */
function loadToken() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    if (!data.accessToken || !data.expiresAt) {
      return null;
    }
    // Require at least 5 minutes remaining
    if (data.expiresAt < Date.now() + 300000) {
      return null;
    }
    return { accessToken: data.accessToken, expiresAt: data.expiresAt };
  } catch {
    return null;
  }
}

/**
 * Generate image from text prompt (no references)
 * @param {string} prompt
 * @param {string} aspectRatio - e.g. "16:9", "1:1"
 * @param {string} accessToken
 * @returns {Promise<{ success: boolean, images?: string[], error?: string }>}
 */
async function generateImage(prompt, aspectRatio, accessToken) {
  try {
    const payload = {
      clientContext: {
        workflowId: '',
        tool: 'BACKBONE',
        sessionId: makeSessionId(),
      },
      imageModelSettings: {
        imageModel: MODELS.default,
        aspectRatio: normalizeAspectRatio(aspectRatio),
      },
      prompt,
      mediaCategory: 'MEDIA_CATEGORY_BOARD',
      seed: makeSeed(),
    };

    const response = await fetch(ENDPOINTS.generate, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const panels = data.imagePanels || [];

    if (panels.length > 0 && panels[0].generatedImages?.length > 0) {
      const images = panels[0].generatedImages.map(img => img.encodedImage);
      return { success: true, images };
    }

    return { success: false, error: 'No image data in response' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Upload a reference image for style/subject transfer
 * @param {string} base64Data - raw base64 image data
 * @param {string} category - e.g. "MEDIA_CATEGORY_STYLE"
 * @param {string} accessToken
 * @returns {Promise<{ success: boolean, mediaId?: string, error?: string }>}
 */
async function uploadReference(base64Data, category, accessToken) {
  try {
    const payload = {
      json: {
        clientContext: {
          workflowId: '',
          sessionId: makeSessionId(),
        },
        uploadMediaInput: {
          mediaCategory: category,
          rawBytes: base64Data,
        },
      },
    };

    const response = await fetch(ENDPOINTS.upload, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Upload HTTP ${response.status}` };
    }

    const data = await response.json();
    const mediaId = data?.result?.data?.json?.result?.uploadMediaGenerationId;

    if (mediaId) {
      return { success: true, mediaId };
    }
    return { success: false, error: 'No Media ID returned' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get AI caption for an image
 * @param {string} base64Data
 * @param {string} category
 * @param {string} accessToken
 * @returns {Promise<{ success: boolean, caption?: string, error?: string }>}
 */
async function getCaptionForImage(base64Data, category, accessToken) {
  try {
    const payload = {
      json: {
        clientContext: {
          workflowId: '',
          sessionId: makeSessionId(),
        },
        captionInput: {
          candidatesCount: 1,
          mediaInput: {
            mediaCategory: category,
            rawBytes: base64Data,
          },
        },
      },
    };

    const response = await fetch(ENDPOINTS.caption, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Caption HTTP ${response.status}` };
    }

    const data = await response.json();
    const candidates = data?.result?.data?.json?.result?.candidates;

    if (candidates && candidates.length > 0) {
      return { success: true, caption: candidates[0].output || '' };
    }
    return { success: true, caption: '' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate image using reference images (style transfer)
 * @param {string} prompt
 * @param {string} aspectRatio
 * @param {string} accessToken
 * @param {{ category: string, mediaId: string, caption?: string }[]} references
 * @returns {Promise<{ success: boolean, images?: string[], error?: string }>}
 */
async function generateWithReference(prompt, aspectRatio, accessToken, references) {
  try {
    const recipeMediaInputs = references.map(ref => ({
      caption: ref.caption || '',
      mediaInput: {
        mediaCategory: ref.category,
        mediaGenerationId: ref.mediaId,
      },
    }));

    const payload = {
      clientContext: {
        workflowId: '',
        tool: 'BACKBONE',
        sessionId: makeSessionId(),
      },
      imageModelSettings: {
        imageModel: references.length === 1 ? MODELS.refSingle : MODELS.refMultiple,
        aspectRatio: normalizeAspectRatio(aspectRatio),
      },
      userInstruction: prompt,
      recipeMediaInputs,
      seed: makeSeed(),
    };

    const response = await fetch(ENDPOINTS.recipe, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const panels = data.imagePanels || [];

    if (panels.length > 0 && panels[0].generatedImages?.length > 0) {
      const images = panels[0].generatedImages.map(img => img.encodedImage);
      return { success: true, images };
    }

    return { success: false, error: 'No image data in response' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Upload image + get caption in one call
 * @param {string} base64Data
 * @param {string} category
 * @param {string} accessToken
 * @returns {Promise<{ success: boolean, mediaId?: string, caption?: string, error?: string }>}
 */
async function uploadAndAnalyze(base64Data, category, accessToken) {
  const [captionResult, uploadResult] = await Promise.all([
    getCaptionForImage(base64Data, category, accessToken),
    uploadReference(base64Data, category, accessToken),
  ]);

  const caption = captionResult.success ? captionResult.caption : '';

  if (uploadResult.success) {
    return { success: true, mediaId: uploadResult.mediaId, caption };
  }
  return { success: false, error: uploadResult.error };
}

/**
 * Save base64 image data to file
 * @param {string} base64Data
 * @param {string} filePath
 */
function saveBase64Image(base64Data, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
}

// CLI test mode: node lib/whisk-client.cjs test
if (require.main === module) {
  (async () => {
    const cmd = process.argv[2];
    if (cmd === 'test') {
      const token = loadToken();
      if (!token) {
        console.error('No valid token found at', TOKEN_FILE);
        process.exit(1);
      }
      const minutesLeft = Math.floor((token.expiresAt - Date.now()) / 60000);
      console.log(`Token valid, expires in ${minutesLeft} minutes`);

      console.log('Testing image generation...');
      const result = await generateImage(
        'Abstract dark blue gradient background, subtle geometric shapes, 16:9',
        '16:9',
        token.accessToken
      );
      if (result.success) {
        const outPath = path.join(__dirname, '..', 'outputs', 'whisk-test.png');
        saveBase64Image(result.images[0], outPath);
        console.log(`Success! Saved to ${outPath}`);
      } else {
        console.error('Generation failed:', result.error);
        process.exit(1);
      }
    } else {
      console.log('Usage: node lib/whisk-client.cjs test');
    }
  })();
}

module.exports = {
  loadToken,
  generateImage,
  uploadReference,
  getCaptionForImage,
  generateWithReference,
  uploadAndAnalyze,
  saveBase64Image,
};
