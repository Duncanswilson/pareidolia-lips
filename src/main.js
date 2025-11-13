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
  if (fs.existsSync(buildDir)) fs.rmdirSync(buildDir, { recursive: true });
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
  const image = await loadImage(`${_layer.selectedElement.path}`);
  return { layer: _layer, loadedImage: image };
};

/* ---------- Collage-Aware Draw ---------- */

const getLayerOpts = (layer) => {
  const o = layer?.options || {};
  
  // Handle random positioning
  let x = o.x ?? 0;
  let y = o.y ?? 0;
  
  if (o.randomPosition) {
    const width = o.width ?? format.width;
    const height = o.height ?? format.height;
    // Random position anywhere on canvas, allowing props to go partially off-canvas
    x = Math.random() * format.width - width / 2;
    y = Math.random() * format.height - height / 2;
    
    // Apply position jitter if specified
    if (o.positionJitter) {
      x += (Math.random() - 0.5) * o.positionJitter;
      y += (Math.random() - 0.5) * o.positionJitter;
    }
  } else if (o.positionJitter) {
    // Apply jitter to fixed positions
    x += (Math.random() - 0.5) * o.positionJitter;
    y += (Math.random() - 0.5) * o.positionJitter;
  }
  
  // Handle random scaling
  let scale = 1.0;
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
  
  // Handle random blend modes - only use bright/colorful modes
  let blend = o.blend ?? layer.blend ?? "source-over";
  if (o.randomBlend) {
    const blendModes = [
      "source-over",
      "source-over",  // higher chance of normal
      "screen",       // brightens
      "overlay",      // enhances contrast
      "lighten",      // keeps bright areas
      "color-dodge",  // very bright
      "hard-light",   // vibrant
      "soft-light",   // gentle effect
      "difference",   // trippy
      "exclusion",    // colorful inversion
      "hue",          // color shift
      "color",        // colorize
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
    width: o.width ?? format.width,
    height: o.height ?? format.height,
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
  } = getLayerOpts(layer);

  const jx = jitter ? (Math.random() - 0.5) * jitter : 0;
  const jy = jitter ? (Math.random() - 0.5) * jitter : 0;
  const randAngle = randomRotate ? (Math.random() - 0.5) * 2 * rotateRange : 0;
  const angle = rotate + randAngle;

  // Apply scale to dimensions
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

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

const cleanDna = (_str) => Number(removeQueryStrings(_str).split(":").shift());

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
  _layers.forEach((layer) => {
    var totalWeight = layer.elements.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < layer.elements.length; i++) {
      random -= layer.elements[i].weight;
      if (random < 0) {
        randNum.push(
          `${layer.elements[i].id}:${layer.elements[i].filename}${
            layer.bypassDNA ? "?bypassDNA=true" : ""
          }`
        );
        break;
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const constructLayerToDna = (_dna = "", _layers = []) =>
  _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(
      (e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index])
    );
    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      options: layer.options,
      selectedElement,
      layer,
    };
  });

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
      let loadedElements = results.map((layer) => loadLayerImg(layer));
      await Promise.all(loadedElements).then((renderObjectArray) => {
        ctx.clearRect(0, 0, format.width, format.height);
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
          drawElement(renderObject, index, layers.length);
          if (gif.export) hashlipsGiffer.add();
        });

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