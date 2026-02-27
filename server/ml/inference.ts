/**
 * ML Inference Module — ONNX model loading and roof edge inference.
 *
 * Lazy-loads the ONNX model on first request.
 * Input: base64 PNG image (640x640)
 * Output: 640x640 Uint8Array segmentation mask (values 0-6)
 */

import path from 'path';
import fs from 'fs';

// ONNX Runtime and Sharp are optional dependencies (installed on server only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ort: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharp: any = null;

try {
  ort = require('onnxruntime-node');
} catch {
  // onnxruntime-node not installed
}

try {
  sharp = require('sharp');
} catch {
  // sharp not installed
}

const IMAGE_SIZE = 640;
const NUM_CLASSES = 7;

// ImageNet normalization constants
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session: InstanceType<NonNullable<typeof ort>['InferenceSession']> | null = null;
let modelVersion: string | null = null;

/**
 * Get the path to the current ONNX model.
 */
function getModelPath(): string | null {
  const modelsDir = path.resolve(__dirname, '../../ml/models');

  // Check versions.json for current version
  const versionsPath = path.join(modelsDir, 'versions.json');
  if (fs.existsSync(versionsPath)) {
    try {
      const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf-8'));
      const current = versions.current;
      if (current && versions.versions?.[current]?.path) {
        const versionedPath = path.join(modelsDir, versions.versions[current].path);
        if (fs.existsSync(versionedPath)) {
          modelVersion = current;
          return versionedPath;
        }
      }
    } catch {}
  }

  // Fallback: check for default model file
  const defaultPath = path.join(modelsDir, 'roof_edge_detector.onnx');
  if (fs.existsSync(defaultPath)) {
    modelVersion = 'default';
    return defaultPath;
  }

  return null;
}

/**
 * Check if the ML model is available and ready for inference.
 */
export function isModelAvailable(): { available: boolean; modelVersion: string | null; reason?: string } {
  if (!ort) {
    return { available: false, modelVersion: null, reason: 'onnxruntime-node not installed' };
  }
  if (!sharp) {
    return { available: false, modelVersion: null, reason: 'sharp not installed' };
  }

  const modelPath = getModelPath();
  if (!modelPath) {
    return { available: false, modelVersion: null, reason: 'No ONNX model found in ml/models/' };
  }

  return { available: true, modelVersion };
}

/**
 * Load the ONNX model (lazy — only loads on first inference call).
 */
async function ensureModel(): Promise<void> {
  if (session) return;

  if (!ort) throw new Error('onnxruntime-node is not installed');
  if (!sharp) throw new Error('sharp is not installed');

  const modelPath = getModelPath();
  if (!modelPath) throw new Error('No ONNX model found');

  console.log(`[ML] Loading ONNX model from ${modelPath}...`);
  session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
  });
  console.log(`[ML] Model loaded (version: ${modelVersion})`);
}

/**
 * Run inference on a satellite image.
 *
 * @param imageBase64 - Base64-encoded PNG image (640x640)
 * @returns 640x640 Uint8Array with class labels (0-6)
 */
export async function inferRoofEdges(imageBase64: string): Promise<Uint8Array> {
  await ensureModel();
  if (!ort || !sharp || !session) throw new Error('Model not loaded');

  // Decode base64 PNG to raw RGB pixels
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const rawPixels = await sharp(imageBuffer)
    .resize(IMAGE_SIZE, IMAGE_SIZE)
    .removeAlpha()
    .raw()
    .toBuffer();

  // Convert to float32 + ImageNet normalization
  // Input shape: [1, 3, 640, 640] (NCHW format)
  const inputData = new Float32Array(3 * IMAGE_SIZE * IMAGE_SIZE);

  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      const pixelIdx = (y * IMAGE_SIZE + x) * 3;
      const r = rawPixels[pixelIdx] / 255.0;
      const g = rawPixels[pixelIdx + 1] / 255.0;
      const b = rawPixels[pixelIdx + 2] / 255.0;

      // NCHW layout
      inputData[0 * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] = (r - MEAN[0]) / STD[0];
      inputData[1 * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] = (g - MEAN[1]) / STD[1];
      inputData[2 * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] = (b - MEAN[2]) / STD[2];
    }
  }

  const inputTensor = new ort.Tensor('float32', inputData, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);

  // Run inference
  const results = await session.run({ image: inputTensor });
  const outputData = results.segmentation.data as Float32Array;
  // Output shape: [1, 7, 640, 640]

  // Argmax per pixel → class label
  const mask = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE);

  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      let maxVal = -Infinity;
      let maxClass = 0;

      for (let c = 0; c < NUM_CLASSES; c++) {
        const val = outputData[c * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x];
        if (val > maxVal) {
          maxVal = val;
          maxClass = c;
        }
      }

      mask[y * IMAGE_SIZE + x] = maxClass;
    }
  }

  return mask;
}

/**
 * Reload the model (after hot-swapping a new ONNX file).
 */
export async function reloadModel(): Promise<void> {
  if (session) {
    // Release old session
    session = null;
  }
  modelVersion = null;
  await ensureModel();
}
