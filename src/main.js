const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const buildDir = `${basePath}/build`;
const layersDir = `${basePath}/layers`;
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
} = require(`${basePath}/src/config.js`);

const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = format.smoothing;

var metadataList = [];
var attributesList = [];
var dnaList = new Set();
const DNA_DELIMITER = "-";
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);
let hashlipsGiffer = null;

const hslToCanvasColor = (hueDeg, saturationPercent, lightnessPercent, alpha = 1) => {
  let h = ((hueDeg % 360) + 360) % 360;
  let s = Math.max(0, Math.min(100, saturationPercent)) / 100;
  let l = Math.max(0, Math.min(100, lightnessPercent)) / 100;
  let a = Math.max(0, Math.min(1, alpha));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) {
    [rPrime, gPrime, bPrime] = [c, x, 0];
  } else if (h < 120) {
    [rPrime, gPrime, bPrime] = [x, c, 0];
  } else if (h < 180) {
    [rPrime, gPrime, bPrime] = [0, c, x];
  } else if (h < 240) {
    [rPrime, gPrime, bPrime] = [0, x, c];
  } else if (h < 300) {
    [rPrime, gPrime, bPrime] = [x, 0, c];
  } else {
    [rPrime, gPrime, bPrime] = [c, 0, x];
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/* ---------- Setup ---------- */

const buildSetup = () => {
  if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true });
  fs.mkdirSync(buildDir);
  fs.mkdirSync(`${buildDir}/json`);
  fs.mkdirSync(`${buildDir}/images`);
  if (gif.export) fs.mkdirSync(`${buildDir}/gifs`);
};

/* ---------- Utilities ---------- */

const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = Number(nameWithoutExtension.split(rarityDelimiter).pop());
  if (isNaN(nameWithoutWeight)) nameWithoutWeight = 1;
  return nameWithoutWeight;
};

const cleanName = (_str) => _str.slice(0, -4).split(rarityDelimiter).shift();

const getElements = (path) => {
  return fs
    .readdirSync(path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => ({
      id: index,
      name: cleanName(i),
      filename: i,
      path: `${path}${i}`,
      weight: getRarityWeight(i),
    }));
};

/* ---------- Layers ---------- */

const layersSetup = (layersOrder) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    elements: getElements(`${layersDir}/${layerObj.name}/`),
    name: layerObj.options?.displayName ?? layerObj.name,
    blend: layerObj.options?.blend ?? "source-over",
    opacity: layerObj.options?.opacity ?? 1,
    bypassDNA: layerObj.options?.bypassDNA ?? false,
    options: {
      ...layerObj.options,
      originalFolderName: layerObj.name, // Store original folder name for duplicate filtering
    },
  }));
  return layers;
};

/* ---------- Background ---------- */

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  // Parse brightness - handle both string percentages ("80%") and numeric values (80)
  let brightness = background.brightness;
  if (typeof brightness === 'string' && brightness.endsWith('%')) {
    brightness = parseFloat(brightness.replace('%', ''));
  } else if (typeof brightness === 'string') {
    brightness = parseFloat(brightness);
  }
  // Default to 80 if parsing fails
  if (isNaN(brightness)) {
    brightness = 80;
  }
  return hslToCanvasColor(hue, 100, brightness);
};

const drawBackground = () => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

/* ---------- Metadata ---------- */

const addAttributes = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  if (!selectedElement) {
    console.warn(`Warning: Layer ${_element.layer.name} has no selectedElement, skipping attribute.`);
    return;
  }
  attributesList.push({
    trait_type: _element.layer.name,
    value: selectedElement.name,
  });
};

const addMetadata = (_dna, _edition) => {
  let dateTime = Date.now();
  let tempMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: `${baseUri}/${_edition}.png`,
    dna: sha1(_dna),
    edition: _edition,
    date: dateTime,
    ...extraMetadata,
    attributes: attributesList,
    compiler: "HashLips Art Engine (collage mod)",
  };

  if (network == NETWORK.sol) {
    tempMetadata = {
      name: tempMetadata.name,
      symbol: solanaMetadata.symbol,
      description: tempMetadata.description,
      seller_fee_basis_points: solanaMetadata.seller_fee_basis_points,
      image: `${_edition}.png`,
      external_url: solanaMetadata.external_url,
      edition: _edition,
      ...extraMetadata,
      attributes: tempMetadata.attributes,
      properties: {
        files: [{ uri: `${_edition}.png`, type: "image/png" }],
        category: "image",
        creators: solanaMetadata.creators,
      },
    };
  }
  metadataList.push(tempMetadata);
  attributesList = [];
};

/* ---------- Image Loading ---------- */

const loadLayerImg = async (_layer) => {
  if (!_layer.selectedElement) {
    throw new Error(`No selectedElement found for layer: ${_layer.name}`);
  }
  const image = await loadImage(`${_layer.selectedElement.path}`);
  return { layer: _layer, loadedImage: image };
};

/* ---------- Collage-Aware Draw ---------- */

// Store Body mask to check Prop overlap
let bodyMask = null;

// Track rendered layers for dynamic positioning
// Format: { layerName: { x, y, width, height, centerX, centerY, bottom, right, bounds: { minX, minY, maxX, maxY, centerX, centerY, top, bottom, left, right } } }
let renderedLayers = {};

// Calculate bounding box of non-transparent pixels in an image
// Improved with configurable alpha threshold (default: 1 for better edge detection)
// Lower threshold (1 instead of 10) captures semi-transparent edge pixels from anti-aliasing,
// providing more accurate bounding boxes that account for varying padding across images.
// Alpha threshold can be configured per layer via layer.options.alphaThreshold
const getImageBounds = (image, alphaThreshold = 1) => {
  if (!image) return null;
  
  const tempCanvas = createCanvas(image.width, image.height);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(image, 0, 0);
  
  const imageData = tempCtx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  
  let minX = image.width;
  let minY = image.height;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;
  
  // Use more sensitive threshold for better edge detection
  // This captures semi-transparent pixels that are part of anti-aliased edges
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = (y * image.width + x) * 4;
      const alpha = data[index + 3];
      
      if (alpha > alphaThreshold) {
        hasPixels = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  if (!hasPixels) {
    // If no pixels found, return full image bounds
    return {
      minX: 0,
      minY: 0,
      maxX: image.width,
      maxY: image.height,
      width: image.width,
      height: image.height,
      centerX: image.width / 2,
      centerY: image.height / 2,
      top: 0,
      bottom: image.height,
      left: 0,
      right: image.width,
    };
  }
  
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  
  return {
    minX,
    minY,
    maxX: maxX + 1, // Make it exclusive
    maxY: maxY + 1, // Make it exclusive
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    top: minY,
    bottom: maxY,
    left: minX,
    right: maxX,
  };
};

// Check if a position overlaps with Body pixels
const checkOverlapWithBody = (x, y, width, height, angle, image) => {
  if (!bodyMask || !image) return false;
  
  // Create a temporary canvas to render the prop and check its actual pixels
  const tempCanvas = createCanvas(Math.ceil(width), Math.ceil(height));
  const tempCtx = tempCanvas.getContext("2d");
  
  // Draw the prop image to the temp canvas
  if (angle) {
    tempCtx.save();
    tempCtx.translate(width / 2, height / 2);
    tempCtx.rotate(angle);
    tempCtx.drawImage(image, -width / 2, -height / 2, width, height);
    tempCtx.restore();
  } else {
    tempCtx.drawImage(image, 0, 0, width, height);
  }
  
  // Get the prop's pixel data
  const propImageData = tempCtx.getImageData(0, 0, width, height);
  const propData = propImageData.data;
  
  // Check each non-transparent pixel of the prop against the body mask
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const propIndex = (py * width + px) * 4;
      const propAlpha = propData[propIndex + 3];
      
      // Only check pixels that are actually part of the prop (non-transparent)
      if (propAlpha > 10) {
        // Calculate canvas coordinates
        let canvasX, canvasY;
        if (angle) {
          // Transform from prop local coordinates to canvas coordinates
          const cx = x + width / 2;
          const cy = y + height / 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const localX = px - width / 2;
          const localY = py - height / 2;
          canvasX = cx + (localX * cos - localY * sin);
          canvasY = cy + (localX * sin + localY * cos);
        } else {
          canvasX = x + px;
          canvasY = y + py;
        }
        
        // Clamp to canvas bounds
        const clampedX = Math.floor(canvasX);
        const clampedY = Math.floor(canvasY);
        
        if (clampedX >= 0 && clampedX < format.width && clampedY >= 0 && clampedY < format.height) {
          // Check if this pixel overlaps with Body
          const maskIndex = (clampedY * format.width + clampedX) * 4;
          if (maskIndex >= 0 && maskIndex < bodyMask.data.length) {
            const bodyAlpha = bodyMask.data[maskIndex + 3];
            if (bodyAlpha > 10) { // Threshold for "has body pixel"
              return true; // Found overlap
            }
          }
        }
      }
    }
  }
  
  return false; // No overlap found
};

