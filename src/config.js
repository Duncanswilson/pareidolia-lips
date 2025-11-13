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
    growEditionSizeTo: 4,
     layersOrder: [
      // full background with random rotation and scale
      { 
        name: "Background", 
        options: { 
          x: 0, 
          y: 0, 
          width: 512, 
          height: 512,
          randomRotate: false,
          rotateRange: 0.3, // more extreme rotation
          randomScale: true,
          scaleRange: [0.9, 1.3], // can zoom in/out
        } 
      },
    
      // character/body with chaos
      { 
        name: "Body", 
        options: { 
          x: 0, 
          y: 0, 
          width: 512, 
          height: 512,
          randomPosition: true,
          positionJitter: 80, // can move around quite a bit
          randomRotate: true,
          rotateRange: 0.4,
          randomScale: true,
          scaleRange: [0.7, 1.4],
          randomOpacity: true,
          opacityRange: [0.7, 1.0],
          randomBlend: true,
        } 
      },
    
      // Multiple props with extreme chaos + rainbow tinting effects
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI, // full 180 degree rotation range
          randomScale: true,
          scaleRange: [0.4, 2.0], // can be tiny or huge
          randomOpacity: true,
          opacityRange: [0.2, 0.8],
          randomBlend: true,
          rainbowTint: true, // Apply rainbow color overlay
          tintIntensity: [0.3, 0.7], // How much color to apply
          randomGlow: true,
          glowRadius: [100, 300],
          bypassDNA: true,
        },
      },
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.4, 2.0],
          randomOpacity: true,
          opacityRange: [0.2, 0.8],
          randomBlend: true,
          rainbowTint: true,
          tintIntensity: [0.4, 0.8],
          randomShadow: true,
          shadowBlur: [100, 300],
          bypassDNA: true,
        },
      },
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.4, 2.0],
          randomOpacity: true,
          opacityRange: [0.2, 0.8],
          randomBlend: true,
          rainbowTint: true,
          tintIntensity: [0.3, 0.6],
          randomGlow: false,
          glowRadius: [120, 350],
          bypassDNA: true,
        },
      },
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.4, 2.0],
          randomOpacity: true,
          opacityRange: [0.4, 0.9],
          randomBlend: true,
          rainbowTint: false,
          tintIntensity: [0.5, 0.9],
          randomShadow: true,
          shadowBlur: [120, 350],
          bypassDNA: true,
        },
      },
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.4, 2.0],
          randomOpacity: true,
          opacityRange: [0.3, 0.8],
          randomBlend: true,
          rainbowTint: false,
          tintIntensity: [0.4, 0.8],
          randomGlow: true,
          glowRadius: [150, 400],
          bypassDNA: true,
        },
      },
      // Add a few more props with even wilder effects
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.3, 1.5],
          randomOpacity: true,
          opacityRange: [0.2, 0.7], // super transparent
          randomBlend: true,
          rainbowTint: false,
          tintIntensity: [0.6, 1.0], // very intense color
          randomGlow: true,
          glowRadius: [180, 450],
          bypassDNA: true,
        },
      },
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.3, 1.5],
          randomOpacity: true,
          opacityRange: [0.2, 0.6],
          randomBlend: true,
          rainbowTint: false,
          tintIntensity: [0.5, 0.9],
          randomShadow: true,
          shadowBlur: [150, 400],
          bypassDNA: true,
        },
      },
      {
        name: "Prop",
        options: {
          randomPosition: true,
          width: 128,
          height: 128,
          randomRotate: true,
          rotateRange: Math.PI,
          randomScale: true,
          scaleRange: [0.3, 1.5],
          randomOpacity: true,
          opacityRange: [0.1, 0.5], // ghost mode
          randomBlend: true,
          rainbowTint: false,
          tintIntensity: [0.7, 1.0], // super vibrant
          randomGlow: true,
          glowRadius: [200, 500],
          randomShadow: true,
          shadowBlur: [180, 450],
          bypassDNA: true,
        },
      }
    ]
  },
];

const shuffleLayerConfigurations = false;

const debugLogs = false;

const format = {
  width: 512,
  height: 512,
  smoothing: false,
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
