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

/* ============================================================================
 * DYNAMIC POSITIONING GUIDE
 * ============================================================================
 * 
 * Hashlips now supports dynamic positioning based on actual asset dimensions
 * and layer relationships. Here are the available options:
 * 
 * 1. USE ACTUAL IMAGE DIMENSIONS:
 *    Set `useActualDimensions: true` to use the image's natural size instead
 *    of the configured width/height. This adapts to each asset automatically.
 * 
 *    Example:
 *    {
 *      name: "head",
 *      options: {
 *        useActualDimensions: true,  // Uses image's actual width/height
 *        x: 100,
 *        y: 100,
 *      }
 *    }
 * 
 * 2. MAINTAIN ASPECT RATIO:
 *    Set `maintainAspectRatio: true` to scale images while preserving their
 *    aspect ratio. The image will fit within the configured width/height.
 * 
 *    Example:
 *    {
 *      name: "head",
 *      options: {
 *        maintainAspectRatio: true,
 *        width: 700,
 *        height: 800,  // Image will scale to fit while keeping aspect ratio
 *      }
 *    }
 * 
 * 3. ANCHOR TO OTHER LAYERS (LAYER REFERENCES):
 *    Position layers relative to other layers using `anchorTo`, `anchorPoint`,
 *    `align`, and `offsetX`/`offsetY`.
 * 
 *    - anchorTo: Name of the layer to anchor to (must be drawn before this layer)
 *    - anchorPoint: Which point on the anchor layer to use
 *      ('center', 'top-left', 'top-right', 'bottom-left', 'bottom-right',
 *       'top', 'bottom', 'left', 'right')
 *      Or use 'bounds-*' variants for bounding box-based positioning:
 *      ('bounds-center', 'bounds-top-left', 'bounds-top-right', etc.)
 *    - align: How this layer aligns to the anchor point (same options as anchorPoint)
 *    - offsetX/offsetY: Additional offset in pixels
 *    - useBounds: true/false - Enable bounding box-based positioning (default: true)
 *      When true, positioning uses actual non-transparent pixel boundaries instead
 *      of image edges. Perfect for assets with different amounts of transparent padding!
 * 
 *    Example - Position nose below head:
 *    {
 *      name: "nose",
 *      options: {
 *        anchorTo: "head",
 *        anchorPoint: "bottom",      // Use bottom of head
 *        align: "top",               // Align top of nose to anchor point
 *        offsetX: 0,                 // Center horizontally
 *        offsetY: 20,                // 20px gap below head
 *        width: 320,
 *        height: 320,
 *      }
 *    }
 * 
 *    Example - Position right eye relative to left eye:
 *    {
 *      name: "right eye",
 *      options: {
 *        anchorTo: "left eye",
 *        anchorPoint: "right",       // Use right edge of left eye
 *        align: "left",              // Align left edge of right eye
 *        offsetX: 20,                // 20px gap between eyes
 *        offsetY: 0,                 // Same vertical level
 *        width: 380,
 *        height: 380,
 *      }
 *    }
 * 
 * 4. COMBINING APPROACHES:
 *    You can combine actual dimensions with anchoring for maximum flexibility:
 * 
 *    {
 *      name: "mouth",
 *      options: {
 *        anchorTo: "nose",
 *        anchorPoint: "bottom",
 *        align: "top",
 *        offsetY: 30,
 *        useActualDimensions: true,  // Use actual image size
 *        maintainAspectRatio: true,  // Scale if needed while keeping aspect
 *      }
 *    }
 * 
 * 5. CONDITIONAL LAYERS (PROBABILITY):
 *    Make a layer appear only some of the time using the `probability` option.
 *    Value should be between 0.0 (never appears) and 1.0 (always appears).
 * 
 *    Example - Layer appears in 1/3 of generations:
 *    {
 *      name: "special_effect",
 *      options: {
 *        probability: 0.333,  // 33.3% chance (1/3)
 *        x: 0,
 *        y: 0,
 *        width: 1024,
 *        height: 1024,
 *      }
 *    }
 * 
 *    Example - Layer appears in 50% of generations:
 *    {
 *      name: "optional_decoration",
 *      options: {
 *        probability: 0.5,  // 50% chance
 *        // ... other options
 *      }
 *    }
 * 
 * ============================================================================
 */

// Layer scrambling configuration
// Set to true to enable layer scrambling (randomizing z-order)
const scrambleLayers = true;
// Array of layer names to scramble. Empty array = scramble all layers (except Background if background.generate is true)
// Example: ["head", "left eye", "right eye"] - only scramble these layers
const scrambleLayerNames = ["left eye", "right eye", "hat", "Mouth", "nose"];
// If true, layers with anchorTo dependencies will maintain their relative order
// If false, all specified layers will be scrambled completely randomly
const respectAnchorDependencies = false;

