import React, { useEffect, useState } from 'react';
import { Bot, Download, GitCompare, RefreshCw, Send } from 'lucide-react';
import { useEarth } from '../../contexts/EarthContext.tsx';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  timestamp: string;
}

const PRESET_QUESTIONS = [
  'What is happening to the climate today across the monitored global network?',
  'Which regions currently have active wildfires or extreme thermal anomalies?',
  'Show the hottest and coolest regions in the live station dataset.',
  'What is the current air quality in Karachi compared to WHO guidelines?',
  'Generate an executive global environmental impact report from live telemetry.',
];

export const AiDetectiveView: React.FC = () => {
  const { selectedIntel, aiSeedPrompt, clearAiSeedPrompt } = useEarth();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'EARTH AI DETECTIVE online. Ask any question about live global temperatures, active NASA EONET wildfires/storms, USGS seismic telemetry, Copernicus CAMS air quality, or compare two cities using real-time observations.',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayError = error
    ? error.includes('OPENROUTER_API_KEY') ||
        error.includes('GEMINI_API_KEY') ||
        error.includes('GOOGLE_API_KEY') ||
        error.includes('no AI provider key')
      ? 'AI Detective is unavailable because no AI provider key is configured on the server. Add OPENROUTER_API_KEY or GEMINI_API_KEY (or GOOGLE_API_KEY) to the .env file and restart the app to enable live analysis.'
      : error
    : null;

  const [cityA, setCityA] = useState('Karachi');
  const [cityB, setCityB] = useState('London');

  const sendQuery = async (
    promptText: string,
    mode: 'chat' | 'compare' | 'report' = 'chat',
    compareCities?: [string, string]
  ) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/detective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          mode,
          selectedLocation: selectedIntel,
          compareCities: compareCities ?? null,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Earth AI Detective request failed.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer,
          sources: data.referencedSources,
          timestamp: data.generatedAt || new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Detective.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (aiSeedPrompt) {
      const seed = aiSeedPrompt;
      clearAiSeedPrompt();
      void sendQuery(seed, 'chat');
    }
  }, [aiSeedPrompt, clearAiSeedPrompt]);

  const handleDownloadTranscript = () => {
    const md = messages
      .map(
        (m) =>
          `## ${m.role === 'user' ? 'Investigator' : 'EARTH AI DETECTIVE'} (${m.timestamp})\n\n${m.text}\n`
      )
      .join('\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earth-ai-detective-briefing-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto h-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            EARTH AI DETECTIVE
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Data-grounded environmental intelligence powered exclusively by live NASA, USGS, and Open-Meteo observations
            {selectedIntel
              ? ` · Map context: ${selectedIntel.location.name}, ${selectedIntel.location.country}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTranscript}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0E1420] border border-slate-700 hover:border-cyan-500/60 text-slate-200 rounded-md transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          Download Briefing (.md)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[500px]">
        {/* Left Sidebar: Quick Prompts & Two-City Comparison */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
            <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
              Compare Two Cities (Live Fetch)
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={cityA}
                onChange={(e) => setCityA(e.target.value)}
                placeholder="City A"
                className="bg-[#07090E] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
              <input
                type="text"
                value={cityB}
                onChange={(e) => setCityB(e.target.value)}
                placeholder="City B"
                className="bg-[#07090E] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void sendQuery(
                  `Compare live meteorological conditions, air quality (PM2.5, AQI), historical temperature anomaly Z-score, and wildfire/flood screening risks between ${cityA} and ${cityB}.`,
                  'compare',
                  [cityA, cityB]
                )
              }
              className="w-full py-2 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 text-xs font-medium transition-colors"
            >
              Run Live City Comparison
            </button>
          </div>

          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-2.5">
            <h2 className="text-xs font-semibold text-slate-200">
              Investigative Queries
            </h2>
            <div className="space-y-1.5">
              {PRESET_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendQuery(q, 'chat')}
                  className="w-full text-left p-2.5 rounded bg-[#07090E] border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-slate-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Chat Area */}
        <div className="lg:col-span-8 flex flex-col rounded-lg bg-[#0E1420] border border-slate-800 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-100 ml-8'
                    : 'bg-[#07090E] border-slate-800 text-slate-200 mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                  <span>
                    {m.role === 'user' ? 'INVESTIGATOR' : 'EARTH AI DETECTIVE'}
                  </span>
                  <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                    Grounded sources: {m.sources.join(' · ')}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#07090E] flex items-center gap-2 text-xs text-cyan-300 mr-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Querying live telemetry feeds and synthesizing verified briefing...
              </div>
            )}

            {displayError && (
              <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200">
                {displayError}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuery(input, 'chat');
            }}
            className="p-3 border-t border-slate-800 bg-[#080C14] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Earth AI Detective about climate trends, wildfires, air quality, or any region..."
              className="flex-1 bg-[#0E1420] border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Analyze
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
