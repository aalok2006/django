import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Code2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import {
  generateProjectsCsv,
  InfrastructureProject,
  SystemAlert,
} from '../utils/predictionEngine';

interface AlertsAndReportsViewProps {
  projects: InfrastructureProject[];
  alerts: SystemAlert[];
  onUpdateAlertStatus: (alertId: string, status: SystemAlert['status']) => void;
  onSelectProjectAndInspect: (projectId: string) => void;
}

const DJANGO_CODE_FILES: { filename: string; description: string; snippet: string }[] = [
  {
    filename: 'backend_django/models.py',
    description: 'Django ORM Models (InfrastructureProject, LandParcel, AcquisitionMilestone, SoilImageInspection)',
    snippet: `from django.db import models
from django.contrib.auth.models import User

class InfrastructureProject(models.Model):
    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=40)
    total_area_hectares = models.DecimalField(max_digits=10, decimal_places=2)
    acquired_area_hectares = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ownership_verified_pct = models.FloatField(default=0.0)
    compensation_disbursed_pct = models.FloatField(default=0.0)
    active_legal_disputes_count = models.PositiveIntegerField(default=0)
    pending_clearances_count = models.PositiveIntegerField(default=0)
    delay_probability = models.FloatField(default=0.0)
    risk_tier = models.CharField(max_length=16, default="Low")
    predicted_delay_days = models.PositiveIntegerField(default=0)`,
  },
  {
    filename: 'backend_django/ml_predictor.py',
    description: 'Scikit-Learn RandomForestClassifier + GradientBoostingRegressor Delay Prediction Pipeline',
    snippet: `from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

class LandAcquisitionDelayPredictor:
    def __init__(self, random_state: int = 42):
        self.clf_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("rf", RandomForestClassifier(n_estimators=180, max_depth=8, class_weight="balanced", random_state=random_state)),
        ])
        self.reg_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("gbr", GradientBoostingRegressor(n_estimators=140, learning_rate=0.06, max_depth=4, random_state=random_state)),
        ])`,
  },
  {
    filename: 'backend_django/opencv_soil_analyzer.py',
    description: 'OpenCV Image Preprocessing, ExG Vegetation Masking, Sobel Rock Gradients & Laplacian Texture',
    snippet: `import cv2
import numpy as np

def analyze_land_photograph(image_path: str) -> dict:
    bgr = cv2.imread(image_path)
    resized = cv2.resize(bgr, (640, 480), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    # Excess Green Index (ExG = 2G - R - B), 3x3 Laplacian variance, and Sobel rock edge density`,
  },
  {
    filename: 'requirements.txt',
    description: 'Python / Django, Scikit-learn, OpenCV, and PostgreSQL dependencies',
    snippet: `Django>=5.0,<5.2
djangorestframework>=3.15.0
scikit-learn>=1.5.0
numpy>=1.26.0
pandas>=2.2.0
opencv-python-headless>=4.10.0.84
Pillow>=10.4.0
psycopg2-binary>=2.9.9`,
  },
];

