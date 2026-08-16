import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Send, Users, LogOut, ShieldAlert, Crown,
  UserMinus, RefreshCw, Zap, Lock, AlertTriangle
} from "lucide-react";

export default function ChatPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [strikes, setStrikes] = useState({ count: 0, timeoutUntil: null });
  const [showSidebar, setShowSidebar] = useState(false);
  const [frozenUntil, setFrozenUntil] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);

  const isAdmin = state?.user === state?.info?.admin;

  useEffect(() => {
    if (!state?.info) { navigate("/"); return; }

    // Create a fresh socket each mount — avoids stale listener bugs
    const socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setConnected(true);
      // Pass teamInfo so server can restore team if it was lost on restart
      socket.emit("join_team", {
        teamName: state.teamName,
        user: state.user,
        teamInfo: state.info,
      });
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Connect error:", err.message);
      setConnected(false);
    });

    socket.on("receive_message", (data) => {
      console.log("📨 receive_message:", data);
      setMessages(prev => [...prev, data]);
    });

    socket.on("members_update", (list) => {
      setMembers(list);
    });

    socket.on("strike_update", ({ count }) => {
      setStrikes(s => ({ ...s, count }));
    });

    socket.on("strike_status", ({ count, timeoutUntil }) => {
      setStrikes({ count, timeoutUntil });
      if (timeoutUntil && timeoutUntil > Date.now()) {
        setFrozenUntil(new Date(timeoutUntil));
      }
    });

    socket.on("user_kicked", ({ userToKick }) => {
      if (userToKick === state.user) {
        alert("You have been removed from this space by the Admin.");
        navigate("/");
      }
    });

    socket.on("error_message", (msg) => {
      setMessages(prev => [...prev, {
        user: "System", text: msg, type: "error", time: nowTime()
      }]);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // run once on mount

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Freeze countdown ticker
  useEffect(() => {
    if (!frozenUntil) return;
    const tick = () => {
      const diff = frozenUntil - Date.now();
      if (diff <= 0) {
        setFrozenUntil(null);
        setStrikes({ count: 0, timeoutUntil: null });
        setCountdown("");
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(`${h}h ${m}m ${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [frozenUntil]);

  const sendMessage = (e) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || frozenUntil || !socketRef.current) return;
    socketRef.current.emit("send_message", {
      teamName: state.teamName,
      user: state.user,
      text: trimmed,
    });
    setMessage("");
  };

  const handleKick = (targetUser) => {
    if (window.confirm(`Remove ${targetUser}?`)) {
      socketRef.current?.emit("kick_user", {
        teamName: state.teamName,
        userToKick: targetUser,
        adminUser: state.user,
      });
    }
  };

  const handleResetStrikes = (targetUser) => {
    socketRef.current?.emit("reset_strikes", {
      teamName: state.teamName,
      targetUser,
      adminUser: state.user,
    });
  };

  if (!state) return null;

  return (
    <div className="flex h-screen bg-[#050e0c] text-white overflow-hidden" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* ── Main Chat ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="px-4 py-3 bg-black/40 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap size={16} className="text-black" fill="black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm"># {state.teamName}</h2>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
              </div>
              <p className="text-[10px] text-emerald-400/60 mt-0.5 max-w-xs truncate">{state.info.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StrikeIndicator count={strikes.count} frozen={!!frozenUntil} />
            <button
              onClick={() => setShowSidebar(s => !s)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
            >
              <Users size={13} />
              <span>{members.length}</span>
            </button>
            <button onClick={() => navigate("/")} className="text-white/30 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Freeze Banner */}
        {frozenUntil && (
          <div className="px-4 py-2.5 bg-blue-950/70 border-b border-blue-500/20 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Lock size={13} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-blue-300 font-bold">Chat frozen — 3 off-topic strikes</p>
              <p className="text-[10px] text-blue-400/50 mt-0.5">Resumes in {countdown}</p>
            </div>
          </div>
        )}

        {/* Strike warning bar */}
        {strikes.count > 0 && strikes.count < 3 && !frozenUntil && (
          <div className="px-4 py-2 bg-amber-950/50 border-b border-amber-500/20 flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
            <p className="text-[10px] text-amber-300/80 flex-1">
              <span className="font-bold text-amber-400">{strikes.count}/3 strikes</span> — {3 - strikes.count} more off-topic message{3 - strikes.count !== 1 ? "s" : ""} will freeze your chat for 24h
            </p>
            <div className="flex gap-1 flex-shrink-0">
              {[1,2,3].map(n => (
                <div key={n} className={`w-4 h-1.5 rounded-full ${n <= strikes.count ? "bg-amber-400" : "bg-white/10"}`} />
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <Zap size={22} className="text-emerald-500/30" />
              </div>
              <p className="text-white/20 text-sm">Space is open. Stay on topic.</p>
              <p className="text-white/10 text-xs mt-1 max-w-xs mx-auto">{state.info.description}</p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.type === "notification") {
              return (
                <div key={i} className="flex items-center gap-3 py-0.5">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[10px] text-white/25 px-2 whitespace-nowrap">{msg.text}</span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
              );
            }

            if (msg.type === "warning") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-sm w-full rounded-2xl rounded-tl-sm bg-amber-950/60 border border-amber-500/25 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
                        <ShieldAlert size={11} className="text-amber-400" />
                      </div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">AI Moderator</span>
                    </div>
                    <p className="text-xs text-amber-300/80 leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            }

            if (msg.type === "error") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-sm w-full rounded-2xl rounded-tl-sm bg-blue-950/60 border border-blue-500/25 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                        <Lock size={11} className="text-blue-400" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">System</span>
                    </div>
                    <p className="text-xs text-blue-300/80 leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            }

            const isOwn = msg.user === state.user;
            return (
              <div key={i} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[72%] space-y-1">
                  {!isOwn && (
                    <p className="text-[10px] text-white/30 ml-3">{msg.user}</p>
                  )}
                  <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                    isOwn
                      ? "bg-emerald-600/25 border border-emerald-500/25 text-white rounded-2xl rounded-tr-sm"
                      : "bg-white/[0.06] border border-white/[0.08] text-white/85 rounded-2xl rounded-tl-sm"
                  }`}>
                    {msg.text}
                  </div>
                  <p className={`text-[9px] text-white/20 px-1 ${isOwn ? "text-right" : "text-left"}`}>{msg.time}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 bg-black/30 border-t border-white/5">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={!!frozenUntil}
              placeholder={
                !connected ? "Connecting to server..." :
                frozenUntil ? `🧊 Frozen — resumes in ${countdown}` :
                `Message · stay on topic...`
              }
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/30 placeholder:text-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            />
            <button
              type="submit"
              disabled={!!frozenUntil || !message.trim() || !connected}
              className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed rounded-xl text-black flex items-center justify-center transition-all"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className={`${showSidebar ? "w-60" : "w-0"} transition-all duration-200 overflow-hidden border-l border-white/5 bg-black/20 flex-shrink-0`}>
        <div className="w-60 p-4 h-full overflow-y-auto">
          <div className="mb-5">
            <p className="text-[9px] uppercase tracking-widest text-white/20 mb-2">Topic</p>
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-xs text-white/60 leading-relaxed">{state.info.description}</p>
            </div>
            {state.info.restriction && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mt-2">
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Rules</p>
                <p className="text-[10px] text-white/40 leading-relaxed">{state.info.restriction}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/20 mb-2">Members · {members.length}</p>
            <div className="space-y-0.5">
              {members.map(m => {
                const memberIsAdmin = m === state.info.admin;
                const isYou = m === state.user;
                return (
                  <div key={m} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 group transition-colors">
                    <div className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold flex-shrink-0 ${
                      memberIsAdmin ? "bg-emerald-500 text-black" : "bg-white/10 text-white/50"
                    }`}>
                      {m[0].toUpperCase()}
                    </div>
                    <span className={`text-xs flex-1 truncate ${isYou ? "text-emerald-400" : "text-white/60"}`}>
                      {m}{isYou ? " (you)" : ""}
                    </span>
                    {memberIsAdmin && <Crown size={9} className="text-emerald-500/50 flex-shrink-0" />}
                    {isAdmin && !memberIsAdmin && (
                      <div className="hidden group-hover:flex gap-1.5">
                        <button onClick={() => handleResetStrikes(m)} title="Reset strikes"
                          className="text-white/20 hover:text-emerald-400 transition-colors">
                          <RefreshCw size={10} />
                        </button>
                        <button onClick={() => handleKick(m)} title="Remove"
                          className="text-white/20 hover:text-red-400 transition-colors">
                          <UserMinus size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {strikes.count > 0 && (
            <div className="mt-5 p-3 rounded-xl bg-amber-950/40 border border-amber-500/20">
              <p className="text-[9px] text-amber-400/60 uppercase tracking-wider mb-2">Your strikes</p>
              <div className="flex gap-1.5 mb-2">
                {[1,2,3].map(n => (
                  <div key={n} className={`h-2 flex-1 rounded-full ${n <= strikes.count ? "bg-amber-400" : "bg-white/10"}`} />
                ))}
              </div>
              <p className="text-[10px] text-white/30">
                {strikes.count < 3 ? `${3 - strikes.count} more until 24h freeze` : "Frozen for 24 hours"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StrikeIndicator({ count, frozen }) {
  if (frozen) return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25">
      <Lock size={10} className="text-blue-400" />
      <span className="text-[10px] text-blue-400 font-bold">FROZEN</span>
    </div>
  );
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <ShieldAlert size={10} className="text-amber-400" />
      <span className="text-[10px] text-amber-400 font-bold">{count}/3</span>
    </div>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}