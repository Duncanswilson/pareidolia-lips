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

const layerConfigurations = [
  {
    growEditionSizeTo: 33,
     layersOrder: [
      // Background layer - full canvas
      { 
        name: "Background", 
        options: { 
          x: 0, 
          y: 0, 
          width: 1024, 
          height: 1024,
          randomRotate: false,
          rotateRange: 0.3,
          randomScale: false,
          scaleRange: [0.9, 1.3],
        } 
      },
    
      // Head layer 1 - Background layer (largest) - drawn first, appears behind
      // Positioned with absolute coordinates to create progressive overlap
      { 
        name: "head", 
        options: {
          displayName: "head3",  // Different name so it doesn't overwrite main "head"
          x: 12,  // Adjusted position: centered better for larger size
          y: 0,  // Adjusted position: centered better for larger size
          width: 1000, 
          height: 1100,
          maintainAspectRatio: true,  // Preserve aspect ratio to prevent stretching
          randomPosition: false,
          positionJitter: 25,
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Head layer 2 - Middle layer (medium size) - drawn second, appears in middle
      // Positioned with absolute coordinates to create progressive overlap
      { 
        name: "head", 
        options: {
          displayName: "head2",  // Different name so it doesn't overwrite main "head"
          x: 82,  // Adjusted position: centered better for larger size
          y: 50,   // Adjusted position: centered better for larger size
          width: 860, 
          height: 980,
          maintainAspectRatio: true,  // Preserve aspect ratio to prevent stretching
          randomPosition: false,
          positionJitter: 25,
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
      // This is the main reference head that other layers anchor to
      // Must be stored as "head" so other layers can find it
      { 
        name: "head",  // Still uses layers/head/ folder
        options: {
          displayName: "head",  // Store as "head" so other layers can anchor to it
          x: 137,  // Adjusted position: centered better for larger size
          y: 87,  // Adjusted position: centered better for larger size
          width: 750, 
          height: 860,
          maintainAspectRatio: true,  // Preserve aspect ratio to prevent stretching
          randomPosition: false,
          positionJitter: 25,
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Hat - positioned on top of head (drawn before ears and eyes so they appear on top)
      // Anchored to the smallest head
      {
        name: "hat",
        options: {
          anchorTo: "head",  // Anchor to the smallest head
          anchorPoint: "bounds-top",  // Use top of smallest head
          align: "bounds-top",  // Align top of hat to top of smallest head
          offsetX: 0,  // Centered horizontally
          offsetY: -50,  // Position slightly above the head
          width: 1035,  // Scaled up to match larger head
          height: 1035,  // Scaled up to match larger head
          maintainAspectRatio: true,  // Preserve aspect ratio
          useBounds: true,  // Use bounding box for precise positioning
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        },
      },
    
      // Left ear - positioned on the left side of head, vertically centered
      // Uses bounding box of non-transparent pixels for precise positioning
      { 
        name: "left ear", 
        options: { 
          anchorTo: "head",
          anchorPoint: "bounds-left",        // Use left edge of head's bounding box
          align: "bounds-right",            // Align right edge of ear to attach to head
          offsetX: 40,                      // Scoot inward (positive moves right/inward)
          offsetY: 0,                       // Vertically centered relative to head's center
          useActualDimensions: true,        // Use actual image size - adapts to each asset
          useBounds: true,                  // Enable bounding box-based positioning
          maxWidth: 520,                    // Max width constraint - bigger ears (scaled up)
          maxHeight: 630,                   // Max height constraint - bigger ears (scaled up)
          randomPosition: false,
          positionJitter: 10,
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Right ear - positioned on the right side of head, vertically centered
      // Uses bounding box of non-transparent pixels for precise positioning
      { 
        name: "right ear", 
        options: { 
          anchorTo: "head",
          anchorPoint: "bounds-right",       // Use right edge of head's bounding box
          align: "bounds-left",             // Align left edge of ear to attach to head
          offsetX: -40,                     // Scoot inward (negative moves left/inward)
          offsetY: 0,                       // Vertically centered relative to head's center
          useActualDimensions: true,        // Use actual image size - adapts to each asset
          useBounds: true,                  // Enable bounding box-based positioning
          maxWidth: 520,                    // Max width constraint - bigger ears (scaled up)
          maxHeight: 630,                   // Max height constraint - bigger ears (scaled up)
          randomPosition: false,
          positionJitter: 10,
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Left eye layer 1 - Background layer (largest)
      { 
        name: "left eye", 
        options: { 
          anchorTo: "head",
          anchorPoint: "bounds-top",       // Use bounding box top center of head's actual content
          align: "bounds-center",         // Align using bounding box center of eye's actual content
          offsetX: -100,                  // Offset to the left of center (for left eye) - closer together
          offsetY: 200,                   // Offset down from top (~1/3 of head height)
          useActualDimensions: true,      // Use actual image size - adapts to each asset
          useBounds: true,                 // Enable bounding box-based positioning
          constrainToBounds: "head",     // Keep within head's bounding box
          maxWidth: 750,                  // Max width constraint - largest (scaled up)
          maxHeight: 750,                 // Max height constraint - largest (scaled up)
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Left eye layer 2 - Middle layer (medium size)
      { 
        name: "left eye", 
        options: { 
          anchorTo: "head",
          anchorPoint: "bounds-top",       // Use bounding box top center of head's actual content
          align: "bounds-center",         // Align using bounding box center of eye's actual content
          offsetX: -100,                  // Offset to the left of center (for left eye) - closer together
          offsetY: 200,                   // Offset down from top (~1/3 of head height)
          useActualDimensions: true,      // Use actual image size - adapts to each asset
          useBounds: true,                 // Enable bounding box-based positioning
          constrainToBounds: "head",     // Keep within head's bounding box
          maxWidth: 630,                  // Max width constraint - medium (scaled up)
          maxHeight: 630,                 // Max height constraint - medium (scaled up)
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
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
          anchorTo: "head",
          anchorPoint: "bounds-top",       // Use bounding box top center of head's actual content
          align: "bounds-center",         // Align using bounding box center of eye's actual content
          offsetX: -100,                  // Offset to the left of center (for left eye) - closer together
          offsetY: 200,                   // Offset down from top (~1/3 of head height)
          useActualDimensions: true,      // Use actual image size - adapts to each asset
          useBounds: true,                 // Enable bounding box-based positioning
          constrainToBounds: "head",     // Keep within head's bounding box
          maxWidth: 520,                  // Max width constraint - smallest (scaled up)
          maxHeight: 520,                 // Max height constraint - smallest (scaled up)
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Right eye layer 1 - Background layer (largest)
      { 
        name: "right eye", 
        options: { 
          anchorTo: "left eye",
          anchorPoint: "bounds-center",    // Use bounding box center of left eye
          align: "bounds-center",         // Align using bounding box center of right eye
          offsetX: 200,                    // Absolute 200px horizontal distance between bounding box centers - closer together
          offsetY: 0,                      // Same vertical level (centers aligned horizontally)
          useActualDimensions: true,      // Use actual image size
          useBounds: true,                 // Use bounding box centers for positioning
          constrainToBounds: "head",      // Keep within head's bounding box
          maxWidth: 750,                  // Max constraints maintain aspect ratio - largest (scaled up)
          maxHeight: 750,
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Right eye layer 2 - Middle layer (medium size)
      { 
        name: "right eye", 
        options: { 
          anchorTo: "left eye",
          anchorPoint: "bounds-center",    // Use bounding box center of left eye
          align: "bounds-center",         // Align using bounding box center of right eye
          offsetX: 200,                    // Absolute 200px horizontal distance between bounding box centers - closer together
          offsetY: 0,                      // Same vertical level (centers aligned horizontally)
          useActualDimensions: true,      // Use actual image size
          useBounds: true,                 // Use bounding box centers for positioning
          constrainToBounds: "head",      // Keep within head's bounding box
          maxWidth: 630,                  // Max constraints maintain aspect ratio - medium (scaled up)
          maxHeight: 630,
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
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
          anchorTo: "left eye",
          anchorPoint: "bounds-center",    // Use bounding box center of left eye
          align: "bounds-center",         // Align using bounding box center of right eye
          offsetX: 200,                    // Absolute 200px horizontal distance between bounding box centers - closer together
          offsetY: 0,                      // Same vertical level (centers aligned horizontally)
          useActualDimensions: true,      // Use actual image size
          useBounds: true,                 // Use bounding box centers for positioning
          constrainToBounds: "head",      // Keep within head's bounding box
          maxWidth: 520,                  // Max constraints maintain aspect ratio - smallest (scaled up)
          maxHeight: 520,
          randomPosition: false,
          positionJitter: 15,
          randomRotate: false,
          rotateRange: 0.08,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Hoodie - conditional layer, positioned around the smallest head layer
      {
        name: "hoodie",
        options: {
          probability: 0.1, // 10% chance of appearing
          anchorTo: "head", // Anchor to the smallest head layer (last one drawn with name "head")
          anchorPoint: "bounds-center", // Use center of head's bounding box
          align: "bounds-center", // Align center of hoodie to head center
          offsetX: 0, // Centered horizontally
          offsetY: 0, // Centered vertically
          useActualDimensions: true, // Use actual image size
          useBounds: true, // Use bounding box for precise positioning
          maxWidth: 600, // Max width constraint - limit size relative to smallest head (550px)
          maxHeight: 700, // Max height constraint - limit size relative to smallest head (650px)
          randomPosition: false,
          positionJitter: 10,
          randomRotate: false,
          rotateRange: 0.05,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        },
      },
    
      // Mouth - positioned centered below eyes (drawn first, behind nose)
      // Constrained to stay within head's bounding box
      { 
        name: "Mouth", 
        options: { 
          anchorTo: "left eye",
          anchorPoint: "bounds-bottom",   // Use bottom edge of left eye's bounding box
          align: "bounds-top",            // Align top of mouth's bounding box
          offsetX: 100,                   // Center horizontally: right eye is 200px right, so center is 100px
          offsetY: 200,                   // Position below eyes (nose will be between eyes and mouth)
          useActualDimensions: true,      // Use actual mouth size
          useBounds: true,                // Use bounds for precise positioning relative to actual content
          constrainToBounds: "head",      // Keep within head's bounding box
          maxWidth: 460,                  // Max constraints maintain aspect ratio (scaled up)
          maxHeight: 345,
          // Filename-based size multipliers: maps filename patterns to size multipliers
          // Example: "lips.png" will be 1.5x bigger, "clip.png" will be 1.2x bigger
          filenameSizeMultipliers: {
            // Add your filename patterns here, e.g.:
            "glasscrack": 3.5,   // Makes glasscrack.png large enough to touch sides (400*3.5 = 1400px max width)
            // "clip": 1.2,        // Makes clip.png 1.2x bigger
            // "garage": 0.8,      // Makes garage.png 0.8x smaller
          },
          // Filename-based constraint disabling: disables constrainToBounds for specific filenames
          // Useful for large elements that should extend beyond normal bounds
          filenameDisableConstraints: {
            "glasscrack": true,  // Disable head bounds constraint for glasscrack.png
          },
          randomPosition: false,
          positionJitter: 12,
          randomRotate: false,
          rotateRange: 0.05,
          randomScale: false,
          scaleRange: [0.95, 1.05],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
      },
    
      // Nose - positioned centered between eyes and mouth (drawn after mouth, in foreground)
      // Constrained to stay within head's bounding box
      { 
        name: "nose", 
        options: { 
          anchorTo: "left eye",
          anchorPoint: "bounds-bottom",   // Use bottom edge of left eye's bounding box
          align: "bounds-top",            // Align top of nose's bounding box
          offsetX: 100,                   // Center horizontally: right eye is 200px right, so center is 100px
          offsetY: 50,                    // Absolute 50px gap below eye bottom (edge to edge)
          useActualDimensions: true,      // Use actual nose size
          useBounds: true,                // Use bounds for precise positioning relative to actual content
          constrainToBounds: "head",      // Keep within head's bounding box
          maxWidth: 630,                  // Max constraints maintain aspect ratio (scaled up)
          maxHeight: 630,
          randomPosition: false,
          positionJitter: 12,
          randomRotate: false,
          rotateRange: 0.1,
          randomScale: false,
          scaleRange: [0.9, 1.1],
          randomOpacity: false,
          opacity: 1.0,
          randomBlend: false,
        } 
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
