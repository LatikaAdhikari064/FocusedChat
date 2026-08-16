import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Lock, Users, ArrowRight, Plus, LogIn, Eye, EyeOff } from "lucide-react";

const BACKEND = "http://localhost:5000";

export default function LandingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("join"); // "join" | "create"
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    teamName: "", description: "", restriction: "", admin: "", password: ""
  });

  // Join form
  const [joinForm, setJoinForm] = useState({ teamName: "", user: "", password: "" });

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    try {
      const res = await fetch(`${BACKEND}/api/teams`);
      const data = await res.json();
      setTeams(data);
    } catch { /* ignore */ }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/teams/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      navigate("/chat", {
        state: {
          teamName: createForm.teamName,
          user: createForm.admin,
          info: data.team,
        }
      });
    } catch { setError("Server unreachable."); }
    finally { setLoading(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/teams/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: joinForm.teamName, password: joinForm.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      navigate("/chat", {
        state: { teamName: joinForm.teamName, user: joinForm.user, info: data.team }
      });
    } catch { setError("Server unreachable."); }
    finally { setLoading(false); }
  }

  function quickJoin(teamName) {
    setJoinForm(f => ({ ...f, teamName }));
    setTab("join");
  }

  return (
    <div className="min-h-screen bg-[#050e0c] text-white font-mono flex flex-col" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Header */}
      <header className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-400 rounded flex items-center justify-center">
          <Zap size={16} className="text-black" fill="black" />
        </div>
        <span className="text-emerald-400 text-sm tracking-[0.3em] uppercase font-bold">FocusChat</span>
        <span className="ml-auto text-xs text-white/30">AI-Moderated Spaces</span>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-6 gap-8">

        {/* Left: Hero */}
        <div className="lg:w-1/2 flex flex-col justify-center gap-6 py-8">
          <div className="space-y-2">
            <p className="text-emerald-400 text-xs tracking-[0.4em] uppercase">Stay on topic. Or get frozen.</p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-white">
              Chat spaces<br />
              <span className="text-emerald-400">that don't drift.</span>
            </h1>
          </div>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm">
            Create a focused team space. Define the topic. Our AI moderator watches every message — 3 off-topic strikes and you're frozen for 24 hours.
          </p>

          {/* How it works */}
          <div className="space-y-3 mt-2">
            {[
              ["01", "Create a space with a clear topic"],
              ["02", "Every message is checked by AI"],
              ["03", "3 strikes = 24h chat freeze"],
            ].map(([num, text]) => (
              <div key={num} className="flex items-center gap-3 text-sm">
                <span className="text-emerald-400 text-xs w-6">{num}</span>
                <span className="text-white/60">{text}</span>
              </div>
            ))}
          </div>

          {/* Live teams preview */}
          {teams.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Active Spaces</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {teams.map(t => (
                  <button
                    key={t.name}
                    onClick={() => quickJoin(t.name)}
                    className="w-full text-left p-3 rounded-lg border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors"># {t.name}</span>
                      <div className="flex items-center gap-2">
                        {t.hasPassword && <Lock size={10} className="text-white/30" />}
                        <span className="text-xs text-white/30">{t.memberCount} online</span>
                      </div>
                    </div>
                    <p className="text-xs text-white/40 mt-1 truncate">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Forms */}
        <div className="lg:w-1/2 flex items-start justify-center pt-8">
          <div className="w-full max-w-md">

            {/* Tabs */}
            <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
              {[["join", "Join Space", LogIn], ["create", "Create Space", Plus]].map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setError(""); }}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    tab === id ? "bg-emerald-500 text-black" : "text-white/40 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Join Form */}
            {tab === "join" && (
              <form onSubmit={handleJoin} className="space-y-4">
                <Field label="Space Name" placeholder="e.g. react-devs" value={joinForm.teamName}
                  onChange={v => setJoinForm(f => ({ ...f, teamName: v }))} required />
                <Field label="Your Username" placeholder="e.g. alice" value={joinForm.user}
                  onChange={v => setJoinForm(f => ({ ...f, user: v }))} required />
                <PasswordField label="Password (if required)" placeholder="Leave blank if none"
                  value={joinForm.password} show={showPass} setShow={setShowPass}
                  onChange={v => setJoinForm(f => ({ ...f, password: v }))} />
                <SubmitBtn loading={loading}>Join Space <ArrowRight size={14} /></SubmitBtn>
              </form>
            )}

            {/* Create Form */}
            {tab === "create" && (
              <form onSubmit={handleCreate} className="space-y-4">
                <Field label="Space Name" placeholder="e.g. python-ml" value={createForm.teamName}
                  onChange={v => setCreateForm(f => ({ ...f, teamName: v }))} required />
                <Field label="Your Username (You'll be Admin)" placeholder="e.g. alice" value={createForm.admin}
                  onChange={v => setCreateForm(f => ({ ...f, admin: v }))} required />
                <Textarea label="Topic / Description *" placeholder="What is this space about? e.g. Discuss Python machine learning libraries and techniques only."
                  value={createForm.description} onChange={v => setCreateForm(f => ({ ...f, description: v }))} required rows={3} />
                <Textarea label="Rules (optional)" placeholder="e.g. No job postings. No self-promotion. Technical discussions only."
                  value={createForm.restriction} onChange={v => setCreateForm(f => ({ ...f, restriction: v }))} rows={2} />
                <PasswordField label="Password (optional)" placeholder="Leave blank for open space"
                  value={createForm.password} show={showPass} setShow={setShowPass}
                  onChange={v => setCreateForm(f => ({ ...f, password: v }))} />
                <SubmitBtn loading={loading}>Create Space <ArrowRight size={14} /></SubmitBtn>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, required, type = "text" }) {
  return (
    <div>
      <label className="text-xs text-white/40 uppercase tracking-widest block mb-1.5">{label}</label>
      <input
        type={type} placeholder={placeholder} value={value} required={required}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 placeholder:text-white/20 transition-all"
      />
    </div>
  );
}

function PasswordField({ label, placeholder, value, onChange, show, setShow }) {
  return (
    <div>
      <label className="text-xs text-white/40 uppercase tracking-widest block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-10 text-sm outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 placeholder:text-white/20 transition-all"
        />
        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-3.5 text-white/30 hover:text-white/60">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function Textarea({ label, placeholder, value, onChange, required, rows = 2 }) {
  return (
    <div>
      <label className="text-xs text-white/40 uppercase tracking-widest block mb-1.5">{label}</label>
      <textarea
        placeholder={placeholder} value={value} required={required} rows={rows}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 placeholder:text-white/20 transition-all resize-none"
      />
    </div>
  );
}

function SubmitBtn({ children, loading }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all text-sm mt-2"
    >
      {loading ? "Connecting..." : children}
    </button>
  );
}