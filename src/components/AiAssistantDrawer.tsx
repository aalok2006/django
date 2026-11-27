import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUp,
  ExternalLink,
  Globe,
  MapPin,
  MessageSquare,
  RotateCcw,
  X,
} from 'lucide-react';
import { InfrastructureProject } from '../utils/predictionEngine';

export interface GroundingPlaceLink {
  title: string;
  uri: string;
  sourceType: 'maps' | 'web';
  reviewSnippets?: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  warning?: string;
  groundingLinks?: GroundingPlaceLink[];
}

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: InfrastructureProject[];
  selectedProject: InfrastructureProject | null;
}

const SUGGESTED_PROMPTS = [
  'Locate District Collectorate & CALA offices near WDFC-JNPT-02 on Google Maps',
  'Which corridor has the highest delay risk and why?',
  'Check real-world connectivity around MAHSR-C3-01 in Palghar & Boisar',
  'What geotechnical lab tests are required after OpenCV soil screening?',
];

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  projects,
  selectedProject,
}) => {
  const [groundingMode, setGroundingMode] = useState<'maps' | 'search' | 'portfolio'>('maps');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      role: 'model',
      text: `Welcome to the TerraPulse Policy & Acquisition Advisor. I am connected to your live portfolio of ${projects.length} real-world national infrastructure corridors with Google Maps Grounding enabled. Ask me about corridor delay probabilities, nearby CALA / Collectorate offices, RFCTLARR statutory bottlenecks, or geotechnical verification standards.`,
      timestamp: 'Ready',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          groundingMode,
          latitude: selectedProject?.coordinates.lat,
          longitude: selectedProject?.coordinates.lng,
        }),
      });

      const data = await response.json();
      const replyText =
        data.reply ||
        'Unable to retrieve advisory response at this moment. Please try again.';

      setMessages((prev) => [
        ...prev,
        {
          id: `mdl-${Date.now()}`,
          role: 'model',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          warning: data.warning,
          groundingLinks: Array.isArray(data.groundingLinks) ? data.groundingLinks : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Network error communicating with `/api/chat` backend service.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: `Session cleared. Ready to analyze ${projects.length} active infrastructure corridors${
          selectedProject ? ` (Focused: ${selectedProject.code} @ ${selectedProject.coordinates.lat.toFixed(4)}°N, ${selectedProject.coordinates.lng.toFixed(4)}°E)` : ''
        }.`,
        timestamp: 'Ready',
      },
    ]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/40"
            aria-hidden="true"
          />

          {/* Slide-over Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Policy and Risk AI Advisor"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#0B1F3A] px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 text-sky-400 shrink-0" />
                <div>
                  <h2 className="font-display text-sm font-bold tracking-tight">
                    TerraPulse Policy &amp; Risk Advisor
                  </h2>
                  <p className="font-mono text-[11px] text-slate-300">
                    gemini-3.8-flash · Google Maps &amp; Portfolio Grounding
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearChat}
                  aria-label="Reset conversation"
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close advisor drawer"
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Grounding Mode Selector */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-[11px]">
              <span className="font-semibold text-slate-700">Grounding Tool:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setGroundingMode('maps')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    groundingMode === 'maps'
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  Google Maps
                </button>
                <button
                  type="button"
                  onClick={() => setGroundingMode('search')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    groundingMode === 'search'
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  Google Search
                </button>
                <button
                  type="button"
                  onClick={() => setGroundingMode('portfolio')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    groundingMode === 'portfolio'
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  Portfolio Only
                </button>
              </div>
            </div>

            {/* Suggested Quick Prompts */}
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                Quick Corridor &amp; Maps Inquiries:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={isLoading}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-left text-[11px] font-medium text-slate-700 hover:border-[#1E3A8A] hover:text-[#1E3A8A] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0B1F3A] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {/* Render extracted Google Maps & Web Grounding Links + Review Snippets */}
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-slate-200 pt-2">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Grounded Place &amp; Web Citations:
                        </div>
                        {msg.groundingLinks.map((link, idx) => (
                          <div
                            key={`${link.uri}-${idx}`}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                          >
                            <a
                              href={link.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[#1E3A8A] hover:underline"
                            >
                              {link.sourceType === 'maps' ? (
                                <MapPin className="h-3 w-3 shrink-0 text-red-600" />
                              ) : (
                                <Globe className="h-3 w-3 shrink-0 text-sky-600" />
                              )}
                              <span>{link.title}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                            </a>
                            {link.reviewSnippets && link.reviewSnippets.length > 0 && (
                              <div className="mt-1 border-l-2 border-slate-200 pl-2 text-[10px] italic text-slate-500">
                                {link.reviewSnippets.slice(0, 2).map((snip, sIdx) => (
                                  <div key={sIdx}>&ldquo;{snip}&rdquo;</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.warning && (
                      <div className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-amber-700">
                        {msg.warning}
                      </div>
                    )}
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-slate-400">
                    {msg.role === 'user' ? 'Officer' : 'TerraPulse Advisor'} · {msg.timestamp}
                  </span>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>Querying gemini-3.8-flash ({groundingMode} grounding)...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="border-t border-slate-200 bg-white p-3.5"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about corridors, nearby CALA offices on Maps, or RFCTLARR..."
                  aria-label="Ask Policy and Risk Advisor"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  aria-label="Send message"
                  className="inline-flex items-center justify-center rounded-md bg-[#0B1F3A] p-2 text-white hover:bg-[#1E3A8A] disabled:opacity-40 transition-colors shrink-0"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
