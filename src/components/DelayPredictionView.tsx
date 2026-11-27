import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import {
  InfrastructureProject,
  PredictionFeatures,
  predictProjectDelay,
  RiskTier,
} from '../utils/predictionEngine';

interface DelayPredictionViewProps {
  projects: InfrastructureProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onUpdateProject: (updatedProject: InfrastructureProject) => void;
}

export const DelayPredictionView: React.FC<DelayPredictionViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onUpdateProject,
}) => {
  const currentProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  const [simFeatures, setSimFeatures] = useState<PredictionFeatures>(
    currentProject.features
  );
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (currentProject) {
      setSimFeatures(currentProject.features);
      setSavedBanner(null);
    }
  }, [currentProject]);

  const livePrediction = predictProjectDelay(simFeatures);

  const handleFeatureChange = (key: keyof PredictionFeatures, val: number) => {
    setSimFeatures((prev) => ({
      ...prev,
      [key]: val,
    }));
    setSavedBanner(null);
  };

  const handleApplyPreventiveMitigation = () => {
    const mitigated: PredictionFeatures = {
      ...simFeatures,
      ownershipVerifiedPct: Math.min(98, Math.max(88, simFeatures.ownershipVerifiedPct + 35)),
      documentationCompletePct: Math.min(98, Math.max(90, simFeatures.documentationCompletePct + 32)),
      compensationDisbursedPct: Math.min(96, Math.max(86, simFeatures.compensationDisbursedPct + 45)),
      activeLegalDisputesCount: Math.max(1, Math.floor(simFeatures.activeLegalDisputesCount * 0.15)),
      pendingClearancesCount: Math.max(0, simFeatures.pendingClearancesCount - 3),
      overdueMilestonesCount: 0,
      avgSettlementLagDays: Math.min(35, simFeatures.avgSettlementLagDays),
    };
    setSimFeatures(mitigated);
    setSavedBanner(
      'Simulated Preventive Intervention Package applied (Lok Adalat Conciliation + PFMS Escrow Deposit + Joint Cadastral Camp).'
    );
  };

  const handleCommitToProject = () => {
    const updated: InfrastructureProject = {
      ...currentProject,
      features: simFeatures,
      prediction: livePrediction,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    onUpdateProject(updated);
    setSavedBanner(`Updated acquisition parameters & ML prediction committed to backend for ${currentProject.code}.`);
  };

  const tierStyle: Record<RiskTier, { text: string; bg: string; border: string }> = {
    Critical: {
      text: 'text-red-700',
      bg: 'bg-red-50/70',
      border: 'border-red-200',
    },
    High: {
      text: 'text-amber-700',
      bg: 'bg-amber-50/70',
      border: 'border-amber-200',
    },
    Medium: {
      text: 'text-blue-700',
      bg: 'bg-blue-50/70',
      border: 'border-blue-200',
    },
    Low: {
      text: 'text-emerald-700',
      bg: 'bg-emerald-50/70',
      border: 'border-emerald-200',
    },
  };

  const activeStyle = tierStyle[livePrediction.riskTier];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <div className="font-mono text-xs text-[#1E3A8A]">
            {livePrediction.modelSpecification}
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Land Acquisition Delay Prediction &amp; Preventive Simulator
          </h2>
          <p className="text-xs text-slate-500">
            Adjust parcel verification, compensation, litigation, and statutory clearance parameters to evaluate delay probability and risk classification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="predictor-project-select" className="text-xs font-semibold text-slate-700">
            Target Corridor:
          </label>
          <select
            id="predictor-project-select"
            value={currentProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#1E3A8A] focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} ({p.prediction.riskTier})
              </option>
            ))}
          </select>
        </div>
      </div>

      {savedBanner && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{savedBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedBanner(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Model Input Features ({currentProject.code})
              </h3>
              <p className="text-xs text-slate-500">
                Real-time feature vector passed to Scikit-learn ensemble
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSimFeatures(currentProject.features)}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700">
                <label htmlFor="slider-ownership">Ownership &amp; RoR Verified (%)</label>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {simFeatures.ownershipVerifiedPct}%
                </span>
              </div>
              <input
                id="slider-ownership"
                type="range"
                min="10"
                max="100"
                value={simFeatures.ownershipVerifiedPct}
                onChange={(e) =>
                  handleFeatureChange('ownershipVerifiedPct', Number(e.target.value))
                }
                className="mt-1.5 w-full accent-[#1E3A8A]"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700">
                <label htmlFor="slider-docs">Title Documentation Completeness (%)</label>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {simFeatures.documentationCompletePct}%
                </span>
              </div>
              <input
                id="slider-docs"
                type="range"
                min="10"
                max="100"
                value={simFeatures.documentationCompletePct}
                onChange={(e) =>
                  handleFeatureChange('documentationCompletePct', Number(e.target.value))
                }
                className="mt-1.5 w-full accent-[#1E3A8A]"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700">
                <label htmlFor="slider-comp">Compensation Award Disbursed (%)</label>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {simFeatures.compensationDisbursedPct}%
                </span>
              </div>
              <input
                id="slider-comp"
                type="range"
                min="5"
                max="100"
                value={simFeatures.compensationDisbursedPct}
                onChange={(e) =>
                  handleFeatureChange('compensationDisbursedPct', Number(e.target.value))
                }
                className="mt-1.5 w-full accent-[#1E3A8A]"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700">
                <label htmlFor="slider-disputes">Active Legal Disputes &amp; Court Stays</label>
                <span className="font-mono font-bold tabular-nums text-red-700">
                  {simFeatures.activeLegalDisputesCount} cases
                </span>
              </div>
              <input
                id="slider-disputes"
                type="range"
                min="0"
                max="40"
                value={simFeatures.activeLegalDisputesCount}
                onChange={(e) =>
                  handleFeatureChange('activeLegalDisputesCount', Number(e.target.value))
                }
                className="mt-1.5 w-full accent-[#1E3A8A]"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700">
                <label htmlFor="slider-clearances">
                  Pending Statutory Clearances (Forest / Utility / Env)
                </label>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {simFeatures.pendingClearancesCount} NOCs
                </span>
              </div>
              <input
                id="slider-clearances"
                type="range"
                min="0"
                max="8"
                value={simFeatures.pendingClearancesCount}
                onChange={(e) =>
                  handleFeatureChange('pendingClearancesCount', Number(e.target.value))
                }
                className="mt-1.5 w-full accent-[#1E3A8A]"
              />
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700">
                <label htmlFor="slider-overdue">Overdue RFCTLARR Statutory Milestones</label>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {simFeatures.overdueMilestonesCount} stages
                </span>
              </div>
              <input
                id="slider-overdue"
                type="range"
                min="0"
                max="5"
                value={simFeatures.overdueMilestonesCount}
                onChange={(e) =>
                  handleFeatureChange('overdueMilestonesCount', Number(e.target.value))
                }
                className="mt-1.5 w-full accent-[#1E3A8A]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleApplyPreventiveMitigation}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#1E3A8A] bg-blue-50/70 px-4 py-2.5 text-xs font-semibold text-[#1E3A8A] hover:bg-blue-100/80 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Simulate Preventive Intervention Package</span>
            </button>

            <button
              type="button"
              onClick={handleCommitToProject}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B1F3A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1E3A8A] transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Commit Prediction to Backend</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <motion.div
            key={`${livePrediction.riskTier}-${livePrediction.delayProbabilityPct}`}
            initial={{ opacity: 0.85, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.16 }}
            className={`rounded-lg border p-5 ${activeStyle.border} ${activeStyle.bg}`}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-slate-200/80">
              <div className="sm:pr-3">
                <div className="text-xs font-medium text-slate-600">
                  Predicted Delay Probability
                </div>
                <div
                  data-testid="predicted-delay-prob"
                  className={`mt-1 font-mono text-3xl font-bold tabular-nums ${activeStyle.text}`}
                >
                  {livePrediction.delayProbabilityPct}%
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                  p = {livePrediction.delayProbability.toFixed(3)}
                </div>
              </div>

              <div className="sm:px-3">
                <div className="text-xs font-medium text-slate-600">
                  Risk Classification
                </div>
                <div
                  data-testid="predicted-risk-tier"
                  className={`mt-1 font-display text-2xl font-bold ${activeStyle.text}`}
                >
                  {livePrediction.riskTier} Risk
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600">
                  4-Tier Statutory Scale
                </div>
              </div>

              <div className="sm:px-3">
                <div className="text-xs font-medium text-slate-600">
                  Est. Schedule Slippage
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
                  +{livePrediction.predictedDelayDays} Days
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-600">
                  (~{livePrediction.predictedDelayMonths} Months)
                </div>
              </div>

              <div className="sm:pl-3">
                <div className="text-xs font-medium text-slate-600">
                  Ensemble Confidence
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {livePrediction.confidenceScorePct}%
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600">
                  Calibrated Cross-Val
                </div>
              </div>
            </div>
          </motion.div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Major Risk Factor Attribution (Feature Contributions)
              </h3>
              <p className="text-xs text-slate-500">
                Marginal contribution of each land acquisition bottleneck to predicted delay risk
              </p>
            </div>

            <div className="space-y-3.5">
              {livePrediction.majorRiskFactors.map((factor) => {
                const barWidthPct = Math.min(100, Math.max(8, factor.impactScore * 2.8));
                return (
                  <div key={factor.featureKey} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {factor.factorName}{' '}
                        <span className="font-mono font-normal text-slate-500">
                          ({factor.rawValue})
                        </span>
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          factor.direction === 'increases_risk'
                            ? 'text-red-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {factor.direction === 'increases_risk'
                          ? `+${factor.impactScore} pts risk`
                          : 'Mitigating'}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidthPct}%` }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full ${
                          factor.direction === 'increases_risk'
                            ? 'bg-red-600'
                            : 'bg-emerald-600'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">{factor.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Recommended Preventive Interventions &amp; Administrative Actions
              </h3>
              <p className="text-xs text-slate-500">
                Prioritized mitigation steps generated from top active risk drivers
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              {livePrediction.preventiveActions.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 text-xs"
                >
                  <div className="space-y-0.5 max-w-xl">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <strong
                        className={
                          rec.priority === 'Immediate'
                            ? 'text-red-700'
                            : rec.priority === 'High'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }
                      >
                        {rec.priority} Priority
                      </strong>
                      <span>·</span>
                      <span>{rec.category}</span>
                      <span>·</span>
                      <span>{rec.targetDepartment}</span>
                    </div>
                    <div className="font-semibold text-slate-900">{rec.actionTitle}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-emerald-700 tabular-nums">
                      −{rec.expectedDelayReductionDays} Days
                    </div>
                    <div className="text-[10px] text-slate-500">Est. Schedule Recovery</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
