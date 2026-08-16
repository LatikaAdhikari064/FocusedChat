import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Assuming you use react-router
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, UserPlus, LogIn, Lock, Users, Mail, BookOpen, Target } from "lucide-react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
const AuthPage = () => {
  const [isJoinView, setIsJoinView] = useState(true);
  const [formData, setFormData] = useState({});
  const navigate = useNavigate();

  const handleInput = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isJoinView ? "/api/teams/join" : "/api/teams/create";
    
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      
      if (res.ok) {
        // Redirect to chat and pass the team/user info
        navigate("/chat", { state: { ...data } });
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error("Connection failed");
    }
  };

  const variants = {
    initial: (dir) => ({ x: dir > 0 ? 100 : -100, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? 100 : -100, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#06110f] via-[#0a1a17] to-[#020807] px-4 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full top-[-100px] left-[-100px]" />
      <div className="absolute w-[400px] h-[400px] bg-teal-400/10 blur-[100px] rounded-full bottom-[-100px] right-[-100px]" />

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
        <div className="flex bg-white/5 p-1 rounded-xl mb-8 relative">
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-1 bottom-1 w-1/2 rounded-lg bg-emerald-500"
            style={{ left: isJoinView ? "0%" : "50%" }}
          />
          <button onClick={() => {setIsJoinView(true); setFormData({});}} className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 z-10 ${isJoinView ? "text-white" : "text-emerald-300"}`}><LogIn size={16} /> Join</button>
          <button onClick={() => {setIsJoinView(false); setFormData({});}} className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 z-10 ${!isJoinView ? "text-white" : "text-emerald-300"}`}><UserPlus size={16} /> Create</button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-[420px]">
          <AnimatePresence mode="wait" custom={isJoinView ? 1 : -1}>
            {isJoinView ? (
              <motion.div key="join" custom={1} variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-5">
                <Header title="Access Gatekeeper" subtitle="Secure entry to your team" />
                <FormInput name="username" onChange={handleInput} icon={ShieldCheck} placeholder="User Name" />
                <FormInput name="teamName" onChange={handleInput} icon={Users} placeholder="Team Name" />
                <FormInput name="password" onChange={handleInput} icon={Lock} placeholder="Password" type="password" />
                <PrimaryButton text="Enter Secure Space" />
              </motion.div>
            ) : (
              <motion.div key="create" custom={-1} variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <Header title="Deploy Gatekeeper" subtitle="Create your AI-controlled team" />
                <FormInput name="adminName" onChange={handleInput} icon={ShieldCheck} placeholder="Admin Name" />
                <FormInput name="teamName" onChange={handleInput} icon={Users} placeholder="Group Name" />
                <FormInput name="email" onChange={handleInput} icon={Mail} placeholder="Email" type="email" />
                <FormInput name="description" onChange={handleInput} icon={BookOpen} placeholder="Description" />
                <FormInput name="password" onChange={handleInput} icon={Lock} placeholder="Password" type="password" />
                <div className="relative">
                  <Target className="absolute left-3 top-3 text-emerald-400" size={18} />
                  <textarea name="restriction" onChange={handleInput} rows="3" placeholder="Topic restriction (e.g. Only AI discussion)" className="w-full pl-10 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-400 outline-none resize-none" />
                </div>
                <PrimaryButton text="Launch AI Team" />
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
};

// Update FormInput to receive name and onChange
const FormInput = ({ icon: Icon, placeholder, type = "text", name, onChange }) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
    <input name={name} onChange={onChange} type={type} placeholder={placeholder} required className="w-full pl-10 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-400 outline-none" />
  </div>
);

const Header = ({ title, subtitle }) => (
  <div className="text-center mb-4">
    <h2 className="text-2xl font-bold text-white">{title}</h2>
    <p className="text-sm text-gray-400">{subtitle}</p>
  </div>
);

const PrimaryButton = ({ text }) => (
  <button type="submit" className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition shadow-lg shadow-emerald-500/20">
    {text}
  </button>
);

export default AuthPage;