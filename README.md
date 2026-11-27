# TerraPulse GovTech — Predictive Analytics System for Early Detection of Land Acquisition Delays

A modern government-technology web application for infrastructure authorities (Highways, Railways, Industrial Corridors, Logistics Parks, and Power Transmission) to monitor land acquisition parcels, predict schedule delays using **Scikit-learn** machine learning models, and perform preliminary surface soil & terrain inspection using **OpenCV** computer vision.

## Core Capabilities

1. **Executive Dashboard & Geospatial GIS View**: Real-time KPIs, interactive Chart.js visualizations, and Leaflet + OpenStreetMap corridor viewer.
2. **Project, Parcel & Milestone Management (CRUD)**: Searchable registry of infrastructure projects, cadastral land parcels, and statutory RFCTLARR acquisition milestones.
3. **Scikit-Learn Delay Prediction & What-If Simulator**: Predicts delay probability (`0–99%`), classifies risk tiers (**Low**, **Medium**, **High**, **Critical**), explains feature contributions, and recommends preventive interventions.
4. **OpenCV Land & Soil Surface Visual Analysis**: Extracts apparent color, Laplacian texture roughness, Excess Green ($\text{ExG} = 2G - R - B$) vegetation cover, HSV moisture indicators, and Sobel rock clast edge density with side-by-side segmentation masks.
5. **Preliminary Land Suitability Insights & Scientific Disclaimer**: Recommends laboratory soil testing (`ASTM D1586 SPT`, `ASTM D4318 Atterberg Limits`, `ASTM D1883 Soaked CBR`, `IS 2720`) and field surveys, explicitly noting that optical photographs inspect 2D surface attributes only.
6. **Alerts, Reports & CSV Export**: Threshold-driven alerts, consolidated audit tables, and CSV downloads.

## Setup Instructions

### Interactive Web Runtime
```bash
npm install
npm run dev
```

### Python / Django Backend Reference (`backend_django/`)
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
