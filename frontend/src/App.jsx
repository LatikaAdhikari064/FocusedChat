import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Shield, Users, MessageSquare, Lock, Unlock, Trash2, X, Send, Image, Mic } from 'lucide-react';

const SOCKET_URL = 'http://localhost:5000';
let socket;

export default function App() {
  // Navigation & Session State
  const [view, setView] = useState('landing'); // 'landing' or 'chat'
  const [activeTab, setActiveTab] = useState('join'); // 'join' or 'create'
  
  // User/Group Configuration Data
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Chat & Group State
  const [groupMeta, setGroupMeta] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [strikes, setStrikes] = useState(0);

  const messagesEndRef = useRef(null);

  // Connect socket when entering chat view
  useEffect(() => {
    if (view === 'chat' && groupName && username) {
      socket = io(SOCKET_URL);

      socket.emit('join_space', { groupName, username });

      socket.on('meta_updated', (meta) => setGroupMeta(meta));
      socket.on('members_updated', (list) => setMembers(list));
      
      socket.on('receive_msg', (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.on('sys_message', (text) => {
        setMessages((prev) => [...prev, { id: Math.random(), username: 'System', text, type: 'system' }]);
      });

      socket.on('strike_alert', ({ strikes }) => {
        setStrikes(strikes);
        alert(`⚠️ AI Moderation Warning! Strike ${strikes}/3. Off-topic message blocked.`);
      });

      socket.on('error_alert', (msg) => alert(msg));
      
      socket.on('evicted', (msg) => {
        alert(msg);
        handleExitChat();
      });

      socket.on('group_deleted', (msg) => {
        alert(msg);
        handleExitChat();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [view]);

  // Scroll to bottom of chat automatically
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Action Helpers
  const handleCreateSpace = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${SOCKET_URL}/api/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, description, password, isPrivate, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setView('chat');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleJoinSpace = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${SOCKET_URL}/api/groups/validate-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setView('chat');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    socket.emit('send_msg', {
      groupName,
      username,
      messageData: { text: messageText }
    });
    setMessageText('');
  };

  // Mocking media attachments for front-end fidelity
  const handleSendMediaMock = (type) => {
    const mockUrl = type === 'image' 
      ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400' 
      : 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

    socket.emit('send_msg', {
      groupName,
      username,
      messageData: { mediaUrl: mockUrl, mediaType: type }
    });
  };

  const toggleLockSpace = () => {
    socket.emit('toggle_lock_space', { groupName, email });
  };

  const handleDeleteSpace = () => {
    if (window.confirm("Are you sure you want to permanently delete this space?")) {
      socket.emit('delete_space', { groupName, email });
    }
  };

  const handleExitChat = () => {
    setView('landing');
    setMessages([]);
    setStrikes(0);
    setShowDrawer(false);
  };

  return (
    <div className="min-h-screen bg-[#070d0a] text-gray-100 font-sans antialiased">
      
      {/* --- VIEW 1: LANDING / AUTHENTICATION PAGE --- */}
      {view === 'landing' && (
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
          
          {/* Left Hero Content */}
          <div>
            <div className="flex items-center gap-2 text-[#10b981] font-bold tracking-wider text-sm uppercase mb-6">
              <Shield size={16} /> Stay on topic. Or get frozen.
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none mb-6">
              Chat spaces <br />
              <span className="text-[#10b981]">that don't drift.</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-md">
              Create a focused team space. Define the topic focus. Our real-time AI moderator watches every transmission—3 strikes and you freeze.
            </p>
            <div className="space-y-4 border-l-2 border-emerald-900 pl-4 text-sm text-gray-400">
              <div><span className="text-[#10b981] font-mono">01</span> Create a space with a strict explicit context</div>
              <div><span className="text-[#10b981] font-mono">02</span> Every individual post is vetted via Gemini LLM</div>
              <div><span className="text-[#10b981] font-mono">03</span> 3 Strikes = Cooldown freeze. 4 Strikes = Complete Eviction</div>
            </div>
          </div>

          {/* Right Forms Card Container */}
          <div className="bg-[#0b1410] border border-emerald-950/60 rounded-xl p-8 shadow-2xl">
            <div className="flex border-b border-emerald-950/40 mb-6">
              <button 
                onClick={() => setActiveTab('join')}
                className={`flex-1 pb-3 text-center font-medium border-b-2 transition ${activeTab === 'join' ? 'border-[#10b981] text-white' : 'border-transparent text-gray-500'}`}
              >
                ➔] Join Space
              </button>
              <button 
                onClick={() => setActiveTab('create')}
                className={`flex-1 pb-3 text-center font-medium border-b-2 transition ${activeTab === 'create' ? 'border-[#10b981] text-white' : 'border-transparent text-gray-500'}`}
              >
                + Create Space
              </button>
            </div>

            {/* JOIN FORM */}
            {activeTab === 'join' && (
              <form onSubmit={handleJoinSpace} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">Space Name</label>
                  <input required type="text" placeholder="e.g. react-devs" value={groupName} onChange={e=>setGroupName(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#10b981]" />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">Your Username</label>
                  <input required type="text" placeholder="Your handle" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#10b981]" />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-gray-400 mb-2 tracking-wider">Password (If Required)</label>
                  <input type="password" placeholder="••••" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#10b981]" />
                </div>
                <button type="submit" className="w-full bg-[#10b981] hover:bg-emerald-600 text-[#070d0a] font-bold py-3 px-4 rounded-lg transition mt-2">
                  Join Space →
                </button>
              </form>
            )}

            {/* CREATE FORM */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreateSpace} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-gray-400 mb-1 tracking-wider">Group Name</label>
                  <input required type="text" placeholder="Unique group identity" value={groupName} onChange={e=>setGroupName(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#10b981]" />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-gray-400 mb-1 tracking-wider">Topic Focus / Context (AI Ruleset)</label>
                  <textarea required rows="2" placeholder="What are users allowed to discuss?" value={description} onChange={e=>setDescription(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#10b981]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase font-semibold text-gray-400 mb-1 tracking-wider">Password</label>
                    <input type="password" placeholder="Optional secure lock" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#10b981]" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-semibold text-gray-400 mb-1 tracking-wider">Admin Email</label>
                    <input required type="email" placeholder="owner@domain.com" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#111c17] border border-emerald-950 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#10b981]" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="pvt" checked={isPrivate} onChange={e=>setIsPrivate(e.target.checked)} className="accent-[#10b981]" />
                  <label htmlFor="pvt" className="text-xs text-gray-400 select-none">Make space completely Private</label>
                </div>
                <button type="submit" className="w-full bg-[#10b981] hover:bg-emerald-600 text-[#070d0a] font-bold py-3 px-4 rounded-lg transition mt-2">
                  Instantiate Space 🔥
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- VIEW 2: FULL REAL-TIME CHAT INTERFACE --- */}
      {view === 'chat' && (
        <div className="h-screen flex flex-col bg-[#070d0a]">
          
          {/* Header */}
          <header className="bg-[#0b1410] border-b border-emerald-950/60 px-6 py-4 flex items-center justify-between cursor-pointer shadow-lg" onClick={() => setShowDrawer(true)}>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                ⚡ {groupName} 
                <span className="text-xs font-mono bg-[#111c17] text-gray-400 border border-emerald-950 px-2 py-0.5 rounded-full">
                  {members.length} active
                </span>
              </h2>
              <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">Focus: {groupMeta?.description}</p>
            </div>
            <div className="flex items-center gap-4">
              {strikes > 0 && (
                <div className="bg-red-950/40 border border-red-900 text-red-400 text-xs px-2.5 py-1 rounded font-mono">
                  Strikes: {strikes}/3
                </div>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleExitChat(); }} className="text-gray-400 hover:text-white transition">
                Leave
              </button>
            </div>
          </header>

          {/* Central Message Container stream */}
          <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
            {messages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center text-xs text-gray-500 italic my-2 bg-[#0b1410]/50 py-1.5 rounded border border-emerald-950/20">
                    {msg.text}
                  </div>
                );
              }
              const isMe = msg.username === username;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500 mb-1 px-1">{msg.username}</span>
                  <div className={`max-w-md rounded-xl p-3.5 shadow-md ${isMe ? 'bg-[#10b981] text-[#070d0a] font-medium rounded-tr-none' : 'bg-[#0b1410] border border-emerald-950/60 text-gray-200 rounded-tl-none'}`}>
                    
                    {/* Media render pipelines */}
                    {msg.text && <p className="leading-relaxed break-words">{msg.text}</p>}
                    
                    {msg.mediaType === 'image' && (
                      <img src={msg.mediaUrl} alt="uploaded content" className="rounded-lg max-w-xs object-cover border border-[#070d0a]/10 mt-1" />
                    )}

                    {msg.mediaType === 'audio' && (
                      <audio controls className="mt-1 w-64 max-w-xs accent-emerald-500">
                        <source src={msg.mediaUrl} type="audio/mpeg" />
                      </audio>
                    )}

                    <span className={`block text-[10px] mt-1.5 text-right ${isMe ? 'text-[#070d0a]/60' : 'text-gray-500'}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </main>

          {/* Action Input Box Bar */}
          <footer className="bg-[#0b1410] border-t border-emerald-950/60 p-4">
            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-[#070d0a] px-2 py-1 rounded-lg border border-emerald-950">
                <button type="button" onClick={() => handleSendMediaMock('image')} title="Simulate Image Send" className="p-2 text-gray-400 hover:text-[#10b981] transition">
                  <Image size={18} />
                </button>
                <button type="button" onClick={() => handleSendMediaMock('audio')} title="Simulate Audio Record" className="p-2 text-gray-400 hover:text-[#10b981] transition">
                  <Mic size={18} />
                </button>
              </div>
              <input 
                type="text" 
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder={`Type something relevant to "${groupMeta?.description.substring(0,20)}..."`}
                className="flex-1 bg-[#070d0a] border border-emerald-950 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#10b981]" 
              />
              <button type="submit" className="bg-[#10b981] hover:bg-emerald-600 text-[#070d0a] p-3 rounded-lg transition">
                <Send size={18} />
              </button>
            </form>
          </footer>

          {/* --- ADMIN OPTIONS SLIDE DRAWER WINDOW --- */}
          {showDrawer && (
            <div className="fixed inset-0 bg-black/70 flex justify-end z-50 backdrop-blur-sm">
              <div className="w-80 bg-[#0b1410] border-l border-emerald-950 h-full p-6 flex flex-col shadow-2xl">
                <div className="flex justify-between items-center pb-4 border-b border-emerald-950/60 mb-6">
                  <h3 className="font-bold text-lg text-white">Space Settings</h3>
                  <button onClick={() => setShowDrawer(false)} className="text-gray-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6 flex-1 overflow-y-auto">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">Topic Target</h4>
                    <p className="text-sm bg-[#070d0a] p-3 rounded-lg border border-emerald-950 text-gray-300 leading-relaxed">
                      {groupMeta?.description}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2 flex items-center gap-1">
                      <Users size={12}/> Connected Personnel ({members.length})
                    </h4>
                    <ul className="bg-[#070d0a] rounded-lg border border-emerald-950 divide-y divide-emerald-950/40 px-3 py-1 text-sm max-h-48 overflow-y-auto">
                      {members.map((member, idx) => (
                        <li key={idx} className="py-2 text-gray-300 flex items-center justify-between">
                          <span>{member}</span>
                          {member === groupMeta?.creatorEmail && <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-[#10b981] px-1.5 py-0.5 rounded">Owner</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ADMIN ONLY EXTRA POWER TOOLS */}
                  {email === groupMeta?.creatorEmail && (
                    <div className="pt-4 border-t border-emerald-950/60 space-y-3">
                      <h4 className="text-xs font-semibold uppercase text-[#10b981] tracking-wider mb-1">Administrative Actions</h4>
                      
                      <button 
                        onClick={toggleLockSpace}
                        className="w-full text-left bg-[#070d0a] border border-emerald-950 hover:border-emerald-800 rounded-lg p-3 text-sm flex items-center justify-between transition"
                      >
                        <span className="text-gray-300">{groupMeta?.isLocked ? "Unlock New Registrations" : "Prevent Entry Lock"}</span>
                        {groupMeta?.isLocked ? <Unlock size={16} className="text-[#10b981]" /> : <Lock size={16} className="text-yellow-600" />}
                      </button>

                      <button 
                        onClick={handleDeleteSpace}
                        className="w-full text-left bg-red-950/20 border border-red-950/60 hover:border-red-900 rounded-lg p-3 text-sm flex items-center justify-between text-red-400 transition"
                      >
                        <span>Destroy Space Completely</span>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
        </div>
      )}

    </div>
  );
}