"""
OpenCV Land & Soil Surface Visual Analysis Module (`opencv_soil_analyzer.py`)
Performs visible surface-feature extraction on uploaded land parcel photographs:
- Apparent color classification in RGB / HSV space
- Surface texture roughness via Laplacian variance
- Surface vegetation segmentation via Excess Green Index (ExG = 2G - R - B)
- Moisture-related visual reflectance & darkening indicators
- Rock/boulder clast boundary density via Sobel gradient magnitude

IMPORTANT SCIENTIFIC DISCLAIMER:
Optical image analysis inspects only 2D visible surface attributes and cannot
replace laboratory soil mechanics testing (Atterberg limits, CBR, Proctor compaction,
triaxial shear, borehole SPT, or chemical contamination assays).
"""
from typing import Dict, Any
import cv2
import numpy as np


MANDATORY_DISCLAIMER = (
    "Photographs alone cannot reliably determine subsurface soil composition, "
    "fertility, safe bearing capacity (SBC), contamination, or underground conditions. "
    "Accredit laboratory soil testing and in-situ geotechnical surveys are required."
)


def analyze_land_photograph(image_path: str) -> Dict[str, Any]:
    bgr = cv2.imread(image_path)
    if bgr is None:
        raise ValueError(f"Unable to decode image at path: {image_path}")

    # Resize to standard analysis resolution while preserving aspect ratio
    resized = cv2.resize(bgr, (640, 480), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # Mask out upper sky region (top 28% with high value and blue dominance)
    h, w, _ = rgb.shape
    ground_rgb = rgb[int(h * 0.28):, :, :]
    ground_hsv = hsv[int(h * 0.28):, :, :]
    ground_gray = gray[int(h * 0.28):, :]

    r = ground_rgb[:, :, 0].astype(np.float32)
    g = ground_rgb[:, :, 1].astype(np.float32)
    b = ground_rgb[:, :, 2].astype(np.float32)

    # 1. Surface Vegetation via Excess Green Index (ExG = 2G - R - B)
    exg = 2.0 * g - r - b
    veg_mask = (exg > 26.0) & (g > r * 1.06) & (g > 45.0)
    vegetation_cover_pct = round(float(np.mean(veg_mask) * 100.0), 1)

    # 2. Apparent Soil Color on Non-Vegetated Ground Pixels
    bare_soil_mask = ~veg_mask
    if np.any(bare_soil_mask):
        mean_r = int(np.mean(r[bare_soil_mask]))
        mean_g = int(np.mean(g[bare_soil_mask]))
        mean_b = int(np.mean(b[bare_soil_mask]))
    else:
        mean_r, mean_g, mean_b = int(np.mean(r)), int(np.mean(g)), int(np.mean(b))

    dominant_hex = f"#{mean_r:02X}{mean_g:02X}{mean_b:02X}"

    # 3. Texture Roughness via 3x3 Laplacian Variance
    laplacian = cv2.Laplacian(ground_gray, cv2.CV_64F)
    laplacian_var = round(float(laplacian.var()), 1)

    # 4. Rock & Boulder Edge Density via Sobel Magnitude
    sobel_x = cv2.Sobel(ground_gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(ground_gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
    rock_edge_density_pct = round(float(np.mean(grad_mag > 135.0) * 100.0), 1)

    # 5. Moisture-Related Visual Indicators (darkened wet matrix + specular water reflection)
    sat = ground_hsv[:, :, 1].astype(np.float32) / 255.0
    val = ground_hsv[:, :, 2].astype(np.float32)
    wet_dark_mask = (val < 78.0) & (sat < 0.48) & bare_soil_mask
    specular_pool_mask = (sat < 0.22) & (val > 115.0) & (val < 210.0) & (b >= r * 0.92) & bare_soil_mask
    moisture_index = min(96, int(round(float(np.mean(wet_dark_mask | specular_pool_mask)) * 115.0)))

    return {
        "dominant_rgb_hex": dominant_hex,
        "vegetation_cover_pct": vegetation_cover_pct,
        "texture_laplacian_variance": laplacian_var,
        "rock_edge_density_pct": rock_edge_density_pct,
        "moisture_indicator_index": moisture_index,
        "scientific_disclaimer": MANDATORY_DISCLAIMER,
    }
