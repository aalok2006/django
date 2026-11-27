import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderPlus,
  Lock,
  LogOut,
  MessageSquare,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';
import {
  InfrastructureProject,
  SystemAlert,
} from './utils/predictionEngine';
import { INITIAL_ALERTS, INITIAL_PROJECTS } from './data/seedProjects';
import { DashboardView } from './components/DashboardView';
import { ProjectManagementView } from './components/ProjectManagementView';
import { DelayPredictionView } from './components/DelayPredictionView';
import { SoilAnalysisView } from './components/SoilAnalysisView';
import { AlertsAndReportsView } from './components/AlertsAndReportsView';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';

type ActiveTab = 'dashboard' | 'projects' | 'prediction' | 'soil-cv' | 'alerts';

interface OfficerSession {
  username: string;
  fullName: string;
  designation: string;
  department: string;
  isAuthenticated: boolean;
}

const STORAGE_KEY_PROJECTS = 'terrapulse_gov_projects_v3';
const STORAGE_KEY_ALERTS = 'terrapulse_gov_alerts_v3';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [projects, setProjects] = useState<InfrastructureProject[]>(INITIAL_PROJECTS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    INITIAL_PROJECTS[0].id
  );
  const [triggerNewProjectModal, setTriggerNewProjectModal] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  const [session, setSession] = useState<OfficerSession>({
    username: 'cala.nodal@nic.in',
    fullName: 'Dr. R. K. Deshmukh, IAS',
    designation: 'Competent Authority for Land Acquisition (CALA)',
    department: 'Ministry of Road Transport & Railways PMG',
    isAuthenticated: true,
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('cala.nodal@nic.in');
  const [loginPassword, setLoginPassword] = useState('••••••••••••');
  const [loginRole, setLoginRole] = useState(
    'Competent Authority for Land Acquisition (CALA)'
  );

  // Hydrate live state from the full-stack Express backend (/api/state)
  useEffect(() => {
    let mounted = true;
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          if (Array.isArray(data.alerts)) {
            setAlerts(data.alerts);
          }
        }
      })
      .catch(() => {
        // Fallback to localStorage if needed
        try {
          const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) setProjects(parsed);
          }
        } catch {
          // ignore
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
      localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(alerts));
    } catch {
      // ignore
    }
  }, [projects, alerts]);

  const handleCreateProject = async (newProj: InfrastructureProject) => {
    // Optimistic update
    setProjects((prev) => [newProj, ...prev]);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProj),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      }
    } catch {
      // Optimistic state already applied
    }
  };

  const handleUpdateProject = async (updatedProj: InfrastructureProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProj.id ? updatedProj : p))
    );
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(updatedProj.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProj),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) setProjects(data.projects);
      }
    } catch {
      // Optimistic state already applied
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== projectId);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(remaining[0]?.id || null);
      }
      return remaining;
    });
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      }
    } catch {
      // Optimistic state already applied
    }
  };

  const handleUpdateAlertStatus = async (
    alertId: string,
    status: SystemAlert['status']
  ) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status } : a))
    );
    try {
      const res = await fetch(`/api/alerts/${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      }
    } catch {
      // Optimistic state already applied
    }
  };

  const handleResetDemoData = async () => {
    setProjects(INITIAL_PROJECTS);
    setAlerts(INITIAL_ALERTS);
    setSelectedProjectId(INITIAL_PROJECTS[0].id);
    localStorage.removeItem(STORAGE_KEY_PROJECTS);
    localStorage.removeItem(STORAGE_KEY_ALERTS);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      }
    } catch {
      // ignore
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSession({
      username: loginUsername.trim() || 'cala.nodal@nic.in',
      fullName: loginUsername.includes('survey')
        ? 'Er. S. Nair (Chief Geotechnical Surveyor)'
        : 'Dr. R. K. Deshmukh, IAS',
      designation: loginRole,
      department: 'National Infrastructure PMG Portal',
      isAuthenticated: true,
    });
    setShowAuthModal(false);
  };

  const activeAlertCount = alerts.filter((a) => a.status === 'Active').length;
  const selectedProjectObj =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || null;

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'projects', label: 'Project Registry' },
    { id: 'prediction', label: 'Delay Prediction' },
    { id: 'soil-cv', label: 'Soil & Land CV' },
    {
      id: 'alerts',
      label: activeAlertCount > 0 ? `Alerts & Reports (${activeAlertCount})` : 'Alerts & Reports',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Strictly 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-slate-800 bg-[#0B1F3A] px-6 py-3.5 text-white">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          TerraPulse GovTech
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'border-sky-400 text-white font-semibold'
                    : 'border-transparent text-slate-300 hover:text-white hover:border-slate-500'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('projects');
              setTriggerNewProjectModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Register Project</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Strip */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === item.id
                ? 'bg-[#0B1F3A] text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Contextual Workspace Breadcrumb, AI Policy Advisor Launcher & Officer Session Bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Infrastructure Land Acquisition &amp; Geotechnical Monitoring
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-[#1E3A8A]">
              {activeTab === 'dashboard' && 'Executive Overview & GIS'}
              {activeTab === 'projects' && 'Project, Parcel & Milestone Registry'}
              {activeTab === 'prediction' && 'Scikit-Learn Delay Predictor'}
              {activeTab === 'soil-cv' && 'OpenCV Land & Soil Surface Lab'}
              {activeTab === 'alerts' && 'Statutory Alerts, Reports & Codebase'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-[#0B1F3A] hover:border-[#1E3A8A] hover:bg-blue-50/50 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#1E3A8A]" />
              <span>Policy &amp; Risk Advisor</span>
            </button>

            <span className="text-slate-300">·</span>

            {session.isAuthenticated ? (
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                <span>
                  <strong className="text-slate-900">{session.fullName}</strong>{' '}
                  <span className="hidden lg:inline text-slate-400">
                    ({session.designation})
                  </span>
                </span>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="font-medium text-[#1E3A8A] hover:underline whitespace-nowrap"
                >
                  Switch Role
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] hover:underline"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Officer Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container with Smooth Motion Transitions */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === 'dashboard' && (
              <DashboardView
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectManagementView
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onCreateProject={handleCreateProject}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onOpenNewProjectModal={triggerNewProjectModal}
                onCloseNewProjectModal={() => setTriggerNewProjectModal(false)}
              />
            )}

            {activeTab === 'prediction' && (
              <DelayPredictionView
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onUpdateProject={handleUpdateProject}
              />
            )}

            {activeTab === 'soil-cv' && <SoilAnalysisView />}

            {activeTab === 'alerts' && (
              <AlertsAndReportsView
                projects={projects}
                alerts={alerts}
                onUpdateAlertStatus={handleUpdateAlertStatus}
                onSelectProjectAndInspect={(projectId) => {
                  setSelectedProjectId(projectId);
                  setActiveTab('projects');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Chatbot Launcher Button */}
      <button
        type="button"
        onClick={() => setIsAiDrawerOpen(true)}
        aria-label="Open Policy and Risk AI Advisor"
        className="fixed bottom-5 right-6 z-30 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0B1F3A] px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-[#1E3A8A] transition-colors whitespace-nowrap"
      >
        <MessageSquare className="h-4 w-4 text-sky-400" />
        <span>Ask Policy &amp; Risk Advisor</span>
      </button>

      {/* AI Chatbot Slide-Over Drawer */}
      <AiAssistantDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        projects={projects}
        selectedProject={selectedProjectObj}
      />

      {/* Clean GovTech Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">
              TerraPulse Infrastructure Analytics
            </span>
            <span>·</span>
            <span>
              Real-world Indian infrastructure corridor alignments (DFCCIL, NHSRCL, NHAI, NICDC, YEIDA, PGCIL) with Google Maps Grounding. Optical soil CV observations are preliminary surface indicators only.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleResetDemoData}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:underline whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore Baseline Corridors</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Officer Authentication & Role Switching Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="auth-modal-title" className="text-base font-bold text-slate-900">
                Officer Authentication &amp; Role Session
              </h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                aria-label="Close authentication modal"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label htmlFor="auth-email" className="block font-semibold text-slate-700">
                  Official Government Email / ID
                </label>
                <input
                  id="auth-email"
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="auth-role" className="block font-semibold text-slate-700">
                  Authorized Role
                </label>
                <select
                  id="auth-role"
                  value={loginRole}
                  onChange={(e) => setLoginRole(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 focus:border-[#1E3A8A] focus:outline-none"
                >
                  <option value="Competent Authority for Land Acquisition (CALA)">
                    Competent Authority for Land Acquisition (CALA)
                  </option>
                  <option value="Project Monitoring Group (PMG) Nodal Officer">
                    Project Monitoring Group (PMG) Nodal Officer
                  </option>
                  <option value="Field Geotechnical & Cadastral Survey Engineer">
                    Field Geotechnical &amp; Cadastral Survey Engineer
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="auth-pass" className="block font-semibold text-slate-700">
                  Session Credential Token
                </label>
                <input
                  id="auth-pass"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono focus:border-[#1E3A8A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSession((s) => ({ ...s, isAuthenticated: false }));
                    setShowAuthModal(false);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
                >
                  Authenticate Officer Session
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