const getLayerOpts = (layer, bodyMaskData = null, loadedImage = null, renderedLayersMap = {}) => {
  const o = layer?.options || {};
  
  // Use actual image dimensions if available, otherwise use config dimensions
  let actualWidth = o.width ?? format.width;
  let actualHeight = o.height ?? format.height;
  
  // Store original dimensions for alignment calculations (before multiplier effects)
  let originalWidth = loadedImage ? loadedImage.width : (o.width ?? format.width);
  let originalHeight = loadedImage ? loadedImage.height : (o.height ?? format.height);
  
  // Track size multiplier for scaling offsets proportionally
  let sizeMultiplier = 1;
  
  if (loadedImage) {
    // If useActualDimensions is true, use the image's natural size
    if (o.useActualDimensions === true) {
      actualWidth = loadedImage.width;
      actualHeight = loadedImage.height;
      
      // Store original dimensions before multiplier effects
      originalWidth = loadedImage.width;
      originalHeight = loadedImage.height;
      
      // First, apply max constraints with original (non-multiplied) maxWidth/maxHeight
      let originalMaxWidth = o.maxWidth;
      let originalMaxHeight = o.maxHeight;
      
      // Temporary variables for max constraint calculation
      let constrainedWidth = actualWidth;
      let constrainedHeight = actualHeight;
      
      if (originalMaxWidth && constrainedWidth > originalMaxWidth) {
        const scale = originalMaxWidth / constrainedWidth;
        constrainedWidth = originalMaxWidth;
        constrainedHeight = constrainedHeight * scale;
      }
      if (originalMaxHeight && constrainedHeight > originalMaxHeight) {
        const scale = originalMaxHeight / constrainedHeight;
        constrainedHeight = originalMaxHeight;
        constrainedWidth = constrainedWidth * scale;
      }
      
      // Now apply filename-based size multipliers if configured
      let maxWidth = o.maxWidth;
      let maxHeight = o.maxHeight;
      if (o.filenameSizeMultipliers && layer?.selectedElement?.filename) {
        const filename = layer.selectedElement.filename.toLowerCase();
        for (const [pattern, multiplier] of Object.entries(o.filenameSizeMultipliers)) {
          if (filename.includes(pattern.toLowerCase())) {
            maxWidth = maxWidth ? maxWidth * multiplier : null;
            maxHeight = maxHeight ? maxHeight * multiplier : null;
            sizeMultiplier = multiplier; // Store multiplier for offset scaling
            break; // Use first matching pattern
          }
        }
      }
      
      // Apply max constraints with multiplied maxWidth/maxHeight for final rendering size
      if (maxWidth && actualWidth > maxWidth) {
        const scale = maxWidth / actualWidth;
        actualWidth = maxWidth;
        actualHeight = actualHeight * scale;
      }
      if (maxHeight && actualHeight > maxHeight) {
        const scale = maxHeight / actualHeight;
        actualHeight = maxHeight;
        actualWidth = actualWidth * scale;
      }
    } else if (o.maintainAspectRatio && o.width && o.height) {
      // If maintainAspectRatio is true (and not using actual dimensions),
      // scale to fit the configured size while maintaining aspect
      const imageAspect = loadedImage.width / loadedImage.height;
      const configAspect = o.width / o.height;
      if (imageAspect > configAspect) {
        // Image is wider - fit to width
        actualHeight = o.width / imageAspect;
        actualWidth = o.width;
      } else {
        // Image is taller - fit to height
        actualWidth = o.height * imageAspect;
        actualHeight = o.height;
      }
    }
  }
  
  // Handle layer references for dynamic positioning
  let x = o.x ?? 0;
  let y = o.y ?? 0;
  
  // If anchorTo is specified, position relative to that layer
  if (o.anchorTo) {
    if (!renderedLayersMap[o.anchorTo]) {
      // Anchor layer not found - try fallback for nose and mouth layers
      if (layer.name === "nose") {
        // Try to use "head" as fallback anchor if "left eye" is not available
        if (o.anchorTo === "left eye" && renderedLayersMap["head"]) {
          console.warn(`Warning: Nose layer cannot find anchor layer "left eye", using "head" as fallback.`);
          // Temporarily change anchorTo to use head
          const fallbackAnchor = renderedLayersMap["head"];
          const anchorPoint = "bounds-center"; // Use center of head as fallback
          const anchorX = fallbackAnchor.centerX;
          const anchorY = fallbackAnchor.centerY;
          // Position nose in center of head area
          x = anchorX;
          y = anchorY + 100; // Offset down a bit from center
        } else {
          console.warn(`Warning: Nose layer cannot find anchor layer "${o.anchorTo}". Using default position. This may cause the nose to not appear correctly.`);
          // Use a fallback position - center of canvas as last resort
          x = format.width / 2;
          y = format.height / 2;
        }
      } else if (layer.name === "Mouth") {
        // Try to use "head" as fallback anchor if "left eye" is not available
        if (o.anchorTo === "left eye" && renderedLayersMap["head"]) {
          console.warn(`Warning: Mouth layer cannot find anchor layer "left eye", using "head" as fallback.`);
          const fallbackAnchor = renderedLayersMap["head"];
          // Position mouth below center of head
          const anchorX = fallbackAnchor.centerX;
          const anchorY = fallbackAnchor.centerY;
          // Position mouth in lower portion of head area
          x = anchorX;
          y = anchorY + 200; // Offset down from center (below nose)
        } else if (renderedLayersMap["head"]) {
          console.warn(`Warning: Mouth layer cannot find anchor layer "${o.anchorTo}", using "head" as fallback.`);
          const fallbackAnchor = renderedLayersMap["head"];
          x = fallbackAnchor.centerX;
          y = fallbackAnchor.centerY + 200;
        } else {
          console.warn(`Warning: Mouth layer cannot find anchor layer "${o.anchorTo}". Using default position. This may cause the mouth to not appear correctly.`);
          // Use a fallback position - center-bottom of canvas as last resort
          x = format.width / 2;
          y = format.height / 2 + 100;
        }
      } else {
        console.warn(`Warning: Layer ${layer.name} cannot find anchor layer "${o.anchorTo}". Using default position.`);
      }
    } else {
    const anchorLayer = renderedLayersMap[o.anchorTo];
    if (!anchorLayer) {
      console.warn(`Warning: Layer ${layer.name} cannot find anchor layer "${o.anchorTo}". Available layers: ${Object.keys(renderedLayersMap).join(', ')}`);
      // Use default position
      x = format.width / 2;
      y = format.height / 2;
    } else {
      // Debug logging for hat layer to verify it's using the correct head
      if (layer.name === "hat" && o.anchorTo) {
        console.log(`[DEBUG] Hat anchoring to "${o.anchorTo}":`, {
          anchorLayer: {
            name: o.anchorTo,
            x: anchorLayer.x,
            y: anchorLayer.y,
            width: anchorLayer.width,
            height: anchorLayer.height,
            boundsTop: anchorLayer.bounds?.top,
            boundsBottom: anchorLayer.bounds?.bottom,
          },
          availableHeads: Object.keys(renderedLayersMap).filter(k => k.startsWith('head')).map(k => ({
            name: k,
            y: renderedLayersMap[k].y,
            height: renderedLayersMap[k].height,
            boundsTop: renderedLayersMap[k].bounds?.top,
          }))
        });
      }
    const anchorPoint = o.anchorPoint || 'center';
    const useBounds = o.useBounds !== false; // Default to true - use bounding box if available
    
    // Determine if we should use bounding box or image bounds
    const useBoundingBox = useBounds && anchorLayer.bounds;
    const bounds = useBoundingBox ? anchorLayer.bounds : null;
    
    let anchorX, anchorY;
    
    // Calculate anchor point - prefer bounding box if available and useBounds is true
    if (useBoundingBox && bounds) {
      // Use bounding box coordinates (relative to image, need to add layer position)
      // Calculate scale factors based on actual rendered dimensions vs original image dimensions
      // This properly accounts for maintainAspectRatio and other scaling factors
      const originalWidth = anchorLayer.originalWidth || anchorLayer.width;
      const originalHeight = anchorLayer.originalHeight || anchorLayer.height;
      const scaleX = anchorLayer.width / originalWidth;
      const scaleY = anchorLayer.height / originalHeight;
      
      // Ensure we have valid scale factors (avoid division by zero)
      const safeScaleX = isNaN(scaleX) || !isFinite(scaleX) ? 1 : scaleX;
      const safeScaleY = isNaN(scaleY) || !isFinite(scaleY) ? 1 : scaleY;
      
      switch (anchorPoint) {
        case 'top-left':
        case 'bounds-top-left':
          anchorX = anchorLayer.x + bounds.left * safeScaleX;
          anchorY = anchorLayer.y + bounds.top * safeScaleY;
          break;
        case 'top-right':
        case 'bounds-top-right':
          anchorX = anchorLayer.x + bounds.right * safeScaleX;
          anchorY = anchorLayer.y + bounds.top * safeScaleY;
          break;
        case 'bottom-left':
        case 'bounds-bottom-left':
          anchorX = anchorLayer.x + bounds.left * safeScaleX;
          anchorY = anchorLayer.y + bounds.bottom * safeScaleY;
          break;
        case 'bottom-right':
        case 'bounds-bottom-right':
          anchorX = anchorLayer.x + bounds.right * safeScaleX;
          anchorY = anchorLayer.y + bounds.bottom * safeScaleY;
          break;
        case 'top':
        case 'bounds-top':
          anchorX = anchorLayer.x + bounds.centerX * safeScaleX;
          anchorY = anchorLayer.y + bounds.top * safeScaleY;
          break;
        case 'bottom':
        case 'bounds-bottom':
          anchorX = anchorLayer.x + bounds.centerX * safeScaleX;
          anchorY = anchorLayer.y + bounds.bottom * safeScaleY;
          break;
        case 'left':
        case 'bounds-left':
          anchorX = anchorLayer.x + bounds.left * safeScaleX;
          anchorY = anchorLayer.y + bounds.centerY * safeScaleY;
          break;
        case 'right':
        case 'bounds-right':
          anchorX = anchorLayer.x + bounds.right * safeScaleX;
          anchorY = anchorLayer.y + bounds.centerY * safeScaleY;
          break;
        case 'center':
        case 'bounds-center':
        default:
          anchorX = anchorLayer.x + bounds.centerX * safeScaleX;
          anchorY = anchorLayer.y + bounds.centerY * safeScaleY;
          break;
      }
    } else {
      // Use image bounds (original behavior)
      switch (anchorPoint) {
        case 'top-left':
          anchorX = anchorLayer.x;
          anchorY = anchorLayer.y;
          break;
        case 'top-right':
          anchorX = anchorLayer.right;
          anchorY = anchorLayer.y;
          break;
        case 'bottom-left':
          anchorX = anchorLayer.x;
          anchorY = anchorLayer.bottom;
          break;
        case 'bottom-right':
          anchorX = anchorLayer.right;
          anchorY = anchorLayer.bottom;
          break;
        case 'top':
          anchorX = anchorLayer.centerX;
          anchorY = anchorLayer.y;
          break;
        case 'bottom':
          anchorX = anchorLayer.centerX;
          anchorY = anchorLayer.bottom;
          break;
        case 'left':
          anchorX = anchorLayer.x;
          anchorY = anchorLayer.centerY;
          break;
        case 'right':
          anchorX = anchorLayer.right;
          anchorY = anchorLayer.centerY;
          break;
        case 'center':
        default:
          anchorX = anchorLayer.centerX;
          anchorY = anchorLayer.centerY;
          break;
      }
    }
    
    // Get bounding box for current layer early (needed for relative offsets that use both sizes)
    // Calculate bounds after determining final dimensions, with configurable alpha threshold
    const useBoundsForAlign = o.useBounds !== false && loadedImage;
    let currentBounds = null;
    if (useBoundsForAlign && loadedImage) {
      // Use layer-specific alpha threshold if configured, otherwise default to 1
      const alphaThreshold = o.alphaThreshold !== undefined ? o.alphaThreshold : 1;
      currentBounds = getImageBounds(loadedImage, alphaThreshold);
    }
    
    // Calculate position relative to anchor
    // offsetX/Y are offsets from the anchor point
    // relativeOffsetX/Y are multipliers of layer dimensions (for size-relative positioning)
    // By default uses anchor layer size, but can use both anchor and current layer sizes
    let offsetX = o.offsetX ?? 0;
    let offsetY = o.offsetY ?? 0;
    
    // Apply relative offsets if specified
    if (o.relativeOffsetX !== undefined && o.relativeOffsetX !== null) {
      // Calculate anchor layer size
      const useBoundingBox = o.useBounds !== false && anchorLayer.bounds;
      const anchorSize = useBoundingBox && anchorLayer.bounds
        ? (anchorLayer.bounds.right - anchorLayer.bounds.left) * (anchorLayer.width / (anchorLayer.originalWidth || anchorLayer.width))
        : anchorLayer.width;
      
      // Calculate current layer size if using both sizes
      let currentSize = anchorSize;
      if (o.relativeOffsetUseBoth !== false && loadedImage) {
        const useCurrentBounds = o.useBounds !== false && currentBounds;
        const currentLayerSize = useCurrentBounds && currentBounds
          ? (currentBounds.right - currentBounds.left) * (actualWidth / loadedImage.width)
          : actualWidth;
        // Use average of both sizes
        currentSize = (anchorSize + currentLayerSize) / 2;
      }
      
      offsetX += o.relativeOffsetX * currentSize;
    }
    
    if (o.relativeOffsetY !== undefined && o.relativeOffsetY !== null) {
      // Calculate anchor layer size
      const useBoundingBox = o.useBounds !== false && anchorLayer.bounds;
      const anchorSize = useBoundingBox && anchorLayer.bounds
        ? (anchorLayer.bounds.bottom - anchorLayer.bounds.top) * (anchorLayer.height / (anchorLayer.originalHeight || anchorLayer.height))
        : anchorLayer.height;
      
      // Calculate current layer size if using both sizes
      let currentSize = anchorSize;
      if (o.relativeOffsetUseBoth !== false && loadedImage) {
        const useCurrentBounds = o.useBounds !== false && currentBounds;
        const currentLayerSize = useCurrentBounds && currentBounds
          ? (currentBounds.bottom - currentBounds.top) * (actualHeight / loadedImage.height)
          : actualHeight;
        // Use average of both sizes
        currentSize = (anchorSize + currentLayerSize) / 2;
      }
      
      offsetY += o.relativeOffsetY * currentSize;
    }
    
    // align determines how this layer aligns to the anchor point
    const align = o.align || 'center';
    
    // Calculate alignment offset based on whether we're using bounds or image edges
    let alignOffsetX = 0;
    let alignOffsetY = 0;
    
    if (useBoundsForAlign && currentBounds) {
      // Use bounding box for alignment
      // Calculate scale factors based on actual rendered dimensions vs original image dimensions
      // Use actualWidth/actualHeight (matching rendered size) so alignment offset correctly positions
      // the bounding box point.
      const scaleX = actualWidth / originalWidth;
      const scaleY = actualHeight / originalHeight;
      
      // Ensure we have valid scale factors (avoid division by zero)
      const safeAlignScaleX = isNaN(scaleX) || !isFinite(scaleX) ? 1 : scaleX;
      const safeAlignScaleY = isNaN(scaleY) || !isFinite(scaleY) ? 1 : scaleY;
      
      // The alignment offset positions the image so that the specified bounding box point
      // ends up at the anchor point. We calculate the position of the bounding box point
      // relative to the image's top-left corner, then negate it.
      
      switch (align) {
        case 'top-left':
        case 'bounds-top-left':
          alignOffsetX = -currentBounds.left * safeAlignScaleX;
          alignOffsetY = -currentBounds.top * safeAlignScaleY;
          break;
        case 'top-right':
        case 'bounds-top-right':
          alignOffsetX = -currentBounds.right * safeAlignScaleX;
          alignOffsetY = -currentBounds.top * safeAlignScaleY;
          break;
        case 'bottom-left':
        case 'bounds-bottom-left':
          alignOffsetX = -currentBounds.left * safeAlignScaleX;
          alignOffsetY = -currentBounds.bottom * safeAlignScaleY;
          break;
        case 'bottom-right':
        case 'bounds-bottom-right':
          alignOffsetX = -currentBounds.right * safeAlignScaleX;
          alignOffsetY = -currentBounds.bottom * safeAlignScaleY;
          break;
        case 'top':
        case 'bounds-top':
          alignOffsetX = -currentBounds.centerX * safeAlignScaleX;
          alignOffsetY = -currentBounds.top * safeAlignScaleY;
          break;
        case 'bottom':
        case 'bounds-bottom':
          alignOffsetX = -currentBounds.centerX * safeAlignScaleX;
          alignOffsetY = -currentBounds.bottom * safeAlignScaleY;
          break;
        case 'left':
        case 'bounds-left':
          alignOffsetX = -currentBounds.left * safeAlignScaleX;
          alignOffsetY = -currentBounds.centerY * safeAlignScaleY;
          break;
        case 'right':
        case 'bounds-right':
          alignOffsetX = -currentBounds.right * safeAlignScaleX;
          alignOffsetY = -currentBounds.centerY * safeAlignScaleY;
          break;
        case 'center':
        case 'bounds-center':
        default:
          alignOffsetX = -currentBounds.centerX * safeAlignScaleX;
          alignOffsetY = -currentBounds.centerY * safeAlignScaleY;
          break;
      }
    } else {
      // Use image edges for alignment (original behavior)
      // Use actual rendered dimensions (matching rendered size) for alignment offset
      
      switch (align) {
        case 'top-left':
          alignOffsetX = 0;
          alignOffsetY = 0;
          break;
        case 'top-right':
          alignOffsetX = -actualWidth;
          alignOffsetY = 0;
          break;
        case 'bottom-left':
          alignOffsetX = 0;
          alignOffsetY = -actualHeight;
          break;
        case 'bottom-right':
          alignOffsetX = -actualWidth;
          alignOffsetY = -actualHeight;
          break;
        case 'top':
          alignOffsetX = -actualWidth / 2;
          alignOffsetY = 0;
          break;
        case 'bottom':
          alignOffsetX = -actualWidth / 2;
          alignOffsetY = -actualHeight;
          break;
        case 'left':
          alignOffsetX = 0;
          alignOffsetY = -actualHeight / 2;
          break;
        case 'right':
          alignOffsetX = -actualWidth;
          alignOffsetY = -actualHeight / 2;
          break;
        case 'center':
        default:
          alignOffsetX = -actualWidth / 2;
          alignOffsetY = -actualHeight / 2;
          break;
      }
    }
    
    // Final position = anchor point + alignment offset + user offset
    x = anchorX + alignOffsetX + offsetX;
    y = anchorY + alignOffsetY + offsetY;
    }
    }
  }
  
  // Check if constraints should be disabled for this filename
  let shouldConstrain = o.constrainToBounds !== undefined && o.constrainToBounds !== null;
  if (shouldConstrain && o.filenameDisableConstraints && layer?.selectedElement?.filename) {
    const filename = layer.selectedElement.filename.toLowerCase();
    for (const pattern of Object.keys(o.filenameDisableConstraints)) {
      if (filename.includes(pattern.toLowerCase())) {
        shouldConstrain = false;
        break;
      }
    }
  }
  
  // Constrain to bounds if specified (e.g., keep features within head's bounding box)
  if (shouldConstrain && o.constrainToBounds && renderedLayersMap[o.constrainToBounds]) {
    const constraintLayer = renderedLayersMap[o.constrainToBounds];
    const useConstraintBounds = constraintLayer.bounds;
    
    if (useConstraintBounds) {
      // Get the constraint layer's bounding box in canvas coordinates
      const constraintScaleX = constraintLayer.width / (constraintLayer.originalWidth || constraintLayer.width);
      const constraintScaleY = constraintLayer.height / (constraintLayer.originalHeight || constraintLayer.height);
      
      // Ensure we have valid scale factors (avoid division by zero)
      const safeConstraintScaleX = isNaN(constraintScaleX) || !isFinite(constraintScaleX) ? 1 : constraintScaleX;
      const safeConstraintScaleY = isNaN(constraintScaleY) || !isFinite(constraintScaleY) ? 1 : constraintScaleY;
      
      const constraintLeft = constraintLayer.x + constraintLayer.bounds.left * safeConstraintScaleX;
      const constraintTop = constraintLayer.y + constraintLayer.bounds.top * safeConstraintScaleY;
      const constraintRight = constraintLayer.x + constraintLayer.bounds.right * safeConstraintScaleX;
      const constraintBottom = constraintLayer.y + constraintLayer.bounds.bottom * safeConstraintScaleY;
      
      // Get current layer's bounding box if available, otherwise use image edges
      // Use layer-specific alpha threshold if configured
      let currentBounds = null;
      if (loadedImage) {
        const alphaThreshold = o.alphaThreshold !== undefined ? o.alphaThreshold : 1;
        currentBounds = getImageBounds(loadedImage, alphaThreshold);
      }
      
      let layerLeft, layerTop, layerRight, layerBottom;
      
      if (currentBounds && o.useBounds !== false) {
        // Use bounding box for constraint checking
        const layerScaleX = actualWidth / loadedImage.width;
        const layerScaleY = actualHeight / loadedImage.height;
        
        // Ensure we have valid scale factors
        const safeLayerScaleX = isNaN(layerScaleX) || !isFinite(layerScaleX) ? 1 : layerScaleX;
        const safeLayerScaleY = isNaN(layerScaleY) || !isFinite(layerScaleY) ? 1 : layerScaleY;
        
        layerLeft = x + currentBounds.left * safeLayerScaleX;
        layerTop = y + currentBounds.top * safeLayerScaleY;
        layerRight = x + currentBounds.right * safeLayerScaleX;
        layerBottom = y + currentBounds.bottom * safeLayerScaleY;
      } else {
        // Use image edges for constraint checking
        layerLeft = x;
        layerTop = y;
        layerRight = x + actualWidth;
        layerBottom = y + actualHeight;
      }
      
      // Adjust position to keep within bounds
      if (layerLeft < constraintLeft) {
        x += constraintLeft - layerLeft;
      }
      if (layerTop < constraintTop) {
        y += constraintTop - layerTop;
      }
      if (layerRight > constraintRight) {
        x -= layerRight - constraintRight;
      }
      if (layerBottom > constraintBottom) {
        y -= layerBottom - constraintBottom;
      }
    }
  }
  
  // Handle random positioning
  
  if (o.randomPosition) {
    const width = actualWidth;
    const height = actualHeight;
    
    // For Props, try to find a position that doesn't overlap with Body
    if (layer.name === "Prop" && bodyMaskData) {
      let attempts = 0;
      const maxAttempts = 50; // Try up to 50 times to find a non-overlapping position
      let foundPosition = false;
      
      while (attempts < maxAttempts && !foundPosition) {
        // Random position anywhere on canvas
        x = Math.random() * format.width - width / 2;
        y = Math.random() * format.height - height / 2;
        
        // Apply position jitter if specified
        if (o.positionJitter) {
          x += (Math.random() - 0.5) * o.positionJitter;
          y += (Math.random() - 0.5) * o.positionJitter;
        }
        
        // Check overlap (we'll check this later in drawElement with the actual image)
        // For now, just use this position
        foundPosition = true;
        attempts++;
      }
    } else {
      // Random position anywhere on canvas, allowing props to go partially off-canvas
      x = Math.random() * format.width - width / 2;
      y = Math.random() * format.height - height / 2;
      
      // Apply position jitter if specified
      if (o.positionJitter) {
        x += (Math.random() - 0.5) * o.positionJitter;
        y += (Math.random() - 0.5) * o.positionJitter;
      }
    }
  } else if (o.positionJitter) {
    // Apply jitter to fixed positions
    x += (Math.random() - 0.5) * o.positionJitter;
    y += (Math.random() - 0.5) * o.positionJitter;
  }
  
  // Handle random scaling
  let scale = o.scale ?? 1.0;
  if (o.randomScale && o.scaleRange) {
    const [minScale, maxScale] = o.scaleRange;
    scale = minScale + Math.random() * (maxScale - minScale);
  }
  
  // Handle random opacity
  let opacity = o.opacity ?? layer.opacity ?? 1;
  if (o.randomOpacity && o.opacityRange) {
    const [minOpacity, maxOpacity] = o.opacityRange;
    opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
  }
  
  // Handle random blend modes - refined, layered aesthetic
  let blend = o.blend ?? layer.blend ?? "source-over";
  if (o.randomBlend) {
    const blendModes = [
      "source-over",
      "source-over",  // higher chance of normal
      "source-over",  // even higher chance for refined look
      "overlay",      // enhances contrast subtly
      "soft-light",   // gentle, refined effect
      "multiply",     // darkens for depth
      "screen",       // lightens subtly
      "lighten",      // keeps bright areas
      "darken",       // adds depth
      "color-burn",   // subtle darkening
      "hard-light",   // moderate contrast
      "luminosity"    // brightness shift
    ];
    blend = blendModes[Math.floor(Math.random() * blendModes.length)];
  }
  
  // Handle rotation
  let rotateRange = o.rotateRange ?? 0.08;
  
  // Handle rainbow tint overlay
  let rainbowTint = o.rainbowTint ?? false;
  let tintColor = null;
  let tintIntensity = 0;
  if (rainbowTint && o.tintIntensity) {
    const [minIntensity, maxIntensity] = o.tintIntensity;
    tintIntensity = minIntensity + Math.random() * (maxIntensity - minIntensity);
    // Generate random rainbow color
    const hue = Math.floor(Math.random() * 360);
    tintColor = hslToCanvasColor(hue, 100, 50);
  }
  
  // Handle random glow
  let glowRadius = 0;
  let glowColor = null;
  if (o.randomGlow && o.glowRadius) {
    const [minRadius, maxRadius] = o.glowRadius;
    glowRadius = minRadius + Math.random() * (maxRadius - minRadius);
    // Random glow color
    const hue = Math.floor(Math.random() * 360);
    glowColor = hslToCanvasColor(hue, 100, 60);
  }
  
  // Handle random shadow
  let shadowBlur = 0;
  let shadowOffsetX = 0;
  let shadowOffsetY = 0;
  let shadowColor = null;
  if (o.randomShadow && o.shadowBlur) {
    const [minBlur, maxBlur] = o.shadowBlur;
    shadowBlur = minBlur + Math.random() * (maxBlur - minBlur);
    shadowOffsetX = (Math.random() - 0.5) * 20;
    shadowOffsetY = (Math.random() - 0.5) * 20;
    // Random shadow color
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 50 + 50);
    shadowColor = hslToCanvasColor(hue, saturation, 30, 0.8);
  }
  
  return {
    x,
    y,
    width: actualWidth,
    height: actualHeight,
    opacity,
    blend,
    jitter: o.jitter ?? 0,
    rotate: o.rotate ?? 0,
    randomRotate: o.randomRotate ?? false,
    rotateRange,
    scale,
    rainbowTint,
    tintColor,
    tintIntensity,
    glowRadius,
    glowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    shadowColor,
  };
};

