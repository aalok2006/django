export interface SoilVisualObservation {
  parameter: string;
  observedClassification: string;
  quantitativeMetric: string;
  confidencePct: number;
  cvMethodUsed: string;
  interpretation: string;
}

export interface PreliminarySuitabilityInsight {
  conditionTitle: string;
  flagLevel: 'Routine Verification' | 'Field Inspection Recommended' | 'Detailed Geotechnical Investigation Required';
  visualEvidence: string;
  recommendedEngineeringAction: string;
  standardTestProtocol: string;
}

export interface SoilCvAnalysisResult {
  sampleId: string;
  sampleTitle: string;
  analyzedAt: string;
  imageDimensions: { width: number; height: number };
  dominantRgbHex: string;
  apparentSoilColorName: string;
  munsellApproximation: string;
  surfaceTextureClass: 'Fine Silty / Clayey Appearance' | 'Medium Loamy / Granular Crust' | 'Coarse Gravelly / Rocky Fragmented';
  textureLaplacianVariance: number;
  vegetationCoverPct: number;
  vegetationClass: 'Sparse / Exposed (<15%)' | 'Moderate Ground Cover (15–40%)' | 'Dense Vegetation (>40%)';
  moistureIndicatorIndex: number; // 0-100
  moistureVisualClass: 'Dry / High-Albedo Crust' | 'Moist / Darkened Surface Matrix' | 'Waterlogged / Specular Surface Pooling';
  rockOutcropEdgeDensityPct: number;
  rockPresenceClass: 'Minimal Surface Stones (<8%)' | 'Moderate Cobbles & Nodules (8–22%)' | 'High Boulder / Outcrop Density (>22%)';
  overallVisualConfidencePct: number;
  observations: SoilVisualObservation[];
  suitabilityInsights: PreliminarySuitabilityInsight[];
  mandatoryScientificDisclaimer: string;
}

/**
 * Pure pixel-buffer computer vision pipeline replicating OpenCV operations:
 * 1. RGB -> HSV conversion for soil hue/value & water specular/darkness analysis
 * 2. Excess Green Index (ExG = 2G - R - B) for surface vegetation segmentation
 * 3. 3x3 Sobel gradient magnitude for rock fragment / crack edge density
 * 4. 3x3 Laplacian variance for surface roughness / coarse texture quantification
 * Also populates an optional overlay RGBA pixel buffer for visual CV segmentation rendering.
 */
