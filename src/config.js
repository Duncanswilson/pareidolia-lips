const basePath = process.cwd();
const { MODE } = require(`${basePath}/constants/blend_mode.js`);
const { NETWORK } = require(`${basePath}/constants/network.js`);

const network = NETWORK.eth;

// General metadata for Ethereum
const namePrefix = "Your Collection";
const description = "Remember to replace this description";
const baseUri = "ipfs://NewUriToReplace";

const solanaMetadata = {
  symbol: "YC",
  seller_fee_basis_points: 1000, // Define how much % you want from secondary market sales 1000 = 10%
  external_url: "https://www.youtube.com/c/hashlipsnft",
  creators: [
    {
      address: "7fXNuer5sbZtaTEPhtJ5g5gNtuyRoKkvxdjEjEnPN4mC",
      share: 100,
    },
  ],
};

// If you have selected Solana then the collection starts from 0 automatically
const layerConfigurations = [
  {
    growEditionSizeTo: 40,
     layersOrder: [
      // full background with random rotation and scale
      { 
        name: "Background", 
        options: { 
          x: 0, 
          y: 0, 
          width: 1024, 
          height: 1024,
          randomRotate: false,
          rotateRange: 0.3, // more extreme rotation
          randomScale: false,
          scaleRange: [0.9, 1.3], // can zoom in/out
        } 
      },
    
      // character/body with chaos
      { 
        name: "Body", 
        options: { 
          x: 128, // Center horizontally: (1024 - 768) / 2
          y: 128, // Center vertically: (1024 - 768) / 2
          width: 768, 
          height: 768,
          randomPosition: false,
          positionJitter: 80, // can move around quite a bit
          randomRotate: false,
          rotateRange: 0.4,
          randomScale: false,
          scaleRange: [0.7, 1.4],
          randomOpacity: false,
          opacityRange: [0.7, 1.0],
          randomBlend: false,
        } 
      },
    
      // Eyes positioned in upper portion of face
      { 
        name: "Eyes", 
        options: { 
          x: 320, // Center horizontally relative to Body: 128 + (768/2) - (384/2) = 512 - 192 = 320
          y: 280, // Upper portion of Body: 128 + ~150 (upper third of 768px body)
          width: 384, 
          height: 256,
          randomPosition: false,
          positionJitter: 0,
          randomRotate: false,
          rotateRange: 0,
          randomScale: false,
          scale: 1.0,
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
          blend: "source-over",
        } 
      },
    
      // Mouth positioned in lower portion of face
      { 
        name: "Mouth", 
        options: { 
          x: 312, // Center horizontally to match Eyes: 512 - (400/2) = 312
          y: 550, // Positioned under Eyes (Eyes bottom at ~536, with spacing)
          width: 400, 
          height: 294,
          randomPosition: false,
          positionJitter: 0,
          randomRotate: false,
          rotateRange: 0,
          randomScale: false,
          scale: 1.0,
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
          blend: "source-over",
        } 
      },
    
      // Prop placed at top center like a hat
      {
        name: "Prop",
        options: {
          randomPosition: false,
          x: 384, // Top center: (1024 - 256) / 2 = 384
          y: 0, // Top of canvas
          width: 256,
          height: 256,
          randomRotate: false,
          rotate: 0, // No rotation
          randomScale: false,
          scale: 1.0,
          randomOpacity: false,
          opacity: 1.0, // Full opacity
          randomBlend: false,
          blend: "source-over", // Normal blend mode
          rainbowTint: false,
          tintIntensity: [0.0, 0.0],
          randomShadow: false,
          shadowBlur: 0, // No shadow
          bypassDNA: true,
        },
      },
      {
        name: "Pokerchips",
        options: {
          randomPosition: false,
          x: 0, // Bottom-left corner
          y: 896, // (1024 - 128)
          width: 128,
          height: 128,
          randomRotate: false,
          rotate: 0, // No rotation
          randomScale: false,
          scale: 1.0, // Normal size
          randomOpacity: false,
          opacity: 1.0, // Full opacity
          randomBlend: false,
          blend: "source-over", // Normal blend mode
          rainbowTint: false,
          tintIntensity: [0.0, 0.0],
          randomShadow: false,
          shadowBlur: 0, // No shadow
          bypassDNA: true,
        },
      }
    ]
  },
];

const shuffleLayerConfigurations = false;

const debugLogs = false;

const format = {
  width: 1024,
  height: 1024,
  smoothing: true,
};

const gif = {
  export: false,
  repeat: 0,
  quality: 100,
  delay: 500,
};

const text = {
  only: false,
  color: "#ffffff",
  size: 20,
  xGap: 40,
  yGap: 40,
  align: "left",
  baseline: "top",
  weight: "regular",
  family: "Courier",
  spacer: " => ",
};

const pixelFormat = {
  ratio: 2 / 128,
};

const background = {
  generate: true,
  brightness: "80%",
  static: false,
  default: "#000000",
};

const extraMetadata = {};

const rarityDelimiter = "#";

const uniqueDnaTorrance = 10000;

const preview = {
  thumbPerRow: 5,
  thumbWidth: 50,
  imageRatio: format.height / format.width,
  imageName: "preview.png",
};

const preview_gif = {
  numberOfImages: 5,
  order: "ASC", // ASC, DESC, MIXED
  repeat: 0,
  quality: 100,
  delay: 500,
  imageName: "preview.gif",
};

module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  preview,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  preview_gif,
};