const drawElement = (renderObj, index, layersLen) => {
  const { layer, loadedImage } = renderObj;
  
  // Use pre-calculated layer options if available, otherwise calculate them
  let layerOpts;
  if (renderObj.layerOpts) {
    layerOpts = renderObj.layerOpts;
  } else {
    layerOpts = getLayerOpts(layer, bodyMask, loadedImage, renderedLayers);
    renderObj.layerOpts = layerOpts; // Store for reuse
  }
  
  const {
    x,
    y,
    width,
    height,
    opacity,
    blend,
    jitter,
    rotate,
    randomRotate,
    rotateRange,
    scale,
    rainbowTint,
    tintColor,
    tintIntensity,
    glowRadius,
    glowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    shadowColor,
  } = layerOpts;

  // Calculate jitter once and store it for layer tracking
  if (!renderObj.jitterX && !renderObj.jitterY && jitter) {
    renderObj.jitterX = (Math.random() - 0.5) * jitter;
    renderObj.jitterY = (Math.random() - 0.5) * jitter;
  }
  const jx = renderObj.jitterX || 0;
  const jy = renderObj.jitterY || 0;
  const randAngle = randomRotate ? (Math.random() - 0.5) * 2 * rotateRange : 0;
  const angle = rotate + randAngle;

  // Apply scale to dimensions
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // For Props, check if position overlaps with Body and try to reposition if needed
  if (layer.name === "Prop" && bodyMask) {
    const isFixedPosition = !layer.options?.randomPosition;
    let currentX = x + jx;
    let currentY = y + jy;
    let foundPosition = false;
    
    if (isFixedPosition) {
      // For fixed positions (corners), check overlap but allow it if it's a fixed corner position
      // We'll still check but won't reposition - corners are intentional
      foundPosition = true; // Always allow fixed positions
    } else {
      // For random positions, try to find a non-overlapping position
      let attempts = 0;
      const maxAttempts = 100;
      
      while (attempts < maxAttempts) {
        if (!checkOverlapWithBody(currentX, currentY, scaledWidth, scaledHeight, angle, loadedImage)) {
          foundPosition = true;
          break;
        }
        
        // Try a new random position using scaled dimensions
        currentX = Math.random() * format.width - scaledWidth / 2;
        currentY = Math.random() * format.height - scaledHeight / 2;
        
        if (layer.options?.positionJitter) {
          currentX += (Math.random() - 0.5) * layer.options.positionJitter;
          currentY += (Math.random() - 0.5) * layer.options.positionJitter;
        }
        
        attempts++;
      }
    }
    
    // If we couldn't find a non-overlapping position (and it's not fixed), skip drawing this prop
    if (!foundPosition) {
      return; // Skip drawing this prop
    }
    
    // Use the position (fixed or found)
    const finalX = currentX;
    const finalY = currentY;
    
    // Draw with adjusted position
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blend;

    // Determine which effect to use (glow takes priority)
    let finalShadowBlur = 0;
    let finalShadowOffsetX = 0;
    let finalShadowOffsetY = 0;
    let finalShadowColor = 'transparent';

    if (glowRadius > 0) {
      finalShadowBlur = glowRadius;
      finalShadowOffsetX = 0;
      finalShadowOffsetY = 0;
      finalShadowColor = glowColor;
    } else if (shadowBlur > 0) {
      finalShadowBlur = shadowBlur;
      finalShadowOffsetX = shadowOffsetX;
      finalShadowOffsetY = shadowOffsetY;
      finalShadowColor = shadowColor;
    }

    ctx.shadowBlur = finalShadowBlur;
    ctx.shadowOffsetX = finalShadowOffsetX;
    ctx.shadowOffsetY = finalShadowOffsetY;
    ctx.shadowColor = finalShadowColor;

    if (!angle) {
      ctx.drawImage(loadedImage, finalX, finalY, scaledWidth, scaledHeight);
    } else {
      ctx.save();
      const cx = finalX + scaledWidth / 2;
      const cy = finalY + scaledHeight / 2;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(loadedImage, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = 'transparent';

    // Apply rainbow tint if needed
    if (rainbowTint && tintIntensity > 0) {
      const overlayWidth = Math.max(1, Math.ceil(scaledWidth));
      const overlayHeight = Math.max(1, Math.ceil(scaledHeight));
      const overlayCanvas = createCanvas(overlayWidth, overlayHeight);
      const overlayCtx = overlayCanvas.getContext("2d");

      overlayCtx.drawImage(loadedImage, 0, 0, overlayWidth, overlayHeight);
      
      const imageData = overlayCtx.getImageData(0, 0, overlayWidth, overlayHeight);
      const data = imageData.data;
      const hueOffset = Math.random() * 360;
      
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          const pixelIndex = i / 4;
          const px = pixelIndex % overlayWidth;
          const py = Math.floor(pixelIndex / overlayWidth);
          const gradientPos = (px / overlayWidth + py / overlayHeight) / 2;
          const hue = (gradientPos * 360 + hueOffset) % 360;
          const rainbowColor = hslToCanvasColor(hue, 100, 50);
          const rgbaMatch = rainbowColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          
          if (rgbaMatch) {
            const rainbowR = parseInt(rgbaMatch[1]);
            const rainbowG = parseInt(rgbaMatch[2]);
            const rainbowB = parseInt(rgbaMatch[3]);
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            data[i] = Math.round(r * (1 - tintIntensity) + rainbowR * tintIntensity);
            data[i + 1] = Math.round(g * (1 - tintIntensity) + rainbowG * tintIntensity);
            data[i + 2] = Math.round(b * (1 - tintIntensity) + rainbowB * tintIntensity);
          }
        }
      }
      
      overlayCtx.putImageData(imageData, 0, 0);

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (!angle) {
        ctx.drawImage(overlayCanvas, finalX, finalY, scaledWidth, scaledHeight);
      } else {
        const cx = finalX + scaledWidth / 2;
        const cy = finalY + scaledHeight / 2;
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.drawImage(overlayCanvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }

      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    addAttributes(renderObj);
    return; // Early return for Props
  }

  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blend;

  // Determine which effect to use (glow takes priority)
  let finalShadowBlur = 0;
  let finalShadowOffsetX = 0;
  let finalShadowOffsetY = 0;
  let finalShadowColor = 'transparent';

  if (glowRadius > 0) {
    // Use glow effect
    finalShadowBlur = glowRadius;
    finalShadowOffsetX = 0;
    finalShadowOffsetY = 0;
    finalShadowColor = glowColor;
  } else if (shadowBlur > 0) {
    // Use shadow effect
    finalShadowBlur = shadowBlur;
    finalShadowOffsetX = shadowOffsetX;
    finalShadowOffsetY = shadowOffsetY;
    finalShadowColor = shadowColor;
  }

  // Apply the effect
  ctx.shadowBlur = finalShadowBlur;
  ctx.shadowOffsetX = finalShadowOffsetX;
  ctx.shadowOffsetY = finalShadowOffsetY;
  ctx.shadowColor = finalShadowColor;

  // Draw the image
  if (!angle) {
    ctx.drawImage(loadedImage, x + jx, y + jy, scaledWidth, scaledHeight);
  } else {
    ctx.save();
    const cx = x + jx + scaledWidth / 2;
    const cy = y + jy + scaledHeight / 2;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.drawImage(loadedImage, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
    ctx.restore();
  }

  // Reset shadow/glow
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = 'transparent';

  // Apply rainbow tint OVER the drawn image (only affects non-transparent pixels)
  if (rainbowTint && tintIntensity > 0) {
    const overlayWidth = Math.max(1, Math.ceil(scaledWidth));
    const overlayHeight = Math.max(1, Math.ceil(scaledHeight));
    const overlayCanvas = createCanvas(overlayWidth, overlayHeight);
    const overlayCtx = overlayCanvas.getContext("2d");

    // Draw the original image first to preserve its alpha channel
    overlayCtx.drawImage(loadedImage, 0, 0, overlayWidth, overlayHeight);
    
    // Extract image data to work with pixels directly
    const imageData = overlayCtx.getImageData(0, 0, overlayWidth, overlayHeight);
    const data = imageData.data;
    
    // Generate a random starting hue offset for variety
    const hueOffset = Math.random() * 360;
    
    // Apply rainbow gradient tint only to non-transparent pixels, preserving alpha
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        // Calculate pixel position
        const pixelIndex = i / 4;
        const px = pixelIndex % overlayWidth;
        const py = Math.floor(pixelIndex / overlayWidth);
        
        // Create rainbow gradient based on position
        // Use diagonal gradient for more interesting effect (combine x and y)
        const gradientPos = (px / overlayWidth + py / overlayHeight) / 2;
        const hue = (gradientPos * 360 + hueOffset) % 360;
        
        // Convert hue to RGB using HSL
        const rainbowColor = hslToCanvasColor(hue, 100, 50);
        const rgbaMatch = rainbowColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        
        if (rgbaMatch) {
          const rainbowR = parseInt(rgbaMatch[1]);
          const rainbowG = parseInt(rgbaMatch[2]);
          const rainbowB = parseInt(rgbaMatch[3]);
          
          // Get original pixel color
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Blend rainbow color with original pixel color using tint intensity
          data[i] = Math.round(r * (1 - tintIntensity) + rainbowR * tintIntensity);
          data[i + 1] = Math.round(g * (1 - tintIntensity) + rainbowG * tintIntensity);
          data[i + 2] = Math.round(b * (1 - tintIntensity) + rainbowB * tintIntensity);
          // Keep original alpha unchanged
        }
      }
    }
    
    overlayCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.globalAlpha = 1; // Use full opacity since we already applied intensity in the blend
    ctx.globalCompositeOperation = "source-over";

    if (!angle) {
      ctx.drawImage(overlayCanvas, x + jx, y + jy, scaledWidth, scaledHeight);
    } else {
      const cx = x + jx + scaledWidth / 2;
      const cy = y + jy + scaledHeight / 2;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(overlayCanvas, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
    }

    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  addAttributes(renderObj);
};

/* ---------- DNA / Generation ---------- */

const cleanDna = (_str) => {
  if (!_str || typeof _str !== 'string') {
    return NaN;
  }
  const cleaned = removeQueryStrings(_str);
  const parts = cleaned.split(":");
  if (parts.length === 0 || !parts[0]) {
    return NaN;
  }
  const id = Number(parts[0]);
  return isNaN(id) ? NaN : id;
};

const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, "");
};

const filterDNAOptions = (_dna) => {
  // Split DNA string properly - same logic as constructLayerToDna
  // Split on "-" but only when followed by digits and colon (start of new DNA part)
  const dnaItems = _dna.split(/-(?=\d+:)/);
  const filteredDNA = dnaItems.filter((element) => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) return true;
    const options = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);
    return options.bypassDNA;
  });
  return filteredDNA.join(DNA_DELIMITER);
};

