import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Layers, Maximize2, Navigation } from 'lucide-react';
import { InfrastructureProject, InfrastructureSector, RiskTier } from '../utils/predictionEngine';

interface CorridorMapProps {
  projects: InfrastructureProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  heightClass?: string;
}

const RISK_COLORS: Record<RiskTier, { fill: string; stroke: string; badgeBg: string; badgeText: string }> = {
  Critical: { fill: '#DC2626', stroke: '#991B1B', badgeBg: 'bg-red-50 border-red-200', badgeText: 'text-red-700' },
  High: { fill: '#D97706', stroke: '#92400E', badgeBg: 'bg-amber-50 border-amber-200', badgeText: 'text-amber-700' },
  Medium: { fill: '#2563EB', stroke: '#1E40AF', badgeBg: 'bg-blue-50 border-blue-200', badgeText: 'text-blue-700' },
  Low: { fill: '#16A34A', stroke: '#166534', badgeBg: 'bg-emerald-50 border-emerald-200', badgeText: 'text-emerald-700' },
};

export const CorridorMap: React.FC<CorridorMapProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  heightClass = 'h-[360px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [riskFilter, setRiskFilter] = useState<RiskTier | 'ALL'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<InfrastructureSector | 'ALL'>('ALL');
  const [showParcelsOverlay, setShowParcelsOverlay] = useState<boolean>(true);
  const [showCodeLabels, setShowCodeLabels] = useState<boolean>(true);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesRisk = riskFilter === 'ALL' || p.prediction.riskTier === riskFilter;
      const matchesSector = sectorFilter === 'ALL' || p.sector === sectorFilter;
      return matchesRisk && matchesSector;
    });
  }, [projects, riskFilter, sectorFilter]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  // Initialize Leaflet map instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [21.1458, 78.0882],
      zoom: 5,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layerGroup;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  const handleFitAllBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredProjects.length === 0) return;

    const latLngs: [number, number][] = filteredProjects.map((p) => [
      p.coordinates.lat,
      p.coordinates.lng,
    ]);
    if (latLngs.length === 1) {
      map.flyTo(latLngs[0], 7, { duration: 0.6 });
    } else {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 7, animate: true });
    }
  };

  // Render active project markers, coordinate popups, and parcel alignment vectors
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    filteredProjects.forEach((project) => {
      const palette = RISK_COLORS[project.prediction.riskTier];
      const isSelected = project.id === selectedProjectId;
      const { lat, lng } = project.coordinates;

      // Outer selection ring for the active corridor
      if (isSelected) {
        L.circleMarker([lat, lng], {
          radius: 17,
          fillColor: palette.fill,
          color: '#0B1F3A',
          weight: 1.5,
          dashArray: '4 3',
          opacity: 0.85,
          fillOpacity: 0.15,
        }).addTo(layerGroup);
      }

      // Primary project coordinate marker
      const marker = L.circleMarker([lat, lng], {
        radius: isSelected ? 11 : 8,
        fillColor: palette.fill,
        color: isSelected ? '#0B1F3A' : palette.stroke,
        weight: isSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.92,
      });

      const popupHtml = `
        <div style="font-family: 'Public Sans', sans-serif; min-width: 235px; line-height: 1.35;">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-family: 'IBM Plex Mono', monospace; color: #475569; margin-bottom: 3px;">
            <span>${project.code} · ${project.sector}</span>
            <span style="color: ${palette.fill}; font-weight: 700;">${project.prediction.riskTier.toUpperCase()}</span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            ${project.name}
          </div>
          <div style="font-size: 11px; font-family: 'IBM Plex Mono', monospace; color: #1E3A8A; background: #F1F5F9; padding: 3px 6px; border-radius: 4px; margin-bottom: 6px;">
            LAT ${lat.toFixed(4)}° N · LNG ${lng.toFixed(4)}° E (${project.district}, ${project.stateRegion})
          </div>
          <div style="font-size: 12px; color: #334155; display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>ML Delay Probability:</span>
            <strong style="color: ${palette.fill}; font-family: 'IBM Plex Mono', monospace;">${project.prediction.delayProbabilityPct}% (+${project.prediction.predictedDelayDays}d)</strong>
          </div>
          <div style="font-size: 12px; color: #334155; display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Land Possession:</span>
            <strong style="font-family: 'IBM Plex Mono', monospace;">${project.acquiredAreaHectares} / ${project.totalAreaHectares} Ha (${project.acquisitionProgressPct}%)</strong>
          </div>
          <div style="font-size: 12px; color: #334155; display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Compensation Paid:</span>
            <strong style="font-family: 'IBM Plex Mono', monospace;">${project.features.compensationDisbursedPct}%</strong>
          </div>
          <div style="font-size: 12px; color: #334155; display: flex; justify-content: space-between;">
            <span>Active Legal Disputes:</span>
            <strong style="font-family: 'IBM Plex Mono', monospace;">${project.features.activeLegalDisputesCount} cases</strong>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      if (showCodeLabels) {
        marker.bindTooltip(
          `<span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600;">${project.code} (${project.prediction.delayProbabilityPct}%)</span>`,
          {
            permanent: isSelected,
            direction: 'top',
            offset: [0, -8],
          }
        );
      }

      marker.on('click', () => {
        onSelectProject(project.id);
      });
      marker.addTo(layerGroup);

      // Render cadastral parcel nodes & alignment polyline when enabled
      if (showParcelsOverlay && project.parcels.length > 0 && (isSelected || filteredProjects.length <= 6)) {
        const corridorPoints: [number, number][] = [
          [lat, lng],
          ...project.parcels.map((parcel): [number, number] => [parcel.lat, parcel.lng]),
        ];

        if (isSelected && corridorPoints.length > 1) {
          L.polyline(corridorPoints, {
            color: palette.fill,
            weight: 2,
            dashArray: '5 4',
            opacity: 0.75,
          }).addTo(layerGroup);
        }

        if (isSelected) {
          project.parcels.forEach((parcel) => {
            const parcelMarker = L.circleMarker([parcel.lat, parcel.lng], {
              radius: 5,
              fillColor: parcel.ownershipStatus === 'Disputed' ? '#DC2626' : '#0284C7',
              color: '#FFFFFF',
              weight: 1.5,
              fillOpacity: 0.95,
            });
            parcelMarker.bindTooltip(
              `Parcel ${parcel.parcelId} (${parcel.surveyNumber}) · ${parcel.ownershipStatus} · ${parcel.areaHectares} Ha [${parcel.lat.toFixed(4)}°N, ${parcel.lng.toFixed(4)}°E]`,
              { direction: 'top' }
            );
            parcelMarker.addTo(layerGroup);
          });
        }
      }
    });
  }, [filteredProjects, selectedProjectId, showParcelsOverlay, showCodeLabels, onSelectProject]);

  // Fly to selected project when selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedProjectId) return;

    const target = projects.find((p) => p.id === selectedProjectId);
    if (target) {
      map.flyTo([target.coordinates.lat, target.coordinates.lng], 6, {
        animate: true,
        duration: 0.65,
      });
    }
  }, [selectedProjectId, projects]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {/* Geospatial Filter & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Risk:</span>
            <select
              aria-label="Filter map projects by risk tier"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskTier | 'ALL')}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="ALL">All Tiers ({projects.length})</option>
              <option value="Critical">Critical Risk</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Sector:</span>
            <select
              aria-label="Filter map projects by infrastructure sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value as InfrastructureSector | 'ALL')}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="ALL">All Sectors</option>
              <option value="Highway">Highway</option>
              <option value="Railway">Railway</option>
              <option value="Industrial Corridor">Industrial Corridor</option>
              <option value="Logistics Park">Logistics Park</option>
              <option value="Power Transmission">Power Transmission</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowParcelsOverlay((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
              showParcelsOverlay
                ? 'border-[#1E3A8A] bg-[#1E3A8A]/10 text-[#1E3A8A]'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Parcels &amp; Vectors</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCodeLabels((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
              showCodeLabels
                ? 'border-[#1E3A8A] bg-[#1E3A8A]/10 text-[#1E3A8A]'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Navigation className="h-3 w-3" />
            <span>Tooltips</span>
          </button>

          <button
            type="button"
            onClick={handleFitAllBounds}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            title="Frame all active project coordinates on map"
          >
            <Maximize2 className="h-3 w-3" />
            <span>Fit All ({filteredProjects.length})</span>
          </button>
        </div>
      </div>

      {/* Leaflet Canvas */}
      <div
        ref={mapContainerRef}
        data-testid="corridor-leaflet-map"
        className={`w-full ${heightClass}`}
        aria-label="Interactive OpenStreetMap infrastructure corridor map"
      />

      {/* Selected Corridor Geodetic Telemetry Bar */}
      {selectedProject && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-900 px-4 py-2 text-xs text-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono font-semibold text-white">{selectedProject.code}</span>
            <span className="text-slate-300">{selectedProject.name}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-[11px] text-sky-300">
              {selectedProject.coordinates.lat.toFixed(4)}° N, {selectedProject.coordinates.lng.toFixed(4)}° E
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
            <span>
              Possession: <strong className="text-white">{selectedProject.acquisitionProgressPct}%</strong>
            </span>
            <span>
              Parcels: <strong className="text-white">{selectedProject.parcels.length}</strong>
            </span>
            <span>
              Risk:{' '}
              <strong className="text-amber-300">
                {selectedProject.prediction.riskTier} ({selectedProject.prediction.delayProbabilityPct}%)
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Legend Bar (Rectangular Bar Swatches - Zero Circular Status Dots) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-800">Corridor Risk Scale:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3.5 bg-red-600" />
            <span>Critical (&ge;75%)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3.5 bg-amber-600" />
            <span>High (50–74%)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3.5 bg-blue-600" />
            <span>Medium (25–49%)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3.5 bg-green-600" />
            <span>Low (&lt;25%)</span>
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          WGS84 Geodetic Overlay · Click marker or row to center coordinates
        </span>
      </div>
    </div>
  );
};