export const AlertsAndReportsView: React.FC<AlertsAndReportsViewProps> = ({
  projects,
  alerts,
  onUpdateAlertStatus,
  onSelectProjectAndInspect,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [selectedCodeFile, setSelectedCodeFile] = useState(DJANGO_CODE_FILES[0]);

  const filteredAlerts = alerts.filter((a) => {
    const matchCat = categoryFilter === 'All' || a.category === categoryFilter;
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchCat && matchStatus;
  });

  const handleExportCsv = () => {
    const csvContent = generateProjectsCsv(projects);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `land_acquisition_delay_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportSuccessMsg(
      `Exported ${projects.length} infrastructure corridor records with ML delay predictions to CSV.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Export Reports & Alert Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Early Warning Alerts, Audit Reports &amp; CSV Exports
          </h2>
          <p className="text-xs text-slate-500">
            Automated alerts for critical-risk projects, overdue statutory milestones, unresolved court stays, and pending compensation awards
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-md bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Download Full Project CSV Report</span>
          </button>
        </div>
      </div>

      {exportSuccessMsg && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{exportSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessMsg(null)}
            className="underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Alerts List & Filter Controls */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <h3 className="text-base font-bold text-slate-900">
              Active Statutory &amp; Risk Alerts ({filteredAlerts.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <label htmlFor="alert-category-select" className="sr-only">
              Alert Category
            </label>
            <select
              id="alert-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="All">All Alert Categories</option>
              <option value="High-Risk Delay">High-Risk Delay</option>
              <option value="Overdue Milestone">Overdue Milestone</option>
              <option value="Legal Dispute / Stay">Legal Dispute / Stay</option>
              <option value="Pending Compensation">Pending Compensation</option>
            </select>

            <label htmlFor="alert-status-select" className="sr-only">
              Alert Status
            </label>
            <select
              id="alert-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Acknowledged">Acknowledged</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-1 last:pb-1 text-xs"
            >
              <div className="space-y-1 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-slate-500">
                  <AlertOctagon
                    className={`h-4 w-4 shrink-0 ${
                      alert.severity === 'Critical'
                        ? 'text-red-600'
                        : alert.severity === 'High'
                        ? 'text-amber-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <span className="font-mono font-semibold text-slate-900">
                    {alert.id}
                  </span>
                  <span>·</span>
                  <strong
                    className={
                      alert.severity === 'Critical'
                        ? 'text-red-700'
                        : alert.severity === 'High'
                        ? 'text-amber-700'
                        : 'text-blue-700'
                    }
                  >
                    {alert.severity} Severity
                  </strong>
                  <span>·</span>
                  <span>{alert.category}</span>
                  <span>·</span>
                  <span className="font-mono text-[#1E3A8A] font-semibold">
                    {alert.projectCode}
                  </span>
                  <span>·</span>
                  <span>Status: <strong>{alert.status}</strong></span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{alert.title}</h4>
                <p className="text-slate-600 leading-relaxed">{alert.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectProjectAndInspect(alert.projectId)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Inspect Corridor
                </button>
                {alert.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'Acknowledged')}
                    className="rounded border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
                  >
                    Acknowledge
                  </button>
                )}
                {alert.status !== 'Resolved' && (
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'Resolved')}
                    className="rounded bg-[#0B1F3A] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1E3A8A]"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Executive Summary Audit Matrix */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#1E3A8A]" />
            <h3 className="text-base font-bold text-slate-900">
              Consolidated Corridor Risk &amp; Compensation Audit Report
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Ready for Inter-Ministerial PMG Review
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 pl-4 pr-2">Corridor Code</th>
                <th className="px-2 py-2.5">Implementing Agency</th>
                <th className="px-2 py-2.5 text-right">Budget (₹ Cr)</th>
                <th className="px-2 py-2.5 text-right">Possession (%)</th>
                <th className="px-2 py-2.5 text-right">Award Disbursed (%)</th>
                <th className="px-2 py-2.5 text-right">ML Delay Prob.</th>
                <th className="py-2.5 pl-2 pr-4">Top Preventive Action Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pl-4 pr-2 font-mono font-semibold text-[#1E3A8A]">
                    {p.code}
                  </td>
                  <td className="px-2 py-2.5 text-slate-700">{p.implementingAgency}</td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-800">
                    ₹{p.budgetCroresINR.toLocaleString()} Cr
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-800">
                    {p.acquisitionProgressPct}%
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-800">
                    {p.features.compensationDisbursedPct}%
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-semibold tabular-nums">
                    <span
                      className={
                        p.prediction.riskTier === 'Critical'
                          ? 'text-red-700'
                          : p.prediction.riskTier === 'High'
                          ? 'text-amber-700'
                          : 'text-slate-800'
                      }
                    >
                      {p.prediction.delayProbabilityPct}% ({p.prediction.riskTier})
                    </span>
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-slate-600">
                    {p.prediction.preventiveActions[0]?.actionTitle}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Included Python / Django + Scikit-Learn + OpenCV Source Code Inspector */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E3A8A]">
              <Code2 className="h-4 w-4" />
              <span>Included Python / Django + Scikit-Learn + OpenCV Backend Modules</span>
            </div>
            <h3 className="mt-0.5 text-base font-bold text-slate-900">
              Repository Source Deliverables (`backend_django/` &amp; `requirements.txt`)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DJANGO_CODE_FILES.map((file) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setSelectedCodeFile(file)}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  selectedCodeFile.filename === file.filename
                    ? 'bg-[#0B1F3A] text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {file.filename.replace('backend_django/', '')}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <span>
            <strong>{selectedCodeFile.filename}:</strong> {selectedCodeFile.description}
          </span>
        </div>

        <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
          <code>{selectedCodeFile.snippet}</code>
        </pre>
      </div>
    </div>
  );
};