const isDnaUnique = (_DnaList = new Set(), _dna = "") =>
  !_DnaList.has(filterDNAOptions(_dna));

const createDna = (_layers, backgroundUsageCounts = null) => {
  let randNum = [];
  let dnaIndex = 0;
  // Track selected Prop element IDs to prevent duplicates
  const selectedPropElementIds = new Set();
  // Track selected head element IDs to prevent duplicates across multiple head layers
  const selectedHeadElementIds = new Set();
  // Track selected left eye element IDs to prevent duplicates across multiple left eye layers
  const selectedLeftEyeElementIds = new Set();
  // Track selected right eye element IDs to prevent duplicates across multiple right eye layers
  const selectedRightEyeElementIds = new Set();
  // Track selected mouth element IDs to prevent duplicates across multiple mouth layers
  const selectedMouthElementIds = new Set();
  // Track if hair was selected (for mutually exclusive hat/hair logic)
  let hairSelected = false;
  
  _layers.forEach((layer, layerIndex) => {
    if (layer.elements.length === 0) {
      console.warn(`Warning: Layer ${layer.name} has no elements, skipping in DNA creation.`);
      return; // Skip this layer - no DNA part will be added
    }
    
    const layerOptions = layer.options || {};
    
    // Check if layer has a probability setting (conditional layer)
    // If probability is set, randomly skip this layer based on the probability
    if (layerOptions.probability !== undefined && layerOptions.probability !== null) {
      const probability = Math.max(0, Math.min(1, layerOptions.probability)); // Clamp between 0 and 1
      if (Math.random() > probability) {
        // Skip this layer - it won't appear in this generation
        return;
      }
    }
    
    // Check for mutually exclusive layers (e.g., hat/hair) AFTER probability check
    // This ensures hair is processed first, then hat checks if hair was selected
    if (layerOptions.mutuallyExclusiveWith) {
      // If this layer is mutually exclusive with another layer that was already selected, skip it
      if (hairSelected && layerOptions.mutuallyExclusiveWith === "hair") {
        return; // Skip hat if hair was selected
      }
    }
    
    // Track if hair was selected (for mutually exclusive logic)
    if (layer.name === "hair") {
      // We'll set this flag after we successfully select a hair element
      // For now, we'll check probability and track selection later
    }
    
    // Get original folder name (before displayName override) for duplicate filtering
    const originalFolderName = layer.options?.originalFolderName || layer.name;
    
    // For Prop layers, filter out already-selected elements
    let availableElements = layer.elements;
    if (layer.name === "Prop") {
      availableElements = layer.elements.filter(e => !selectedPropElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All Prop elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedPropElementIds.clear(); // Reset for this image
      }
    }
    
    // For head layers, filter out already-selected elements (sampling without replacement)
    // Check original folder name, not displayName
    if (originalFolderName === "head") {
      availableElements = layer.elements.filter(e => !selectedHeadElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All head elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedHeadElementIds.clear(); // Reset for this image
      }
    }
    
    // For left eye layers, filter out already-selected elements (sampling without replacement)
    // Check original folder name, not displayName
    if (originalFolderName === "left eye") {
      availableElements = layer.elements.filter(e => !selectedLeftEyeElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All left eye elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedLeftEyeElementIds.clear(); // Reset for this image
      }
    }
    
    // For right eye layers, filter out already-selected elements (sampling without replacement)
    // Check original folder name, not displayName
    if (originalFolderName === "right eye") {
      availableElements = layer.elements.filter(e => !selectedRightEyeElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All right eye elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedRightEyeElementIds.clear(); // Reset for this image
      }
    }
    
    // For mouth layers, filter out already-selected elements (sampling without replacement)
    // Check original folder name, not displayName
    if (originalFolderName === "Mouth") {
      availableElements = layer.elements.filter(e => !selectedMouthElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All mouth elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedMouthElementIds.clear(); // Reset for this image
      }
    }
    
    // For Background layer, adjust weights to favor less-used backgrounds for roughly equal distribution
    if (layer.name === "Background" && backgroundUsageCounts) {
      // Calculate the minimum usage count
      const minUsage = Math.min(...layer.elements.map(e => backgroundUsageCounts[e.filename] || 0));
      // Adjust weights: add bonus weight inversely proportional to usage
      // Elements with lower usage get higher effective weight
      availableElements = availableElements.map(e => {
        const usage = backgroundUsageCounts[e.filename] || 0;
        const usageDiff = usage - minUsage;
        // Add bonus weight: the less used, the more weight
        // Formula: baseWeight * (1 + bonusMultiplier * (1 / (usageDiff + 1)))
        // If base weight is 0 or undefined, use 1 as default
        const baseWeight = e.weight > 0 ? e.weight : 1;
        const bonusMultiplier = 5; // Adjust this to control how strongly to favor less-used backgrounds
        const adjustedWeight = baseWeight * (1 + bonusMultiplier / (usageDiff + 1));
        return { ...e, adjustedWeight, weight: baseWeight };
      });
    }
    
    var totalWeight = availableElements.reduce((sum, e) => {
      const weight = e.adjustedWeight !== undefined ? e.adjustedWeight : (e.weight > 0 ? e.weight : 1);
      return sum + weight;
    }, 0);
    
    if (totalWeight === 0 || isNaN(totalWeight)) {
      // Background, nose, and mouth layers should always be included - don't skip them
      if (layer.name === "Background" || layer.name === "nose" || layer.name === "Mouth") {
        console.warn(`Warning: Layer ${layer.name} has elements with total weight of 0 or NaN. Using equal weights for all elements.`);
        // Assign equal weight of 1 to all elements
        availableElements = availableElements.map(e => ({ ...e, weight: 1, adjustedWeight: undefined }));
        totalWeight = availableElements.length;
      } else {
        console.warn(`Warning: Layer ${layer.name} has elements with total weight of 0, skipping in DNA creation.`);
        return; // Skip this layer - no DNA part will be added
      }
    }
    let random = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < availableElements.length; i++) {
      // Use same logic as totalWeight calculation - default to 1 if weight is 0 or undefined
      let elementWeight = availableElements[i].adjustedWeight !== undefined 
        ? availableElements[i].adjustedWeight 
        : (availableElements[i].weight > 0 ? availableElements[i].weight : 1);
      random -= elementWeight;
      if (random < 0) {
        const selectedElement = availableElements[i];
        // Track background usage for roughly equal distribution
        if (layer.name === "Background" && backgroundUsageCounts) {
          backgroundUsageCounts[selectedElement.filename] = (backgroundUsageCounts[selectedElement.filename] || 0) + 1;
        }
        randNum.push(
          `${selectedElement.id}:${selectedElement.filename}${
            layer.bypassDNA ? "?bypassDNA=true" : ""
          }`
        );
        // Track selected Prop element to prevent duplicates
        if (layer.name === "Prop") {
          selectedPropElementIds.add(selectedElement.id);
        }
        // Track selected head element to prevent duplicates across multiple head layers
        // Check original folder name, not displayName
        const originalFolderName = layer.options?.originalFolderName || layer.name;
        if (originalFolderName === "head") {
          selectedHeadElementIds.add(selectedElement.id);
        }
        // Track selected left eye element to prevent duplicates across multiple left eye layers
        // Check original folder name, not displayName
        if (originalFolderName === "left eye") {
          selectedLeftEyeElementIds.add(selectedElement.id);
        }
        // Track selected right eye element to prevent duplicates across multiple right eye layers
        // Check original folder name, not displayName
        if (originalFolderName === "right eye") {
          selectedRightEyeElementIds.add(selectedElement.id);
        }
        // Track selected mouth element to prevent duplicates across multiple mouth layers
        // Check original folder name, not displayName
        if (originalFolderName === "Mouth") {
          selectedMouthElementIds.add(selectedElement.id);
        }
        // Track if hair was selected (for mutually exclusive hat/hair logic)
        if (layer.name === "hair") {
          hairSelected = true;
        }
        dnaIndex++;
        break;
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const constructLayerToDna = (_dna = "", _layers = []) => {
  // Split DNA string properly - DNA format is "id:filename-id:filename-id:filename"
  // We need to split on "-" but only when it's followed by digits and colon (start of new DNA part)
  // Use regex to split on "-" followed by pattern like "123:" (digits:colon)
  // This handles filenames that contain dashes like "Unknown-57.png"
  const dnaParts = _dna.split(/-(?=\d+:)/)
    .map(part => part.trim())
    .filter(part => part.length > 0);
  
  // First, create a map of DNA parts to their target layers
  // DNA parts are created in layer order, so match them by position
  // This handles cases where multiple layers share the same folder name (like head layers)
  const dnaPartToLayerMap = new Map();
  let dnaPartIndex = 0;
  
  _layers.forEach((layer, layerIndex) => {
    // Skip layers with no elements - they don't have DNA parts
    if (layer.elements.length === 0) {
      return;
    }
    
    // Handle layers with probability 0.0 - they were skipped during DNA creation
    const layerOptions = layer.options || {};
    if (layerOptions.probability !== undefined && layerOptions.probability !== null) {
      const probability = Math.max(0, Math.min(1, layerOptions.probability));
      if (probability === 0) {
        return; // This layer was skipped, no DNA part for it
      }
    }
    
    // Match the next DNA part to this layer (DNA parts are created in layer order)
    if (dnaPartIndex < dnaParts.length) {
      const dnaPart = dnaParts[dnaPartIndex];
      const filenameMatch = dnaPart.match(/^\d+:([^?]+)/);
      const filename = filenameMatch ? filenameMatch[1] : null;
      
      if (filename) {
        // Verify the element exists in this layer
        const element = layer.elements.find(e => e.filename === filename);
        if (element) {
          dnaPartToLayerMap.set(dnaPartIndex, { layerIndex, element, dnaPart });
          dnaPartIndex++;
        } else {
          // Element doesn't match this layer - try to find it in any layer (fallback)
          for (let i = 0; i < _layers.length; i++) {
            const otherLayer = _layers[i];
            const otherElement = otherLayer.elements.find(e => e.filename === filename);
            if (otherElement) {
              dnaPartToLayerMap.set(dnaPartIndex, { layerIndex: i, element: otherElement, dnaPart });
              dnaPartIndex++;
              break;
            }
          }
        }
      } else {
        dnaPartIndex++; // Skip invalid DNA part
      }
    }
  });
  
  if (debugLogs) {
    console.log(`Constructing DNA: "${_dna}"`);
    console.log(`DNA parts (${dnaParts.length}):`, dnaParts);
    console.log(`Layers (${_layers.length}):`, _layers.map(l => ({ name: l.name, elementCount: l.elements.length, bypassDNA: l.bypassDNA })));
    console.log(`DNA part to layer map:`, Array.from(dnaPartToLayerMap.entries()).map(([i, v]) => ({ dnaIndex: i, layerIndex: v.layerIndex, filename: v.element.filename })));
  }
  
  // Track which DNA parts have been consumed
  const consumedDnaParts = new Set();
  
  return _layers.map((layer, layerIndex) => {
    // Skip layers with no elements - they won't have DNA parts
    if (layer.elements.length === 0) {
      console.warn(`Warning: Layer ${layer.name} has no elements.`);
      return {
        name: layer.name,
        blend: layer.blend,
        opacity: layer.opacity,
        options: layer.options,
        selectedElement: undefined,
        layer,
      };
    }
    
    // Handle layers with probability 0.0
    // If probability is 0.0 now, skip the layer (same as createDna)
    const layerOptions = layer.options || {};
    if (layerOptions.probability !== undefined && layerOptions.probability !== null) {
      const probability = Math.max(0, Math.min(1, layerOptions.probability)); // Clamp between 0 and 1
      if (probability === 0) {
        // Skip this layer - it won't appear in this generation (same as createDna)
        // Check if there's a DNA part for this layer and mark it as consumed if found
        for (const [dnaIndex, entry] of dnaPartToLayerMap.entries()) {
          if (entry.layerIndex === layerIndex && !consumedDnaParts.has(dnaIndex)) {
            consumedDnaParts.add(dnaIndex);
            break;
          }
        }
        return {
          name: layer.name,
          blend: layer.blend,
          opacity: layer.opacity,
          options: layer.options,
          selectedElement: undefined,
          layer,
        };
      }
    }
    
    // Find the DNA part that belongs to this layer (using the pre-built map)
    let matchingDnaEntry = null;
    for (const [dnaIndex, entry] of dnaPartToLayerMap.entries()) {
      if (entry.layerIndex === layerIndex && !consumedDnaParts.has(dnaIndex)) {
        matchingDnaEntry = { dnaIndex, ...entry };
        break;
      }
    }
    
    // If no DNA part found for this layer, it was skipped during DNA creation
    // For nose and mouth layers, try to find their DNA parts even if they were mis-assigned
    if (!matchingDnaEntry) {
      if (layer.name === "nose" || layer.name === "Mouth") {
        // Try to find a DNA part that belongs to this layer by checking filename
        for (const [dnaIndex, entry] of dnaPartToLayerMap.entries()) {
          if (!consumedDnaParts.has(dnaIndex)) {
            // Check if this element actually belongs to this layer
            const layerElement = layer.elements.find(e => e.filename === entry.element.filename);
            if (layerElement) {
              console.warn(`Warning: ${layer.name} layer DNA part was mis-assigned, correcting.`);
              matchingDnaEntry = { dnaIndex, ...entry, element: layerElement };
              break;
            }
          }
        }
        if (!matchingDnaEntry) {
          console.error(`ERROR: ${layer.name} layer has no DNA part! This should never happen. DNA: ${_dna}`);
          // For critical layers like mouth and nose, try to assign a random element as fallback
          if (layer.elements.length > 0) {
            const fallbackElement = layer.elements[Math.floor(Math.random() * layer.elements.length)];
            console.warn(`Warning: Assigning random ${layer.name} element as fallback: ${fallbackElement.filename}`);
            return {
              name: layer.name,
              blend: layer.blend,
              opacity: layer.opacity,
              options: layer.options,
              selectedElement: fallbackElement,
              layer,
            };
          }
        }
      }
      
      if (!matchingDnaEntry) {
        return {
          name: layer.name,
          blend: layer.blend,
          opacity: layer.opacity,
          options: layer.options,
          selectedElement: undefined,
          layer,
        };
      }
    }
    
    // Mark this DNA part as consumed
    consumedDnaParts.add(matchingDnaEntry.dnaIndex);
    
    const dnaPart = matchingDnaEntry.dnaPart;
    const selectedElement = matchingDnaEntry.element;
    
    // Validate the element ID matches
    const elementId = cleanDna(dnaPart);
    if (!isNaN(elementId) && selectedElement.id != elementId) {
      console.warn(`Warning: DNA part ID ${elementId} doesn't match element ID ${selectedElement.id} for layer ${layer.name}. DNA part: "${dnaPart}"`);
    }
    
    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      options: layer.options,
      selectedElement,
      layer,
    };
  });
};

/* ---------- Save / Metadata ---------- */

const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer("image/png")
  );
};

const writeMetaData = (_data) =>
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  fs.writeFileSync(
    `${buildDir}/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

/* ---------- Main Loop ---------- */

const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];

  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  )
    abstractedIndexes.push(i);

  if (shuffleLayerConfigurations)
    abstractedIndexes = abstractedIndexes.sort(() => Math.random() - 0.5);

  while (layerConfigIndex < layerConfigurations.length) {
    const layers = layersSetup(layerConfigurations[layerConfigIndex].layersOrder);
    // Track background usage counts for roughly equal distribution
    const backgroundUsageCounts = {};
    // Initialize counts for all background elements
    const backgroundLayer = layers.find(l => l.name === "Background");
    if (backgroundLayer) {
      backgroundLayer.elements.forEach(e => {
        backgroundUsageCounts[e.filename] = 0;
      });
    }
    
    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = createDna(layers, backgroundUsageCounts);
      if (!isDnaUnique(dnaList, newDna)) {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to reach edition ${layerConfigurations[layerConfigIndex].growEditionSizeTo}`
          );
          process.exit();
        }
        continue;
      }

      let results = constructLayerToDna(newDna, layers);
      
      // Filter out layers without a selectedElement before loading
      let validResults = results.filter((layer) => layer.selectedElement !== undefined);
      
      let loadedElements = validResults.map((layer) => loadLayerImg(layer));
      await Promise.all(loadedElements).catch((error) => {
        console.error(`Error loading layers for edition ${abstractedIndexes[0]}:`, error);
        throw error;
      }).then((renderObjectArray) => {
        ctx.clearRect(0, 0, format.width, format.height);
        // Reset body mask and rendered layers for each new image
        bodyMask = null;
        renderedLayers = {};
        
        if (gif.export) {
          hashlipsGiffer = new HashlipsGiffer(
            canvas,
            ctx,
            `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
            gif.repeat,
            gif.quality,
            gif.delay
          );
          hashlipsGiffer.start();
        }
        if (background.generate) drawBackground();

        renderObjectArray.forEach((renderObject, index) => {
          // Skip if no image was loaded
          if (!renderObject.loadedImage) {
            console.warn(`Warning: No image loaded for layer ${renderObject.layer.name} in edition ${abstractedIndexes[0]}`);
            return;
          }
          
          // Get layer options once and store them for reuse
          if (!renderObject.layerOpts) {
            renderObject.layerOpts = getLayerOpts(renderObject.layer, bodyMask, renderObject.loadedImage, renderedLayers);
          }
          
          drawElement(renderObject, index, layers.length);
          
          // Track this layer's position and dimensions for future layer references
          // Use the same jitter values that were calculated in drawElement
          const layerOpts = renderObject.layerOpts;
          const jx = renderObject.jitterX || 0;
          const jy = renderObject.jitterY || 0;
          const scaledWidth = layerOpts.width * layerOpts.scale;
          const scaledHeight = layerOpts.height * layerOpts.scale;
          const finalX = layerOpts.x + jx;
          const finalY = layerOpts.y + jy;
          
          // Calculate bounding box of non-transparent pixels
          // Use layer-specific alpha threshold if configured, otherwise default to 1
          let bounds = null;
          if (renderObject.loadedImage) {
            const layerOptions = renderObject.layer.options || {};
            const alphaThreshold = layerOptions.alphaThreshold !== undefined ? layerOptions.alphaThreshold : 1;
            bounds = getImageBounds(renderObject.loadedImage, alphaThreshold);
          }
          
          renderedLayers[renderObject.layer.name] = {
            x: finalX,
            y: finalY,
            width: scaledWidth,
            height: scaledHeight,
            originalWidth: renderObject.loadedImage ? renderObject.loadedImage.width : scaledWidth,
            originalHeight: renderObject.loadedImage ? renderObject.loadedImage.height : scaledHeight,
            centerX: finalX + scaledWidth / 2,
            centerY: finalY + scaledHeight / 2,
            bottom: finalY + scaledHeight,
            right: finalX + scaledWidth,
            bounds: bounds, // Bounding box of non-transparent pixels
          };
          
          // After drawing Body layer, capture the mask for Prop overlap checking
          if (renderObject.layer.name === "Body") {
            bodyMask = ctx.getImageData(0, 0, format.width, format.height);
          }
          
          if (gif.export) hashlipsGiffer.add();
        });
        
        // Clear rendered layers after each image
        renderedLayers = {};

        if (gif.export) hashlipsGiffer.stop();

        saveImage(abstractedIndexes[0]);
        addMetadata(newDna, abstractedIndexes[0]);
        saveMetaDataSingleFile(abstractedIndexes[0]);
        console.log(
          `Created edition: ${abstractedIndexes[0]}, DNA: ${sha1(newDna)}`
        );
      });

      dnaList.add(filterDNAOptions(newDna));
      editionCount++;
      abstractedIndexes.shift();
    }
    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
};

/* ---------- Exports ---------- */
module.exports = { startCreating, buildSetup, getElements };