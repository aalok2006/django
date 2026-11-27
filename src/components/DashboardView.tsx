import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArrowUpRight, Compass, ExternalLink, LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { InfrastructureProject, RiskTier } from '../utils/predictionEngine';
import { CorridorMap } from './CorridorMap';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export interface GroundingPlaceLink {
  title: string;
  uri: string;
  sourceType: 'maps' | 'web';
  reviewSnippets?: string[];
}

interface DashboardViewProps {
  projects: InfrastructureProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onNavigateTab: (tab: 'dashboard' | 'projects' | 'prediction' | 'soil-cv' | 'alerts') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onNavigateTab,
}) => {
  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || null;

  const [mapsSummary, setMapsSummary] = useState<string>('');
  const [mapsLinks, setMapsLinks] = useState<GroundingPlaceLink[]>([]);
  const [mapsSource, setMapsSource] = useState<string>('gemini-3.8-flash-google-maps');
  const [isLoadingMaps, setIsLoadingMaps] = useState<boolean>(false);
  const [customMapsQuery, setCustomMapsQuery] = useState<string>('');
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const fetchMapsGrounding = async (opts: {
    projectId?: string;
    query?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    setIsLoadingMaps(true);
    try {
      const res = await fetch('/api/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (res.ok) {
        const data = await res.json();
        setMapsSummary(data.summary || '');
        setMapsLinks(Array.isArray(data.groundingLinks) ? data.groundingLinks : []);
        setMapsSource(data.source || 'gemini-3.8-flash-google-maps');
      }
    } catch {
      // Fallback handled cleanly
    } finally {
      setIsLoadingMaps(false);
    }
  };

  useEffect(() => {
    if (!selectedProject) return;
    fetchMapsGrounding({
      projectId: selectedProject.id,
      latitude: selectedProject.coordinates.lat,
      longitude: selectedProject.coordinates.lng,
    });
  }, [selectedProject?.id]);

  const handleUseBrowserGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser geolocation not supported.');
      return;
    }
    setGeoStatus('Acquiring GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeoStatus(`Grounded at ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`);
        fetchMapsGrounding({
          projectId: selectedProject?.id,
          latitude: lat,
          longitude: lng,
          query:
            customMapsQuery.trim() ||
            `Find real-world District Collectorate, Land Acquisition / Revenue offices, highway junctions, and geotechnical testing laboratories near latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}.`,
        });
      },
      () => {
        setGeoStatus('Location permission declined; using selected corridor coordinates.');
      },
      { timeout: 6000 }
    );
  };

  const totalProjects = projects.length;
  const totalAreaHa = projects.reduce((sum, p) => sum + p.totalAreaHectares, 0);
  const acquiredAreaHa = projects.reduce((sum, p) => sum + p.acquiredAreaHectares, 0);
  const overallAcquisitionPct = Math.round((acquiredAreaHa / Math.max(1, totalAreaHa)) * 100);

  const pendingApprovalsTotal = projects.reduce(
    (sum, p) => sum + p.features.pendingClearancesCount,
    0
  );
  const avgCompensationDisbursedPct = Math.round(
    projects.reduce((sum, p) => sum + p.features.compensationDisbursedPct, 0) /
      Math.max(1, totalProjects)
  );
  const compensationIssuesCount = projects.filter(
    (p) => p.features.compensationDisbursedPct < 70
  ).length;
  const totalLegalDisputes = projects.reduce(
    (sum, p) => sum + p.features.activeLegalDisputesCount,
    0
  );
  const highRiskProjectsCount = projects.filter(
    (p) => p.prediction.riskTier === 'High' || p.prediction.riskTier === 'Critical'
  ).length;

  const tierCounts: Record<RiskTier, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  projects.forEach((p) => {
    tierCounts[p.prediction.riskTier]++;
  });

  const riskDoughnutData = {
    labels: ['Critical Risk (≥75%)', 'High Risk (50–74%)', 'Medium Risk (25–49%)', 'Low Risk (<25%)'],
    datasets: [
      {
        data: [tierCounts.Critical, tierCounts.High, tierCounts.Medium, tierCounts.Low],
        backgroundColor: ['#DC2626', '#D97706', '#2563EB', '#16A34A'],
        borderColor: '#FFFFFF',
        borderWidth: 2,
      },
    ],
  };

  const progressChartData = {
    labels: projects.map((p) => p.code),
    datasets: [
      {
        label: 'Land Acquired (%)',
        data: projects.map((p) => p.acquisitionProgressPct),
        backgroundColor: '#1E3A8A',
        borderRadius: 3,
      },
      {
        label: 'Compensation Disbursed (%)',
        data: projects.map((p) => p.features.compensationDisbursedPct),
        backgroundColor: '#0284C7',
        borderRadius: 3,
      },
      {
        label: 'ML Delay Probability (%)',
        data: projects.map((p) => p.prediction.delayProbabilityPct),
        backgroundColor: '#DC2626',
        borderRadius: 3,
      },
    ],
  };

  const bottleneckChartData = {
    labels: projects.map((p) => p.code),
    datasets: [
      {
        label: 'Active Legal Disputes (Cases)',
        data: projects.map((p) => p.features.activeLegalDisputesCount),
        backgroundColor: '#B91C1C',
        borderRadius: 3,
      },
      {
        label: 'Pending Statutory Clearances',
        data: projects.map((p) => p.features.pendingClearancesCount),
        backgroundColor: '#D97706',
        borderRadius: 3,
      },
      {
        label: 'Overdue Acquisition Milestones',
        data: projects.map((p) => p.features.overdueMilestonesCount),
        backgroundColor: '#475569',
        borderRadius: 3,
      },
    ],
  };

  const kpiMetrics = [
    {
      label: 'Monitored Corridors',
      value: String(totalProjects),
      subtext: 'Real-world PMG / MoSPI alignments',
      valueTone: 'text-slate-900',
    },
    {
      label: 'Land Possession',
      value: `${overallAcquisitionPct}%`,
      subtext: `${acquiredAreaHa.toLocaleString()} / ${totalAreaHa.toLocaleString()} Ha`,
      valueTone: 'text-slate-900',
    },
    {
      label: 'Pending Clearances',
      value: String(pendingApprovalsTotal),
      subtext: 'Forest, CRZ, Wildlife & Utility NOCs',
      valueTone: 'text-slate-900',
    },
    {
      label: 'Compensation Backlog',
      value: `${compensationIssuesCount} Corridors`,
      subtext: `Avg ${avgCompensationDisbursedPct}% BhoomiRashi paid`,
      valueTone: 'text-amber-700',
    },
    {
      label: 'Active Legal Disputes',
      value: String(totalLegalDisputes),
      subtext: 'Sec 20F / Sec 64 LARR petitions',
      valueTone: 'text-red-700',
    },
    {
      label: 'High / Critical Risk',
      value: `${highRiskProjectsCount} / ${totalProjects}`,
      subtext: 'ML Delay Probability ≥ 50%',
      valueTone: 'text-red-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Unified Architectural Telemetry Strip */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        aria-label="Portfolio Key Performance Indicators"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <div className="text-xs text-slate-700">
            <strong className="font-semibold text-slate-900">
              National Infrastructure Land Acquisition Monitoring Ledger (DFCCIL · NHSRCL · NHAI · NICDC · YEIDA · PGCIL)
            </strong>
            <span className="mx-2 text-slate-300">·</span>
            <span>
              <span className="font-mono tabular-nums">{totalAreaHa.toLocaleString()}</span> Ha Notified Right-of-Way
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('prediction')}
              className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0"
            >
              <span>Delay Risk Simulator</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => onNavigateTab('soil-cv')}
              className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] hover:underline whitespace-nowrap shrink-0"
            >
              <span>OpenCV Soil Surface Lab</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-y divide-slate-200 sm:grid-cols-3 xl:grid-cols-6 sm:divide-y-0 sm:divide-x">
          {kpiMetrics.map((metric, idx) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, delay: idx * 0.025 }}
              className="p-4"
            >
              <div className="text-xs font-medium text-slate-500">
                {metric.label}
              </div>
              <div
                className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${metric.valueTone}`}
              >
                {metric.value}
              </div>
              <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
                {metric.subtext}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Interactive Chart.js Analytics Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.05 }}
          className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-8"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Possession Progress vs. Compensation Settlement &amp; Delay Probability
              </h2>
              <p className="text-xs text-slate-500">
                Corridor-level comparison of physical land handover against BhoomiRashi award disbursement and predicted delay risk
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500">Chart.js Telemetry</span>
          </div>
          <div className="h-[290px] w-full">
            <Bar
              data={progressChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { boxWidth: 12, font: { family: 'Public Sans', size: 12 } },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: (val) => `${val}%` },
                  },
                },
              }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.08 }}
          className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-4"
        >
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Portfolio Risk Classification
            </h2>
            <p className="text-xs text-slate-500">
              Scikit-Learn RandomForest ensemble tier distribution
            </p>
          </div>
          <div className="mx-auto h-[220px] max-w-[240px]">
            <Doughnut
              data={riskDoughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { family: 'Public Sans', size: 11 } },
                  },
                },
              }}
            />
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {(() => {
              const highest = [...projects].sort(
                (a, b) => b.prediction.delayProbabilityPct - a.prediction.delayProbabilityPct
              )[0];
              return highest ? (
                <div className="flex items-center justify-between">
                  <span>Highest Risk Corridor:</span>
                  <span className="font-mono font-semibold text-red-700">
                    {highest.code} ({highest.prediction.delayProbabilityPct}% · {highest.prediction.riskTier})
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        </motion.div>
      </div>

      {/* Geospatial Map & Bottleneck Breakdown Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.1 }}
          className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Geospatial Corridor &amp; Cadastral Parcel Risk Map
              </h2>
              <p className="text-xs text-slate-500">
                Interactive Leaflet + OpenStreetMap spatial overlay of all {projects.length} active infrastructure projects by WGS84 latitude &amp; longitude
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('projects')}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              Inspect Parcel Registry
            </button>
          </div>
          <CorridorMap
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
            heightClass="h-[320px]"
          />

          {/* Interactive Active Project Coordinate Index */}
          <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Corridor</th>
                  <th className="px-3 py-2">Sector &amp; Region</th>
                  <th className="px-3 py-2 font-mono">Coordinates (Lat, Lng)</th>
                  <th className="px-3 py-2 text-right font-mono">Possession</th>
                  <th className="px-3 py-2 text-right">Delay Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {projects.map((project) => {
                  const isSelected = project.id === selectedProjectId;
                  const riskBadgeStyle =
                    project.prediction.riskTier === 'Critical'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : project.prediction.riskTier === 'High'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : project.prediction.riskTier === 'Medium'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                  return (
                    <tr
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="font-mono font-semibold text-[#1E3A8A]">
                          {project.code}
                        </div>
                        <div className="max-w-[190px] truncate text-[11px] text-slate-600">
                          {project.name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        <div className="font-medium text-slate-800">{project.sector}</div>
                        <div className="text-[11px] text-slate-500">
                          {project.district}, {project.stateRegion}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-slate-700">
                        {project.coordinates.lat.toFixed(4)}° N, {project.coordinates.lng.toFixed(4)}° E
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                        {project.acquisitionProgressPct}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${riskBadgeStyle}`}
                        >
                          {project.prediction.riskTier} · {project.prediction.delayProbabilityPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: 0.12 }}
          className="flex flex-col gap-6 lg:col-span-5"
        >
          {/* Bottleneck Bar Chart Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3">
              <h2 className="text-base font-bold text-slate-900">
                Primary Acquisition Bottlenecks by Corridor
              </h2>
              <p className="text-xs text-slate-500">
                Litigation volume, pending statutory clearances, and overdue RFCTLARR stages
              </p>
            </div>
            <div className="h-[220px] w-full">
              <Bar
                data={bottleneckChartData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 10, font: { family: 'Public Sans', size: 11 } },
                    },
                  },
                }}
              />
            </div>

            <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200 pt-3">
              <div className="pb-2 text-xs font-semibold text-slate-800">
                Immediate Executive Watchlist
              </div>
              {projects
                .filter((p) => p.prediction.riskTier === 'Critical' || p.prediction.riskTier === 'High')
                .slice(0, 2)
                .map((proj) => (
                  <div
                    key={proj.id}
                    className="flex items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        <span className="font-mono text-[#1E3A8A]">{proj.code}</span> — {proj.name}
                      </div>
                      <div className="font-mono text-[11px] tabular-nums text-slate-500">
                        {proj.features.activeLegalDisputesCount} disputes ·{' '}
                        {proj.features.compensationDisbursedPct}% compensation paid · Est. +
                        {proj.prediction.predictedDelayDays}d delay
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(proj.id);
                        onNavigateTab('prediction');
                      }}
                      className="rounded bg-[#0B1F3A] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1E3A8A] whitespace-nowrap shrink-0"
                    >
                      Mitigate
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Live Google Maps Grounding & Real-World Place Verification Card */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-[#1E3A8A]" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Google Maps Grounding · Real-World Corridor &amp; CALA Verifier
                  </h2>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Live place grounding via <span className="font-mono">gemini-3.8-flash</span> (<span className="font-mono">googleMaps</span> tool) at{' '}
                  {selectedProject
                    ? `${selectedProject.coordinates.lat.toFixed(4)}° N, ${selectedProject.coordinates.lng.toFixed(4)}° E`
                    : 'corridor coordinates'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUseBrowserGeolocation}
                  disabled={isLoadingMaps}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  title="Ground query at your current GPS coordinates"
                >
                  <LocateFixed className="h-3 w-3 text-[#1E3A8A]" />
                  <span>My GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    selectedProject &&
                    fetchMapsGrounding({
                      projectId: selectedProject.id,
                      latitude: selectedProject.coordinates.lat,
                      longitude: selectedProject.coordinates.lng,
                      query: customMapsQuery.trim() || undefined,
                    })
                  }
                  disabled={isLoadingMaps}
                  className="inline-flex items-center gap-1 rounded bg-[#0B1F3A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingMaps ? 'animate-spin' : ''}`} />
                  <span>{isLoadingMaps ? 'Grounding...' : 'Verify Places'}</span>
                </button>
              </div>
            </div>

            {/* Custom Grounding Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedProject) return;
                fetchMapsGrounding({
                  projectId: selectedProject.id,
                  latitude: selectedProject.coordinates.lat,
                  longitude: selectedProject.coordinates.lng,
                  query: customMapsQuery.trim() || undefined,
                });
              }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={customMapsQuery}
                onChange={(e) => setCustomMapsQuery(e.target.value)}
                placeholder={`Search places near ${selectedProject?.code || 'corridor'} (e.g., District Collectorate, NHAI PIU, Soil Lab)...`}
                aria-label="Search real-world places via Google Maps Grounding"
                className="flex-1 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:bg-white focus:outline-none"
              />
            </form>

            {geoStatus && (
              <div className="mt-2 font-mono text-[11px] text-[#1E3A8A]">{geoStatus}</div>
            )}

            {/* Grounded Markdown/Text Output */}
            <div className="mt-3 max-h-[155px] overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
              {isLoadingMaps
                ? `Querying Google Maps Grounding for ${selectedProject?.name || 'corridor'}...`
                : mapsSummary}
            </div>

            {/* Extracted groundingChunks.maps.uri & reviewSnippets Links */}
            {mapsLinks.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>Verified Google Maps Grounding Links:</span>
                  <span className="font-mono text-[10px] text-slate-400">{mapsSource}</span>
                </div>
                <div className="space-y-1.5">
                  {mapsLinks.map((link, i) => (
                    <div
                      key={`${link.uri}-${i}`}
                      className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <a
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-[#1E3A8A] hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-red-600" />
                        <span>{link.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                      </a>
                      {link.reviewSnippets && link.reviewSnippets.length > 0 && (
                        <div className="mt-1 border-l-2 border-slate-200 pl-2 text-[11px] italic text-slate-500">
                          {link.reviewSnippets.slice(0, 2).map((snip, idx) => (
                            <div key={idx}>&ldquo;{snip}&rdquo;</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
