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
    options: layerObj.options || {}, // keep all new collage props
  }));
  return layers;
};

/* ---------- Background ---------- */

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  return hslToCanvasColor(hue, 100, background.brightness);
};

const drawBackground = () => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

/* ---------- Metadata ---------- */

const addAttributes = (_element) => {
  let selectedElement = _element.layer.selectedElement;
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
const getImageBounds = (image, alphaThreshold = 10) => {
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
  
  if (loadedImage) {
    // If useActualDimensions is true, use the image's natural size
    if (o.useActualDimensions === true) {
      actualWidth = loadedImage.width;
      actualHeight = loadedImage.height;
      
      // Apply max constraints if specified (maintains aspect ratio)
      if (o.maxWidth && actualWidth > o.maxWidth) {
        const scale = o.maxWidth / actualWidth;
        actualWidth = o.maxWidth;
        actualHeight = actualHeight * scale;
      }
      if (o.maxHeight && actualHeight > o.maxHeight) {
        const scale = o.maxHeight / actualHeight;
        actualHeight = o.maxHeight;
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
  if (o.anchorTo && renderedLayersMap[o.anchorTo]) {
    const anchorLayer = renderedLayersMap[o.anchorTo];
    const anchorPoint = o.anchorPoint || 'center';
    const useBounds = o.useBounds !== false; // Default to true - use bounding box if available
    
    // Determine if we should use bounding box or image bounds
    const useBoundingBox = useBounds && anchorLayer.bounds;
    const bounds = useBoundingBox ? anchorLayer.bounds : null;
    
    let anchorX, anchorY;
    
    // Calculate anchor point - prefer bounding box if available and useBounds is true
    if (useBoundingBox && bounds) {
      // Use bounding box coordinates (relative to image, need to add layer position)
      const scaleX = anchorLayer.width / (anchorLayer.originalWidth || anchorLayer.width);
      const scaleY = anchorLayer.height / (anchorLayer.originalHeight || anchorLayer.height);
      
      switch (anchorPoint) {
        case 'top-left':
        case 'bounds-top-left':
          anchorX = anchorLayer.x + bounds.left * scaleX;
          anchorY = anchorLayer.y + bounds.top * scaleY;
          break;
        case 'top-right':
        case 'bounds-top-right':
          anchorX = anchorLayer.x + bounds.right * scaleX;
          anchorY = anchorLayer.y + bounds.top * scaleY;
          break;
        case 'bottom-left':
        case 'bounds-bottom-left':
          anchorX = anchorLayer.x + bounds.left * scaleX;
          anchorY = anchorLayer.y + bounds.bottom * scaleY;
          break;
        case 'bottom-right':
        case 'bounds-bottom-right':
          anchorX = anchorLayer.x + bounds.right * scaleX;
          anchorY = anchorLayer.y + bounds.bottom * scaleY;
          break;
        case 'top':
        case 'bounds-top':
          anchorX = anchorLayer.x + bounds.centerX * scaleX;
          anchorY = anchorLayer.y + bounds.top * scaleY;
          break;
        case 'bottom':
        case 'bounds-bottom':
          anchorX = anchorLayer.x + bounds.centerX * scaleX;
          anchorY = anchorLayer.y + bounds.bottom * scaleY;
          break;
        case 'left':
        case 'bounds-left':
          anchorX = anchorLayer.x + bounds.left * scaleX;
          anchorY = anchorLayer.y + bounds.centerY * scaleY;
          break;
        case 'right':
        case 'bounds-right':
          anchorX = anchorLayer.x + bounds.right * scaleX;
          anchorY = anchorLayer.y + bounds.centerY * scaleY;
          break;
        case 'center':
        case 'bounds-center':
        default:
          anchorX = anchorLayer.x + bounds.centerX * scaleX;
          anchorY = anchorLayer.y + bounds.centerY * scaleY;
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
    
    // Calculate position relative to anchor
    // offsetX/Y are offsets from the anchor point
    const offsetX = o.offsetX ?? 0;
    const offsetY = o.offsetY ?? 0;
    
    // align determines how this layer aligns to the anchor point
    const align = o.align || 'center';
    const useBoundsForAlign = o.useBounds !== false && loadedImage; // Use bounds for alignment if available
    
    // Get bounding box for current layer if we're using bounds-based alignment
    let currentBounds = null;
    if (useBoundsForAlign && loadedImage) {
      currentBounds = getImageBounds(loadedImage);
    }
    
    // Calculate alignment offset based on whether we're using bounds or image edges
    let alignOffsetX = 0;
    let alignOffsetY = 0;
    
    if (useBoundsForAlign && currentBounds) {
      // Use bounding box for alignment
      const scaleX = actualWidth / loadedImage.width;
      const scaleY = actualHeight / loadedImage.height;
      
      // The alignment offset positions the image so that the specified bounding box point
      // ends up at the anchor point. We calculate the position of the bounding box point
      // relative to the image's top-left corner, then negate it.
      
      switch (align) {
        case 'top-left':
        case 'bounds-top-left':
          alignOffsetX = -currentBounds.left * scaleX;
          alignOffsetY = -currentBounds.top * scaleY;
          break;
        case 'top-right':
        case 'bounds-top-right':
          alignOffsetX = -currentBounds.right * scaleX;
          alignOffsetY = -currentBounds.top * scaleY;
          break;
        case 'bottom-left':
        case 'bounds-bottom-left':
          alignOffsetX = -currentBounds.left * scaleX;
          alignOffsetY = -currentBounds.bottom * scaleY;
          break;
        case 'bottom-right':
        case 'bounds-bottom-right':
          alignOffsetX = -currentBounds.right * scaleX;
          alignOffsetY = -currentBounds.bottom * scaleY;
          break;
        case 'top':
        case 'bounds-top':
          alignOffsetX = -currentBounds.centerX * scaleX;
          alignOffsetY = -currentBounds.top * scaleY;
          break;
        case 'bottom':
        case 'bounds-bottom':
          alignOffsetX = -currentBounds.centerX * scaleX;
          alignOffsetY = -currentBounds.bottom * scaleY;
          break;
        case 'left':
        case 'bounds-left':
          alignOffsetX = -currentBounds.left * scaleX;
          alignOffsetY = -currentBounds.centerY * scaleY;
          break;
        case 'right':
        case 'bounds-right':
          alignOffsetX = -currentBounds.right * scaleX;
          alignOffsetY = -currentBounds.centerY * scaleY;
          break;
        case 'center':
        case 'bounds-center':
        default:
          alignOffsetX = -currentBounds.centerX * scaleX;
          alignOffsetY = -currentBounds.centerY * scaleY;
          break;
      }
    } else {
      // Use image edges for alignment (original behavior)
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
  
  // Constrain to bounds if specified (e.g., keep features within head's bounding box)
  if (o.constrainToBounds && renderedLayersMap[o.constrainToBounds]) {
    const constraintLayer = renderedLayersMap[o.constrainToBounds];
    const useConstraintBounds = constraintLayer.bounds;
    
    if (useConstraintBounds) {
      // Get the constraint layer's bounding box in canvas coordinates
      const scaleX = constraintLayer.width / (constraintLayer.originalWidth || constraintLayer.width);
      const scaleY = constraintLayer.height / (constraintLayer.originalHeight || constraintLayer.height);
      
      const constraintLeft = constraintLayer.x + constraintLayer.bounds.left * scaleX;
      const constraintTop = constraintLayer.y + constraintLayer.bounds.top * scaleY;
      const constraintRight = constraintLayer.x + constraintLayer.bounds.right * scaleX;
      const constraintBottom = constraintLayer.y + constraintLayer.bounds.bottom * scaleY;
      
      // Get current layer's bounding box if available, otherwise use image edges
      let currentBounds = null;
      if (loadedImage) {
        currentBounds = getImageBounds(loadedImage);
      }
      
      let layerLeft, layerTop, layerRight, layerBottom;
      
      if (currentBounds && o.useBounds !== false) {
        // Use bounding box for constraint checking
        const layerScaleX = actualWidth / loadedImage.width;
        const layerScaleY = actualHeight / loadedImage.height;
        layerLeft = x + currentBounds.left * layerScaleX;
        layerTop = y + currentBounds.top * layerScaleY;
        layerRight = x + currentBounds.right * layerScaleX;
        layerBottom = y + currentBounds.bottom * layerScaleY;
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
  const dnaItems = _dna.split(DNA_DELIMITER);
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

const createDna = (_layers) => {
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
  
  _layers.forEach((layer, layerIndex) => {
    if (layer.elements.length === 0) {
      console.warn(`Warning: Layer ${layer.name} has no elements, skipping in DNA creation.`);
      return; // Skip this layer - no DNA part will be added
    }
    
    // Check if layer has a probability setting (conditional layer)
    // If probability is set, randomly skip this layer based on the probability
    const layerOptions = layer.options || {};
    if (layerOptions.probability !== undefined && layerOptions.probability !== null) {
      const probability = Math.max(0, Math.min(1, layerOptions.probability)); // Clamp between 0 and 1
      if (Math.random() > probability) {
        // Skip this layer - it won't appear in this generation
        return;
      }
    }
    
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
    if (layer.name === "head") {
      availableElements = layer.elements.filter(e => !selectedHeadElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All head elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedHeadElementIds.clear(); // Reset for this image
      }
    }
    
    // For left eye layers, filter out already-selected elements (sampling without replacement)
    if (layer.name === "left eye") {
      availableElements = layer.elements.filter(e => !selectedLeftEyeElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All left eye elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedLeftEyeElementIds.clear(); // Reset for this image
      }
    }
    
    // For right eye layers, filter out already-selected elements (sampling without replacement)
    if (layer.name === "right eye") {
      availableElements = layer.elements.filter(e => !selectedRightEyeElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All right eye elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedRightEyeElementIds.clear(); // Reset for this image
      }
    }
    
    // For mouth layers, filter out already-selected elements (sampling without replacement)
    if (layer.name === "Mouth") {
      availableElements = layer.elements.filter(e => !selectedMouthElementIds.has(e.id));
      if (availableElements.length === 0) {
        console.warn(`Warning: All mouth elements have been used. Using all elements as fallback.`);
        availableElements = layer.elements; // Fallback to all elements if all are used
        selectedMouthElementIds.clear(); // Reset for this image
      }
    }
    
    var totalWeight = availableElements.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight === 0) {
      console.warn(`Warning: Layer ${layer.name} has elements with total weight of 0, skipping in DNA creation.`);
      return; // Skip this layer - no DNA part will be added
    }
    let random = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < availableElements.length; i++) {
      random -= availableElements[i].weight;
      if (random < 0) {
        const selectedElement = availableElements[i];
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
        if (layer.name === "head") {
          selectedHeadElementIds.add(selectedElement.id);
        }
        // Track selected left eye element to prevent duplicates across multiple left eye layers
        if (layer.name === "left eye") {
          selectedLeftEyeElementIds.add(selectedElement.id);
        }
        // Track selected right eye element to prevent duplicates across multiple right eye layers
        if (layer.name === "right eye") {
          selectedRightEyeElementIds.add(selectedElement.id);
        }
        // Track selected mouth element to prevent duplicates across multiple mouth layers
        if (layer.name === "Mouth") {
          selectedMouthElementIds.add(selectedElement.id);
        }
        dnaIndex++;
        break;
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const constructLayerToDna = (_dna = "", _layers = []) => {
  // Split and filter out empty parts (handle consecutive delimiters)
  const dnaParts = _dna.split(DNA_DELIMITER)
    .map(part => part.trim())
    .filter(part => part.length > 0);
  let dnaPartIndex = 0;
  
  if (debugLogs) {
    console.log(`Constructing DNA: "${_dna}"`);
    console.log(`DNA parts (${dnaParts.length}):`, dnaParts);
    console.log(`Layers (${_layers.length}):`, _layers.map(l => ({ name: l.name, elementCount: l.elements.length, bypassDNA: l.bypassDNA })));
  }
  
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
    // However, if DNA contains a part for it (from when probability was > 0.0), consume it to maintain alignment
    const layerOptions = layer.options || {};
    if (layerOptions.probability !== undefined && layerOptions.probability !== null) {
      const probability = Math.max(0, Math.min(1, layerOptions.probability)); // Clamp between 0 and 1
      if (probability === 0) {
        // Skip this layer - it won't appear in this generation (same as createDna)
        // But if DNA part exists and matches this layer (from when probability was > 0.0), consume it
        if (dnaPartIndex < dnaParts.length) {
          const dnaPart = dnaParts[dnaPartIndex];
          const elementId = cleanDna(dnaPart);
          // Check if this DNA part belongs to this layer by checking if the element ID exists
          const matchingElement = layer.elements.find((e) => e.id == elementId);
          if (matchingElement) {
            // This DNA part belongs to this layer - consume it to maintain alignment
            dnaPartIndex++;
          }
          // If it doesn't match, the DNA was created with probability 0.0, so don't consume it
        }
        // Skip this layer - it won't appear in this generation
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
    
    // Check if we have a DNA part for this layer
    if (dnaPartIndex >= dnaParts.length) {
      // Count layers that should have DNA parts (exclude probability 0.0 and empty layers)
      const layersWithDnaParts = _layers.filter(l => {
        if (l.elements.length === 0) return false;
        const opts = l.options || {};
        if (opts.probability !== undefined && opts.probability !== null) {
          const prob = Math.max(0, Math.min(1, opts.probability));
          if (prob === 0) return false;
        }
        return true;
      }).length;
      console.warn(`Warning: No DNA part found for layer ${layer.name} at layer index ${layerIndex}. DNA parts: ${dnaParts.length}, Layers that should have DNA parts: ${layersWithDnaParts}`);
      return {
        name: layer.name,
        blend: layer.blend,
        opacity: layer.opacity,
        options: layer.options,
        selectedElement: undefined,
        layer,
      };
    }
    
    const dnaPart = dnaParts[dnaPartIndex];
    
    // Always advance DNA index for layers with elements (DNA parts are created in order)
    dnaPartIndex++;
    
    // Validate DNA part format before parsing
    if (!dnaPart || typeof dnaPart !== 'string' || dnaPart.trim().length === 0) {
      console.warn(`Warning: Empty or invalid DNA part for layer ${layer.name} at index ${dnaPartIndex - 1}. DNA: "${_dna}"`);
      return {
        name: layer.name,
        blend: layer.blend,
        opacity: layer.opacity,
        options: layer.options,
        selectedElement: undefined,
        layer,
      };
    }
    
    const elementId = cleanDna(dnaPart);
    
    if (isNaN(elementId)) {
      console.warn(`Warning: Invalid DNA part format "${dnaPart}" for layer ${layer.name}. Expected format: "id:filename" or "id:filename?bypassDNA=true". Full DNA: "${_dna}"`);
      return {
        name: layer.name,
        blend: layer.blend,
        opacity: layer.opacity,
        options: layer.options,
        selectedElement: undefined,
        layer,
      };
    }
    
    let selectedElement = layer.elements.find((e) => e.id == elementId);
    
    if (!selectedElement) {
      console.warn(`Warning: No element found with ID ${elementId} for layer ${layer.name}. DNA part: "${dnaPart}". Available IDs: ${layer.elements.map(e => e.id).join(', ')}`);
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
    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = createDna(layers);
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
      await Promise.all(loadedElements).then((renderObjectArray) => {
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
          let bounds = null;
          if (renderObject.loadedImage) {
            bounds = getImageBounds(renderObject.loadedImage);
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