import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck2,
  FolderPlus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  AcquisitionMilestone,
  InfrastructureProject,
  InfrastructureSector,
  LandParcel,
  RiskTier,
  predictProjectDelay,
} from '../utils/predictionEngine';

interface ProjectManagementViewProps {
  projects: InfrastructureProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (newProject: InfrastructureProject) => void;
  onUpdateProject: (updatedProject: InfrastructureProject) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewProjectModal?: boolean;
  onCloseNewProjectModal?: () => void;
}

const SECTORS: InfrastructureSector[] = [
  'Highway',
  'Railway',
  'Industrial Corridor',
  'Logistics Park',
  'Power Transmission',
];

export const ProjectManagementView: React.FC<ProjectManagementViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onOpenNewProjectModal = false,
  onCloseNewProjectModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [showCreateModal, setShowCreateModal] = useState(onOpenNewProjectModal);

  // Sync external modal trigger from top header button
  React.useEffect(() => {
    if (onOpenNewProjectModal) {
      setShowCreateModal(true);
    }
  }, [onOpenNewProjectModal]);

  const closeModal = () => {
    setShowCreateModal(false);
    if (onCloseNewProjectModal) onCloseNewProjectModal();
  };

  // New project form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState<InfrastructureSector>('Highway');
  const [stateRegion, setStateRegion] = useState('Maharashtra');
  const [district, setDistrict] = useState('Pune Rural');
  const [agency, setAgency] = useState('NHAI');
  const [totalArea, setTotalArea] = useState('240');
  const [acquiredArea, setAcquiredArea] = useState('120');
  const [budgetCrores, setBudgetCrores] = useState('1650');
  const [completionDate, setCompletionDate] = useState('2027-08-31');
  const [ownershipVerifiedPct, setOwnershipVerifiedPct] = useState('62');
  const [compensationDisbursedPct, setCompensationDisbursedPct] = useState('54');
  const [activeDisputes, setActiveDisputes] = useState('9');
  const [pendingClearances, setPendingClearances] = useState('2');
  const [formError, setFormError] = useState('');

  // New parcel form state inside selected project
  const [newParcelSurveyNo, setNewParcelSurveyNo] = useState('');
  const [newParcelVillage, setNewParcelVillage] = useState('');
  const [newParcelArea, setNewParcelArea] = useState('4.5');

  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.stateRegion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.district.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = sectorFilter === 'All' || proj.sector === sectorFilter;
    const matchesRisk = riskFilter === 'All' || proj.prediction.riskTier === riskFilter;
    return matchesSearch && matchesSector && matchesRisk;
  });

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) || filteredProjects[0] || projects[0] || null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setFormError('Project code and project name are required.');
      return;
    }
    const totalHa = Math.max(1, Number(totalArea) || 100);
    const acqHa = Math.min(totalHa, Math.max(0, Number(acquiredArea) || 0));
    const ownPct = Math.min(100, Math.max(0, Number(ownershipVerifiedPct) || 50));
    const compPct = Math.min(100, Math.max(0, Number(compensationDisbursedPct) || 50));
    const dispCount = Math.max(0, Number(activeDisputes) || 0);
    const clearCount = Math.max(0, Number(pendingClearances) || 0);

    const features = {
      totalParcels: Math.max(12, Math.round(totalHa / 3.5)),
      ownershipVerifiedPct: ownPct,
      documentationCompletePct: Math.min(100, ownPct + 6),
      compensationDisbursedPct: compPct,
      activeLegalDisputesCount: dispCount,
      pendingClearancesCount: clearCount,
      overdueMilestonesCount: dispCount > 8 ? 2 : dispCount > 3 ? 1 : 0,
      avgSettlementLagDays: compPct < 60 ? 95 : 42,
      affectedHouseholdsCount: Math.round(totalHa * 1.1),
    };

    const prediction = predictProjectDelay(features);
    const created: InfrastructureProject = {
      id: `proj-${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      sector,
      stateRegion: stateRegion.trim() || 'Maharashtra',
      district: district.trim() || 'Nagpur',
      implementingAgency: agency.trim() || 'NHAI',
      totalAreaHectares: totalHa,
      acquiredAreaHectares: acqHa,
      acquisitionProgressPct: Math.round((acqHa / totalHa) * 100),
      budgetCroresINR: Math.max(10, Number(budgetCrores) || 500),
      startDate: '2026-01-15',
      scheduledCompletionDate: completionDate || '2027-12-31',
      coordinates: {
        lat: 19.2 + Math.random() * 6,
        lng: 73.5 + Math.random() * 5,
      },
      features,
      prediction,
      parcels: [
        {
          parcelId: `PCL-${code.trim().toUpperCase().slice(0, 4)}-101`,
          surveyNumber: 'Sy.No. 101/1A',
          village: district.trim() || 'Central Block',
          areaHectares: 5.2,
          ownershipStatus: ownPct >= 75 ? 'Verified' : 'Pending Mutation',
          titleDocCompleteness: ownPct,
          compensationAssessedINR: 140,
          compensationPaidINR: Math.round(140 * (compPct / 100)),
          compensationStatus: compPct >= 80 ? 'Disbursed' : 'Pending Award',
          hasCourtStayOrder: dispCount > 10,
          soilInspectionStatus: 'Pending Survey',
          lat: 19.65,
          lng: 74.12,
        },
      ],
      milestones: [
        {
          id: `ms-${Date.now()}-1`,
          title: 'Preliminary Notification (RFCTLARR Sec 11)',
          statutorySection: 'Sec 11(1)',
          dueDate: '2026-06-30',
          completedDate: '2026-06-25',
          status: 'Completed',
        },
        {
          id: `ms-${Date.now()}-2`,
          title: 'Joint Measurement Survey & Title Verification',
          statutorySection: 'Sec 12 & 15',
          dueDate: '2026-10-15',
          status: ownPct >= 80 ? 'Completed' : 'Overdue',
        },
        {
          id: `ms-${Date.now()}-3`,
          title: 'CALA Compensation Award & PFMS Disbursement',
          statutorySection: 'Sec 23 & 38',
          dueDate: '2027-01-30',
          status: 'In Progress',
        },
      ],
      lastUpdated: new Date().toISOString().slice(0, 10),
    };

    onCreateProject(created);
    onSelectProject(created.id);
    setCode('');
    setName('');
    setFormError('');
    closeModal();
  };

  const handleToggleMilestoneStatus = (milestoneId: string) => {
    if (!activeProject) return;
    const nextStatusMap: Record<AcquisitionMilestone['status'], AcquisitionMilestone['status']> = {
      Overdue: 'Completed',
      Pending: 'In Progress',
      'In Progress': 'Completed',
      Completed: 'Pending',
    };

    const updatedMilestones = activeProject.milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      const next = nextStatusMap[m.status];
      return {
        ...m,
        status: next,
        completedDate: next === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined,
      };
    });

    const overdueCount = updatedMilestones.filter((m) => m.status === 'Overdue').length;
    const nextFeatures = {
      ...activeProject.features,
      overdueMilestonesCount: overdueCount,
    };

    onUpdateProject({
      ...activeProject,
      milestones: updatedMilestones,
      features: nextFeatures,
      prediction: predictProjectDelay(nextFeatures),
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
  };

  const handleVerifyParcelAndDisburse = (parcelId: string) => {
    if (!activeProject) return;
    const updatedParcels: LandParcel[] = activeProject.parcels.map((pcl) => {
      if (pcl.parcelId !== parcelId) return pcl;
      return {
        ...pcl,
        ownershipStatus: 'Verified',
        titleDocCompleteness: 96,
        compensationPaidINR: pcl.compensationAssessedINR,
        compensationStatus: 'Disbursed',
        hasCourtStayOrder: false,
      };
    });

    const nextOwnPct = Math.min(100, activeProject.features.ownershipVerifiedPct + 8);
    const nextCompPct = Math.min(100, activeProject.features.compensationDisbursedPct + 9);
    const nextDisputes = Math.max(0, activeProject.features.activeLegalDisputesCount - 2);

    const nextFeatures = {
      ...activeProject.features,
      ownershipVerifiedPct: nextOwnPct,
      compensationDisbursedPct: nextCompPct,
      activeLegalDisputesCount: nextDisputes,
    };

    onUpdateProject({
      ...activeProject,
      parcels: updatedParcels,
      features: nextFeatures,
      prediction: predictProjectDelay(nextFeatures),
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
  };

  const handleAddParcel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !newParcelSurveyNo.trim() || !newParcelVillage.trim()) return;
    const area = Math.max(0.5, Number(newParcelArea) || 2.5);
    const newParcel: LandParcel = {
      parcelId: `PCL-${activeProject.code.slice(0, 4)}-${Math.floor(400 + Math.random() * 500)}`,
      surveyNumber: newParcelSurveyNo.trim(),
      village: newParcelVillage.trim(),
      areaHectares: area,
      ownershipStatus: 'Pending Mutation',
      titleDocCompleteness: 65,
      compensationAssessedINR: Math.round(area * 32),
      compensationPaidINR: 0,
      compensationStatus: 'Pending Award',
      hasCourtStayOrder: false,
      soilInspectionStatus: 'Pending Survey',
      lat: activeProject.coordinates.lat + (Math.random() - 0.5) * 0.12,
      lng: activeProject.coordinates.lng + (Math.random() - 0.5) * 0.12,
    };

    const nextFeatures = {
      ...activeProject.features,
      totalParcels: activeProject.features.totalParcels + 1,
    };

    onUpdateProject({
      ...activeProject,
      parcels: [...activeProject.parcels, newParcel],
      features: nextFeatures,
      prediction: predictProjectDelay(nextFeatures),
      lastUpdated: new Date().toISOString().slice(0, 10),
    });

    setNewParcelSurveyNo('');
    setNewParcelVillage('');
  };

  const renderRiskText = (tier: RiskTier, pct: number) => {
    const colorMap: Record<RiskTier, string> = {
      Critical: 'text-red-700 font-semibold',
      High: 'text-amber-700 font-semibold',
      Medium: 'text-blue-700 font-medium',
      Low: 'text-emerald-700 font-medium',
    };
    return (
      <span className={`font-mono text-xs tabular-nums ${colorMap[tier]}`}>
        {tier} ({pct}%)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search, Filter & Primary Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project code, corridor name, state, or district..."
              aria-label="Search infrastructure projects"
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <label htmlFor="sector-filter" className="sr-only">
              Filter by Sector
            </label>
            <select
              id="sector-filter"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="All">All Sectors</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label htmlFor="risk-filter" className="sr-only">
              Filter by Risk Level
            </label>
            <select
              id="risk-filter"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="All">All Risk Tiers</option>
              <option value="Critical">Critical Risk</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
        >
          <FolderPlus className="h-4 w-4" />
          <span>Register New Project</span>
        </button>
      </div>

      {/* Main Searchable Project Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Infrastructure Land Acquisition Registry ({filteredProjects.length} Projects)
            </h2>
            <p className="text-xs text-slate-500">
              Click any project row to inspect its cadastral land parcels, title mutation status, compensation ledger, and statutory milestones
            </p>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No infrastructure projects match the current filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSectorFilter('All');
                setRiskFilter('All');
              }}
              className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 pl-5 pr-3">Code &amp; Corridor Name</th>
                  <th className="px-3 py-3">Sector · State</th>
                  <th className="px-3 py-3 text-right">Acquired / Total (Ha)</th>
                  <th className="px-3 py-3 text-right">Ownership Verified</th>
                  <th className="px-3 py-3 text-right">Compensation Paid</th>
                  <th className="px-3 py-3 text-right">Disputes · NOCs</th>
                  <th className="px-3 py-3 text-right">ML Delay Risk</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProjects.map((proj) => {
                  const isSelected = activeProject?.id === proj.id;
                  return (
                    <tr
                      key={proj.id}
                      onClick={() => onSelectProject(proj.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="font-mono text-xs font-semibold text-[#1E3A8A]">
                          {proj.code}
                        </div>
                        <div className="max-w-xs truncate font-medium text-slate-900">
                          {proj.name}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        <span>{proj.sector}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span>{proj.stateRegion}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-800">
                        {proj.acquiredAreaHectares} / {proj.totalAreaHectares} Ha (
                        {proj.acquisitionProgressPct}%)
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-800">
                        {proj.features.ownershipVerifiedPct}%
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-800">
                        {proj.features.compensationDisbursedPct}%
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-700">
                        <span>{proj.features.activeLegalDisputesCount} cases</span>
                        <span className="mx-1 text-slate-300">·</span>
                        <span>{proj.features.pendingClearancesCount} NOCs</span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {renderRiskText(proj.prediction.riskTier, proj.prediction.delayProbabilityPct)}
                        <div className="font-mono text-[11px] tabular-nums text-slate-500">
                          +{proj.prediction.predictedDelayDays}d est.
                        </div>
                      </td>
                      <td
                        className="py-3.5 pl-3 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectProject(proj.id)}
                            aria-label={`Inspect ${proj.code}`}
                            className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(proj.id)}
                            aria-label={`Delete ${proj.code}`}
                            className="rounded border border-slate-200 bg-white p-1 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Project Detail Workspace: Parcels & Statutory Milestones */}
      {activeProject && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cadastral Land Parcels Ledger */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="font-mono text-xs font-semibold text-[#1E3A8A]">
                  {activeProject.code} · {activeProject.implementingAgency}
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Cadastral Land Parcels &amp; Compensation Ledger
                </h3>
              </div>
              <div className="font-mono text-xs text-slate-600">
                Target Completion: <strong>{activeProject.scheduledCompletionDate}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 pl-3 pr-2">Parcel ID · Survey No</th>
                    <th className="px-2 py-2.5">Village · Area</th>
                    <th className="px-2 py-2.5">Title &amp; Docs</th>
                    <th className="px-2 py-2.5 text-right">Compensation (₹ Lakhs)</th>
                    <th className="py-2.5 pl-2 pr-3 text-right">Record Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeProject.parcels.map((pcl) => (
                    <tr key={pcl.parcelId} className="hover:bg-slate-50">
                      <td className="py-3 pl-3 pr-2">
                        <div className="font-mono font-semibold text-slate-900">
                          {pcl.parcelId}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {pcl.surveyNumber}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-slate-700">
                        <div className="font-medium text-slate-900">{pcl.village}</div>
                        <div className="font-mono text-[11px] tabular-nums text-slate-500">
                          {pcl.areaHectares} Ha · {pcl.soilInspectionStatus}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div
                          className={`font-medium ${
                            pcl.ownershipStatus === 'Verified'
                              ? 'text-emerald-700'
                              : pcl.ownershipStatus === 'Disputed'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {pcl.ownershipStatus}
                          {pcl.hasCourtStayOrder ? ' · Court Stay' : ''}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-slate-500">
                          RoR Docs: {pcl.titleDocCompleteness}%
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right font-mono tabular-nums">
                        <div className="text-slate-900">
                          ₹{pcl.compensationPaidINR}L / ₹{pcl.compensationAssessedINR}L
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {pcl.compensationStatus}
                        </div>
                      </td>
                      <td className="py-3 pl-2 pr-3 text-right">
                        {pcl.ownershipStatus !== 'Verified' ||
                        pcl.compensationStatus !== 'Disbursed' ? (
                          <button
                            type="button"
                            onClick={() => handleVerifyParcelAndDisburse(pcl.parcelId)}
                            className="rounded bg-[#0B1F3A] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1E3A8A] whitespace-nowrap"
                          >
                            Verify &amp; Disburse
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            <span>Cleared</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Add Cadastral Parcel Form */}
            <form
              onSubmit={handleAddParcel}
              className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4"
            >
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[11px] font-medium text-slate-600">
                  Survey / Gat Number
                </label>
                <input
                  type="text"
                  value={newParcelSurveyNo}
                  onChange={(e) => setNewParcelSurveyNo(e.target.value)}
                  placeholder="e.g. Sy.No. 158/2A"
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[11px] font-medium text-slate-600">
                  Revenue Village
                </label>
                <input
                  type="text"
                  value={newParcelVillage}
                  onChange={(e) => setNewParcelVillage(e.target.value)}
                  placeholder="e.g. Kasara North"
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] font-medium text-slate-600">
                  Area (Ha)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={newParcelArea}
                  onChange={(e) => setNewParcelArea(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono text-xs focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 whitespace-nowrap"
              >
                + Add Parcel
              </button>
            </form>
          </div>

          {/* Statutory Acquisition Milestones Tracker */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <div className="font-mono text-xs text-slate-500">
                RFCTLARR Act 2013 &amp; Sectoral Acts
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Statutory Acquisition Milestones ({activeProject.code})
              </h3>
            </div>

            <div className="space-y-3">
              {activeProject.milestones.map((ms) => (
                <div
                  key={ms.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {ms.status === 'Completed' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : ms.status === 'Overdue' ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <span className="font-semibold text-slate-900">{ms.title}</span>
                    </div>
                    <div className="pl-6 text-slate-500">
                      <span className="font-mono">{ms.statutorySection}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span>Due: {ms.dueDate}</span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <strong
                        className={
                          ms.status === 'Overdue'
                            ? 'text-red-700'
                            : ms.status === 'Completed'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {ms.status}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMilestoneStatus(ms.id)}
                    aria-label={`Cycle status for ${ms.title}`}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>
                      {ms.status === 'Completed' ? 'Reopen' : 'Mark Completed'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Registering a New Project */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-register-project-title"
        >
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2
                id="modal-register-project-title"
                className="text-base font-bold text-slate-900"
              >
                Register New Infrastructure Land Acquisition Project
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              {formError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="proj-code" className="block font-semibold text-slate-700">
                    Project Code *
                  </label>
                  <input
                    id="proj-code"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. NH-65-EXP"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono uppercase focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="proj-name" className="block font-semibold text-slate-700">
                    Corridor / Project Title *
                  </label>
                  <input
                    id="proj-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pune–Solapur Six-Lane Greenfield Spur"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="proj-sector" className="block font-semibold text-slate-700">
                    Infrastructure Sector
                  </label>
                  <select
                    id="proj-sector"
                    value={sector}
                    onChange={(e) => setSector(e.target.value as InfrastructureSector)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 focus:border-[#1E3A8A] focus:outline-none"
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="proj-state" className="block font-semibold text-slate-700">
                    State / Region
                  </label>
                  <input
                    id="proj-state"
                    type="text"
                    value={stateRegion}
                    onChange={(e) => setStateRegion(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-district" className="block font-semibold text-slate-700">
                    District
                  </label>
                  <input
                    id="proj-district"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="proj-total-ha" className="block font-semibold text-slate-700">
                    Total Area (Ha)
                  </label>
                  <input
                    id="proj-total-ha"
                    type="number"
                    value={totalArea}
                    onChange={(e) => setTotalArea(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-acq-ha" className="block font-semibold text-slate-700">
                    Acquired Area (Ha)
                  </label>
                  <input
                    id="proj-acq-ha"
                    type="number"
                    value={acquiredArea}
                    onChange={(e) => setAcquiredArea(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-budget" className="block font-semibold text-slate-700">
                    Budget (₹ Cr)
                  </label>
                  <input
                    id="proj-budget"
                    type="number"
                    value={budgetCrores}
                    onChange={(e) => setBudgetCrores(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-deadline" className="block font-semibold text-slate-700">
                    Target Deadline
                  </label>
                  <input
                    id="proj-deadline"
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-100 pt-3">
                <div>
                  <label htmlFor="proj-own-pct" className="block font-semibold text-slate-700">
                    Ownership Verified (%)
                  </label>
                  <input
                    id="proj-own-pct"
                    type="number"
                    min="0"
                    max="100"
                    value={ownershipVerifiedPct}
                    onChange={(e) => setOwnershipVerifiedPct(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-comp-pct" className="block font-semibold text-slate-700">
                    Compensation Paid (%)
                  </label>
                  <input
                    id="proj-comp-pct"
                    type="number"
                    min="0"
                    max="100"
                    value={compensationDisbursedPct}
                    onChange={(e) => setCompensationDisbursedPct(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-disputes" className="block font-semibold text-slate-700">
                    Active Legal Disputes
                  </label>
                  <input
                    id="proj-disputes"
                    type="number"
                    min="0"
                    value={activeDisputes}
                    onChange={(e) => setActiveDisputes(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="proj-nocs" className="block font-semibold text-slate-700">
                    Pending Clearances
                  </label>
                  <input
                    id="proj-nocs"
                    type="number"
                    min="0"
                    value={pendingClearances}
                    onChange={(e) => setPendingClearances(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
                >
                  Save &amp; Run Initial ML Risk Prediction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