const layerConfigurations = [
  {
    growEditionSizeTo: 44,
    // Layer scrambling options (can override global defaults)
    scrambleLayers: scrambleLayers, // Override global scrambleLayers setting
    scrambleLayerNames: scrambleLayerNames, // Override global scrambleLayerNames setting
    respectAnchorDependencies: respectAnchorDependencies, // Override global respectAnchorDependencies setting
    layersOrder: [
      // Background layer - full canvas
      { 
        name: "Background", 
        options: { 
          x: 0, 
          y: 0, 
          width: 1000, 
          height: 1000,
          randomRotate: false,
          rotateRange: 0.3,
          randomScale: false,
          scaleRange: [0.9, 1.3],
        } 
      },
    
      // Banner ads layer - positioned behind all face layers
      { 
        name: "banner ads", 
        options: { 
          maintainAspectRatio: true,
          randomRotate: false,
          rotateRange: 0,
          randomScale: false,
          scaleRange: [1.0, 1.0],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // // Head layer 1 - Background layer (largest) - drawn first, appears behind
      // // Positioned with absolute coordinates to create progressive overlap
      // { 
      //   name: "head", 
      //   options: {
      //     displayName: "head3",  // Different name so it doesn't overwrite main "head"
      //     x: 12,  // Adjusted position: centered better for larger size
      //     y: 0,  // Adjusted position: centered better for larger size
      //     width: 1000, 
      //     height: 1100,
      //     maintainAspectRatio: true,  // Preserve aspect ratio to prevent stretching
      //     randomPosition: false,
      //     positionJitter: 25,
      //     randomRotate: false,
      //     rotateRange: 0.1,
      //     randomScale: false,
      //     scaleRange: [0.95, 1.05],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   } 
      // },
    
      // Head layer 2 - Middle layer (medium size) - drawn second, appears in middle
      { 
        name: "head", 
        options: {
          displayName: "head2",  // Different name so it doesn't overwrite main "head"
          maintainAspectRatio: true,  // Preserve aspect ratio to prevent stretching
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Head layer 3 - Foreground layer (smallest) - drawn last, appears on top
      { 
        name: "head",  // Still uses layers/head/ folder
        options: {
          displayName: "head1",
          maintainAspectRatio: true,  // Preserve aspect ratio to prevent stretching
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // // Hair - positioned on top of head (same position as hat)
      // // Mutually exclusive with hat (hair 10%, hat 90%)
      // {
      //   name: "hair",
      //   options: {
      //     probability: 0.1, // 10% chance of appearing (mutually exclusive with hat)
      //     anchorTo: "head1",  // Anchor to the smallest head (foreground layer)
      //     anchorPoint: "bounds-top",  // Use top of smallest head's bounding box
      //     align: "bounds-center",  // Align center of hair's bounding box to center of head
      //     offsetX: 0,  // Centered horizontally
      //     offsetY: 200,  // Push hair down so it sits on the head (positive = down)
      //     width: 1035,  // Scaled up to match larger head
      //     height: 1035,  // Scaled up to match larger head
      //     maintainAspectRatio: true,  // Preserve aspect ratio
      //     useBounds: true,  // Use bounding box for precise positioning
      //     randomPosition: false,
      //     positionJitter: 15,
      //     randomRotate: false,
      //     rotateRange: 0.08,
      //     randomScale: false,
      //     scaleRange: [0.95, 1.05],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   },
      // },
    
      // // Left ear - positioned on the left side of head, vertically centered
      // // Uses bounding box of non-transparent pixels for precise positioning
      // { 
      //   name: "left ear", 
      //   options: { 
      //     anchorTo: "head1",
      //     anchorPoint: "bounds-left",        // Use left edge of head's bounding box
      //     align: "bounds-right",            // Align right edge of ear to attach to head
      //     offsetX: 40,                      // Scoot inward (positive moves right/inward)
      //     offsetY: 0,                       // Vertically centered relative to head's center
      //     useActualDimensions: true,        // Use actual image size - adapts to each asset
      //     useBounds: true,                  // Enable bounding box-based positioning
      //     maxWidth: 520,                    // Max width constraint - bigger ears (scaled up)
      //     maxHeight: 630,                   // Max height constraint - bigger ears (scaled up)
      //     randomPosition: false,
      //     positionJitter: 10,
      //     randomRotate: false,
      //     rotateRange: 0.1,
      //     randomScale: false,
      //     scaleRange: [0.9, 1.1],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   } 
      // },
    
      // // Right ear - positioned on the right side of head, vertically centered
      // // Uses bounding box of non-transparent pixels for precise positioning
      // { 
      //   name: "right ear", 
      //   options: { 
      //     anchorTo: "head1",
      //     anchorPoint: "bounds-right",       // Use right edge of head's bounding box
      //     align: "bounds-left",             // Align left edge of ear to attach to head
      //     offsetX: -40,                     // Scoot inward (negative moves left/inward)
      //     offsetY: 0,                       // Vertically centered relative to head's center
      //     useActualDimensions: true,        // Use actual image size - adapts to each asset
      //     useBounds: true,                  // Enable bounding box-based positioning
      //     maxWidth: 520,                    // Max width constraint - bigger ears (scaled up)
      //     maxHeight: 630,                   // Max height constraint - bigger ears (scaled up)
      //     randomPosition: false,
      //     positionJitter: 10,
      //     randomRotate: false,
      //     rotateRange: 0.1,
      //     randomScale: false,
      //     scaleRange: [0.9, 1.1],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   } 
      // },
    
      // Left eye layer 1 - Background layer (largest)
      // { 
      //   name: "left eye", 
      //   options: { 
      //     anchorTo: "head1",
      //     anchorPoint: "bounds-top",       // Use bounding box top center of head's actual content
      //     align: "bounds-center",         // Align using bounding box center of eye's actual content
      //     offsetX: -125,                  // Offset to the left of center (centered on head1 with right eye)
      //     offsetY: 200,                   // Offset down from top (~1/3 of head height)
      //     useActualDimensions: true,      // Use actual image size - adapts to each asset
      //     useBounds: true,                 // Enable bounding box-based positioning
      //     constrainToBounds: "head",     // Keep within head's bounding box
      //     maxWidth: 950,                  // Max width constraint - largest (scaled up more)
      //     maxHeight: 950,                 // Max height constraint - largest (scaled up more)
      //     randomPosition: false,
      //     positionJitter: 15,
      //     randomRotate: false,
      //     rotateRange: 0.262,
      //     randomScale: false,
      //     scaleRange: [0.9, 1.1],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   } 
      // },
    
      // Left eye layer 2 - Middle layer (medium size)
      { 
        name: "left eye", 
        options: { 
          useActualDimensions: true,      // Use actual image size - adapts to each asset
          randomRotate: false,
          rotateRange: 0.262,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Left eye layer 3 - Foreground layer (smallest)
      { 
        name: "left eye", 
        options: { 
          useActualDimensions: true,      // Use actual image size - adapts to each asset
          randomRotate: false,
          rotateRange: 0.262,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // // Right eye layer 1 - Background layer (largest)
      // { 
      //   name: "right eye", 
      //   options: { 
      //     anchorTo: "left eye",
      //     anchorPoint: "bounds-center",    // Use bounding box center of left eye
      //     align: "bounds-center",         // Align using bounding box center of right eye
      //     offsetX: 280,                    // Absolute 280px horizontal distance between bounding box centers (increased from 250)
      //     offsetY: 0,                      // Same vertical level (centers aligned horizontally)
      //     useActualDimensions: true,      // Use actual image size
      //     useBounds: true,                 // Use bounding box centers for positioning
      //     constrainToBounds: "head",      // Keep within head's bounding box
      //     maxWidth: 750,                  // Max constraints maintain aspect ratio - largest (scaled up)
      //     maxHeight: 750,
      //     randomPosition: false,
      //     positionJitter: 15,
      //     baselineJitter: 50,             // Random vertical baseline offset (±25px, 0-50px range)
      //     randomRotate: false,
      //     rotateRange: 0.262,
      //     randomScale: false,
      //     scaleRange: [0.9, 1.1],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   } 
      // },
    
      // Right eye layer 2 - Middle layer (medium size)
      { 
        name: "right eye", 
        options: { 
          useActualDimensions: true,      // Use actual image size
          randomRotate: false,
          rotateRange: 0.262,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Right eye layer 3 - Foreground layer (smallest)
      { 
        name: "right eye", 
        options: { 
          useActualDimensions: true,      // Use actual image size
          randomRotate: false,
          rotateRange: 0.262,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Hat layer 2 - Middle layer (medium size) - drawn first, appears in middle
      {
        name: "hat",
        options: {
          displayName: "hat2",  // Different name so it doesn't overwrite main "hat"
          // No probability here - hat appears if hair doesn't (handled by mutuallyExclusiveWith logic)
          mutuallyExclusiveWith: "hair", // Special flag: skip if hair was selected, otherwise always show
          // Filename-based size multipliers: maps filename patterns to size multipliers
          filenameSizeMultipliers: {
            // Add your filename patterns here, e.g.:
            // "crownofthorns": 1.2,
            // "orb": 0.9,
          },
          maintainAspectRatio: true,  // Preserve aspect ratio
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        },
      },
    
      // Hat layer 1 - Foreground layer (smallest) - drawn last, appears on top
      {
        name: "hat",  // Still uses layers/hat/ folder
        options: {
          displayName: "hat1",
          maintainAspectRatio: true,  // Preserve aspect ratio
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        },
      },
    
      // Mouth layer 2 - Middle layer (medium size)
      { 
        name: "Mouth", 
        options: { 
          useActualDimensions: true,      // Use actual mouth size
          // Filename-based size multipliers: maps filename patterns to size multipliers
          // filenameSizeMultipliers: {
          //   "glasscrack": 2.333,   // Adjusted to maintain same effective size (3.5 / 1.5)
          //   "hammock": 2.333,        // Adjusted to maintain same effective size (2.5 / 1.5)
          //   "xmaslights": 2.0,     // Adjusted to maintain same effective size 
          //   "napkin": 1.5,
          //   "pepper": 1.75,
          //   "usb": 0.75,
          //   "paper": 1.333,
          //   "label": 1.333,
          //   "tear": 2.333
          // },
          randomRotate: false,
          rotateRange: 0.05,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Mouth layer 1 - Foreground layer (smallest)
      { 
        name: "Mouth", 
        options: { 
          useActualDimensions: true,      // Use actual mouth size
          randomRotate: false,
          rotateRange: 0.05,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Nose layer 2 - Middle layer (medium size)
      { 
        name: "nose", 
        options: { 
          useActualDimensions: true,      // Use actual nose size
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Nose layer 1 - Foreground layer (smallest)
      { 
        name: "nose", 
        options: { 
          useActualDimensions: true,      // Use actual nose size
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },

      // Hoodie - conditional layer
      {
        name: "hoodie",
        options: {
          probability: 0.1, // 33.3% chance of appearing
          useActualDimensions: true, // Use actual image size
          randomRotate: false,
          rotateRange: 0.05,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        },
      },
      // Props - decorative elements, positioned in bottom right corner
      // {
      //   name: "Prop",
      //   options: {
      //     randomPosition: false,
      //     x: 768, // Bottom right: (1024 - 256)
      //     y: 768, // Bottom right: (1024 - 256)
      //     width: 256,
      //     height: 256,
      //     randomRotate: false,
      //     rotateRange: 0.15,
      //     randomScale: false,
      //     scaleRange: [0.8, 1.2],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   },
      // },
    
      // Pokerchips - decorative elements, positioned at corners
      // {
      //   name: "Pokerchips",
      //   options: {
      //     randomPosition: false,
      //     x: 0, // Bottom-left corner
      //     y: 896, // (1024 - 128)
      //     width: 128,
      //     height: 128,
      //     randomRotate: false,
      //     rotateRange: 0.2,
      //     randomScale: false,
      //     scaleRange: [0.9, 1.1],
      //     randomOpacity: false,
      //     opacity: 1.0,
      //     randomBlend: false,
      //   },
      // },
    
      // Filter - effects layer on top of everything
      // {
      //   name: "filter",
      //   options: {
      //     x: 0,
      //     y: 0,
      //     width: 1024,
      //     height: 1024,
      //     randomPosition: false,
      //     positionJitter: 0,
      //     randomRotate: false,
      //     rotateRange: 0,
      //     randomScale: false,
      //     scale: 1.0,
      //     randomOpacity: false,
      //     opacityRange: [0.3, 0.7], // Semi-transparent for effect
      //     randomBlend: true, // Allow blend mode variations for interesting effects
      //   },
      // },
    ]
  },
];

const shuffleLayerConfigurations = false;

const debugLogs = false;

const format = {
  width: 1000,
  height: 1000,
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
  static: true,  // Set to true for consistent background color, false for random colors
  default: "#ffffff",  // White background (change to any hex color you prefer)
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

const applyDifferenceToAllLayers = false;

const applyXorPostProcess = false;
const xorPostProcessOpacity = 0.5; // 0.0 to 1.0 - controls intensity of XOR effect
const xorPostProcessOffset = 10; // Pixel offset for glitch effect (horizontal shift)

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
  scrambleLayers,
  scrambleLayerNames,
  respectAnchorDependencies,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  preview_gif,
  applyDifferenceToAllLayers,
  applyXorPostProcess,
  xorPostProcessOpacity,
  xorPostProcessOffset,
};