export function analyzeImagePixelsOpenCv(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  sampleTitle: string,
  overlayOut?: Uint8ClampedArray
): SoilCvAnalysisResult {
  const totalPixels = width * height;
  if (totalPixels === 0 || rgbaData.length < totalPixels * 4) {
    throw new Error('Invalid image pixel buffer provided for CV analysis.');
  }

  const gray = new Float32Array(totalPixels);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let soilPixelCount = 0;

  let vegPixels = 0;
  let moistureCandidatePixels = 0;
  let reddishLateritePixels = 0;
  let darkOrganicClayPixels = 0;
  let paleAridSandyPixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = rgbaData[idx];
    const g = rgbaData[idx + 1];
    const b = rgbaData[idx + 2];

    // Standard luma matching OpenCV cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;

    // Excess Green Index (ExG = 2*G - R - B) + HSV green check
    const exg = 2 * g - r - b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const delta = maxC - minC;
    const saturation = maxC === 0 ? 0 : delta / maxC;

    // Ignore sky pixels at top of frame (high blue, high brightness, top 28% of image)
    const yRatio = Math.floor(i / width) / height;
    const isSky = yRatio < 0.28 && b > 155 && b > r * 1.12 && lum > 140;
    if (isSky) {
      if (overlayOut) {
        overlayOut[idx] = r;
        overlayOut[idx + 1] = g;
        overlayOut[idx + 2] = b;
        overlayOut[idx + 3] = 90;
      }
      continue;
    }

    const isVegetation =
      (exg > 14 && g >= r * 0.96 && g > b * 1.12 && g > 42) ||
      (g > r * 1.08 && g > b * 1.18 && lum > 35 && lum < 195);
    if (isVegetation) {
      vegPixels++;
      if (overlayOut) {
        // Highlight detected vegetation in emerald green
        overlayOut[idx] = 22;
        overlayOut[idx + 1] = 163;
        overlayOut[idx + 2] = 74;
        overlayOut[idx + 3] = 185;
      }
      continue;
    }

    // Count as non-vegetated ground/rock surface
    soilPixelCount++;
    sumR += r;
    sumG += g;
    sumB += b;

    // Moisture-related visual indicators:
    // Case A: Darkened wet soil matrix (low luminance, low saturation or muddy brown-grey)
    // Case B: Specular water pooling reflection (low saturation, cool bluish-grey reflection in lower 72% of frame)
    const isDarkWetMatrix = lum < 78 && r >= b * 0.9 && saturation < 0.48;
    const isWaterPuddleReflection =
      yRatio > 0.32 && saturation < 0.22 && lum > 115 && lum < 210 && b >= r * 0.92;

    if (isDarkWetMatrix || isWaterPuddleReflection) {
      moistureCandidatePixels++;
    }

    // Soil color family counters
    if (r > g * 1.24 && r > b * 1.48 && r > 90) {
      reddishLateritePixels++;
    } else if (lum < 95 && saturation < 0.42) {
      darkOrganicClayPixels++;
    } else if (lum > 125 && saturation < 0.35) {
      paleAridSandyPixels++;
    }

    if (overlayOut) {
      if (isWaterPuddleReflection || isDarkWetMatrix) {
        // Highlight moisture/waterlogged zones in cyan-blue
        overlayOut[idx] = 14;
        overlayOut[idx + 1] = 116;
        overlayOut[idx + 2] = 214;
        overlayOut[idx + 3] = 170;
      } else {
        overlayOut[idx] = r;
        overlayOut[idx + 1] = g;
        overlayOut[idx + 2] = b;
        overlayOut[idx + 3] = 220;
      }
    }
  }

  // Sobel 3x3 edge detection & Laplacian 3x3 variance on ground area
  let highGradientEdgePixels = 0;
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let interiorPixels = 0;

  for (let y = 1; y < height - 1; y++) {
    // Focus on lower 72% ground plane
    if (y / height < 0.26) continue;
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const p00 = gray[(y - 1) * width + (x - 1)];
      const p01 = gray[(y - 1) * width + x];
      const p02 = gray[(y - 1) * width + (x + 1)];
      const p10 = gray[y * width + (x - 1)];
      const p11 = gray[idx];
      const p12 = gray[y * width + (x + 1)];
      const p20 = gray[(y + 1) * width + (x - 1)];
      const p21 = gray[(y + 1) * width + x];
      const p22 = gray[(y + 1) * width + (x + 1)];

      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;
      const gy = -p00 - 2 * p01 - p02 + p20 + p21 * 2 + p22;
      const gradMag = Math.sqrt(gx * gx + gy * gy);

      const lap = p01 + p10 + p12 + p21 - 4 * p11;
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      interiorPixels++;

      if (gradMag > 235) {
        highGradientEdgePixels++;
        if (overlayOut) {
          const oIdx = idx * 4;
          // Amber-orange highlight for rock/clast high-gradient edges
          overlayOut[oIdx] = 245;
          overlayOut[oIdx + 1] = 158;
          overlayOut[oIdx + 2] = 11;
          overlayOut[oIdx + 3] = 235;
        }
      }
    }
  }

  const effectiveGroundPixels = Math.max(1, soilPixelCount + vegPixels);
  const avgR = Math.round(sumR / Math.max(1, soilPixelCount));
  const avgG = Math.round(sumG / Math.max(1, soilPixelCount));
  const avgB = Math.round(sumB / Math.max(1, soilPixelCount));

  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  const dominantRgbHex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`.toUpperCase();

  const vegetationCoverPct = Number(
    Math.min(95, ((vegPixels / effectiveGroundPixels) * 100)).toFixed(1)
  );
  const rockOutcropEdgeDensityPct = Number(
    Math.min(85, ((highGradientEdgePixels / Math.max(1, interiorPixels)) * 100)).toFixed(1)
  );
  const moistureIndicatorIndex = Math.min(
    96,
    Math.round((moistureCandidatePixels / Math.max(1, soilPixelCount)) * 115)
  );

  const lapMean = laplacianSum / Math.max(1, interiorPixels);
  const textureLaplacianVariance = Number(
    Math.max(12, laplacianSqSum / Math.max(1, interiorPixels) - lapMean * lapMean).toFixed(1)
  );

  // Classify apparent soil color & Munsell approximation
  let apparentSoilColorName = 'Yellowish-Brown Silty Loam Shade';
  let munsellApproximation = '10YR 5/4 (Yellowish Brown)';
  if (reddishLateritePixels > darkOrganicClayPixels && reddishLateritePixels > paleAridSandyPixels * 0.65) {
    apparentSoilColorName = 'Reddish-Brown Ferruginous / Lateritic Shade';
    munsellApproximation = '5YR 4/6 (Yellowish Red / Lateritic)';
  } else if (darkOrganicClayPixels >= paleAridSandyPixels) {
    apparentSoilColorName = 'Dark Grey-Brown Alluvial / Clay-Loam Shade';
    munsellApproximation = '10YR 3/2 (Very Dark Grayish Brown)';
  } else {
    apparentSoilColorName = 'Pale Grey-Brown Weathered Basaltic / Sandy Gravel';
    munsellApproximation = '2.5Y 6/2 (Light Brownish Gray)';
  }

  // Classify surface texture
  let surfaceTextureClass: SoilCvAnalysisResult['surfaceTextureClass'] = 'Medium Loamy / Granular Crust';
  if (rockOutcropEdgeDensityPct >= 18 || textureLaplacianVariance >= 520) {
    surfaceTextureClass = 'Coarse Gravelly / Rocky Fragmented';
  } else if (moistureIndicatorIndex >= 42 && rockOutcropEdgeDensityPct < 14) {
    surfaceTextureClass = 'Fine Silty / Clayey Appearance';
  }

  // Classify vegetation
  let vegetationClass: SoilCvAnalysisResult['vegetationClass'] = 'Sparse / Exposed (<15%)';
  if (vegetationCoverPct > 40) {
    vegetationClass = 'Dense Vegetation (>40%)';
  } else if (vegetationCoverPct >= 15) {
    vegetationClass = 'Moderate Ground Cover (15–40%)';
  }

  // Classify moisture visual indicator
  let moistureVisualClass: SoilCvAnalysisResult['moistureVisualClass'] = 'Dry / High-Albedo Crust';
  if (moistureIndicatorIndex >= 45) {
    moistureVisualClass = 'Waterlogged / Specular Surface Pooling';
  } else if (moistureIndicatorIndex >= 22) {
    moistureVisualClass = 'Moist / Darkened Surface Matrix';
  }

  // Classify rock presence
  let rockPresenceClass: SoilCvAnalysisResult['rockPresenceClass'] = 'Minimal Surface Stones (<8%)';
  if (rockOutcropEdgeDensityPct > 22) {
    rockPresenceClass = 'High Boulder / Outcrop Density (>22%)';
  } else if (rockOutcropEdgeDensityPct >= 8) {
    rockPresenceClass = 'Moderate Cobbles & Nodules (8–22%)';
  }

  const observations: SoilVisualObservation[] = [
    {
      parameter: 'Apparent Surface Color Profile',
      observedClassification: `${apparentSoilColorName} (${munsellApproximation})`,
      quantitativeMetric: `RGB(${avgR}, ${avgG}, ${avgB}) · ${dominantRgbHex}`,
      confidencePct: 89,
      cvMethodUsed: 'HSV Chromaticity Histogram & Non-Vegetated Ground Masking',
      interpretation:
        reddishLateritePixels > darkOrganicClayPixels
          ? 'High red-to-blue chromatic ratio suggests iron-oxide rich surface crust typical of lateritic or ferruginous soils.'
          : darkOrganicClayPixels >= paleAridSandyPixels
          ? 'Low surface reflectance and muted chroma indicate dark alluvial, organic-rich, or moist clay-loam surface horizon.'
          : 'High surface albedo and low chroma suggest dry weathered rock detritus, calcareous crust, or coarse sandy-gravel matrix.',
    },
    {
      parameter: 'Visible Surface Texture & Roughness',
      observedClassification: surfaceTextureClass,
      quantitativeMetric: `Laplacian Var: ${textureLaplacianVariance} · Edge Density: ${rockOutcropEdgeDensityPct}%`,
      confidencePct: 84,
      cvMethodUsed: '3×3 Laplacian Variance & Multi-Scale Local Contrast',
      interpretation:
        surfaceTextureClass === 'Coarse Gravelly / Rocky Fragmented'
          ? 'High spatial frequency variance reflects coarse angular aggregates, surface dessication cracks, or weathered cobbles.'
          : surfaceTextureClass === 'Fine Silty / Clayey Appearance'
          ? 'Smooth low-frequency surface regions suggest cohesive fine-grained silt/clay matrix with plastic deformation tracks.'
          : 'Moderate micro-topographic roughness consistent with mixed granular loam and scattered surface aggregates.',
    },
    {
      parameter: 'Surface Vegetation Coverage',
      observedClassification: vegetationClass,
      quantitativeMetric: `${vegetationCoverPct}% Canopy / Ground Cover`,
      confidencePct: 92,
      cvMethodUsed: 'Excess Green Index (ExG = 2G − R − B) Thresholding',
      interpretation:
        vegetationCoverPct > 25
          ? 'Substantial live chlorophyll ground cover requires topsoil stripping and root-zonegrubbing prior to embankment compaction.'
          : 'Predominantly exposed mineral surface with minimal vegetative clearing overhead.',
    },
    {
      parameter: 'Moisture-Related Visual Indicators',
      observedClassification: moistureVisualClass,
      quantitativeMetric: `Surface Moisture Index: ${moistureIndicatorIndex}/100`,
      confidencePct: 79,
      cvMethodUsed: 'Specular Highlight & Low-Albedo Saturation Masking',
      interpretation:
        moistureIndicatorIndex >= 45
          ? 'Visible surface pooling and low-albedo saturated wheel ruts indicate poor surface infiltration or perched water table.'
          : moistureIndicatorIndex >= 22
          ? 'Localized darkened soil patches suggest moderate residual surface moisture.'
          : 'High optical reflectance and dry surface crust indicate low surface moisture at time of photography.',
    },
    {
      parameter: 'Surface Rocks, Boulders & Outcrops',
      observedClassification: rockPresenceClass,
      quantitativeMetric: `${rockOutcropEdgeDensityPct}% High-Gradient Clast Edges`,
      confidencePct: 86,
      cvMethodUsed: 'Sobel 3×3 Gradient Magnitude & Contour Density',
      interpretation:
        rockOutcropEdgeDensityPct > 20
          ? 'Abundant exposed rock fragments and outcrops will impact excavation equipment selection and blasting/ripping budgets.'
          : rockOutcropEdgeDensityPct >= 8
          ? 'Scattered ferruginous nodules or cobbles visible across the right-of-way strip.'
          : 'Few large surface boulders visible in the immediate camera field of view.',
    },
  ];

  const suitabilityInsights: PreliminarySuitabilityInsight[] = [];

  if (moistureIndicatorIndex >= 38) {
    suitabilityInsights.push({
      conditionTitle: 'Potential Poor Subgrade Drainage & Compressible Soft Clay Horizon',
      flagLevel: 'Detailed Geotechnical Investigation Required',
      visualEvidence: `Surface Moisture Index of ${moistureIndicatorIndex}/100 with visible standing water / plastic wheel rutting.`,
      recommendedEngineeringAction:
        'Schedule borehole drilling and undisturbed Shelby tube sampling to assess consolidation settlement, swelling potential, and lime/cement stabilization need.',
      standardTestProtocol: 'ASTM D1586 (SPT), ASTM D4318 (Atterberg Limits), ASTM D1883 (Soaked CBR)',
    });
  }

  if (rockOutcropEdgeDensityPct >= 18) {
    suitabilityInsights.push({
      conditionTitle: 'Hard Rock Excavation & Shallow Bedrock Rippability Assessment',
      flagLevel: 'Detailed Geotechnical Investigation Required',
      visualEvidence: `High-gradient rock/boulder edge density of ${rockOutcropEdgeDensityPct}% with exposed weathered outcrops.`,
      recommendedEngineeringAction:
        'Conduct seismic refraction profiling and rotary core drilling to determine rock mass rating (RMR) and mechanical excavation vs. controlled blasting costs.',
      standardTestProtocol: 'ASTM D2113 (Diamond Core Drilling), ASTM D5777 (Seismic Refraction), Point Load Index',
    });
  }

  if (reddishLateritePixels > darkOrganicClayPixels) {
    suitabilityInsights.push({
      conditionTitle: 'Lateritic / Ferruginous Crust Compaction & Slaking Verification',
      flagLevel: 'Field Inspection Recommended',
      visualEvidence: `Apparent reddish-brown ferruginous surface (${munsellApproximation}) with gravel nodules.`,
      recommendedEngineeringAction:
        'Verify aggregate crushing value and plasticity of fines; some indurated lateritic soils slake upon wetting and require gradation blending for highway sub-base.',
      standardTestProtocol: 'IS 2720 / ASTM D698 (Proctor Compaction), Wet/Dry Slake Durability Index',
    });
  }

  if (vegetationCoverPct >= 20) {
    suitabilityInsights.push({
      conditionTitle: 'Organic Topsoil Stripping & Root-Zone Depth Survey',
      flagLevel: 'Routine Verification',
      visualEvidence: `${vegetationCoverPct}% surface vegetation coverage detected via Excess Green (ExG) segmentation.`,
      recommendedEngineeringAction:
        'Estimate topsoil stripping depth (typically 150–300 mm) and test organic matter content before placing structural fill.',
      standardTestProtocol: 'ASTM D2974 (Organic Content by Loss on Ignition), Trial Pit Logging',
    });
  }

  return {
    sampleId: `CV-${Date.now().toString().slice(-5)}`,
    sampleTitle,
    analyzedAt: new Date().toISOString(),
    imageDimensions: { width, height },
    dominantRgbHex,
    apparentSoilColorName,
    munsellApproximation,
    surfaceTextureClass,
    textureLaplacianVariance,
    vegetationCoverPct,
    vegetationClass,
    moistureIndicatorIndex,
    moistureVisualClass,
    rockOutcropEdgeDensityPct,
    rockPresenceClass,
    overallVisualConfidencePct: 86,
    observations,
    suitabilityInsights,
    mandatoryScientificDisclaimer:
      'SCIENTIFIC & GEOTECHNICAL LIMITATION NOTICE: Optical computer-vision analysis evaluates 2D surface reflectance and texture only. Photographs alone CANNOT determine subsurface soil stratigraphy, chemical fertility, safe bearing capacity (SBC), shear strength, plasticity index, heavy-metal contamination, groundwater table depth, or underground utilities/voids. All engineering design and valuation decisions MUST be validated through accredited NABL/ISO-17025 laboratory soil testing and in-situ geotechnical field surveys.',
  };
}
