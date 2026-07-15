import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const { theme, setTheme } = useTheme();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password, rememberMe });
            
            if (res.data.success && res.data.accessToken) {
                login(res.data.accessToken, res.data.user);
                toast.success('Successfully logged in!');
                navigate('/');
            }
        } catch (error) {
            console.error('Login error', error);
            const msg = error.response?.data?.message || 'Failed to login. Please check your credentials.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 dark:bg-[#010404] font-sans selection:bg-blue-500/30 overflow-hidden transition-colors duration-500">
            {/* Background glowing blobs */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[100px] rounded-full" />
            </div>

            {/* Theme Toggle Button */}
            <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="fixed top-8 right-8 z-[100] p-3 rounded-2xl bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] text-slate-600 dark:text-slate-400 hover:scale-110 active:scale-95 transition-all shadow-xl shadow-black/5 cursor-pointer"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Core Content Layout */}
            <div className="flex min-h-screen relative z-10">
                
                {/* --- LEFT VISUAL ILLUSTRATION PANEL --- */}
                <div className="relative w-[58%] hidden lg:flex flex-col justify-between p-16 overflow-hidden bg-slate-100 dark:bg-[#090d16] border-r border-slate-200 dark:border-white/5 transition-colors duration-500">
                    {/* Background subtle illustration */}
                    <div className="absolute inset-0 z-0">
                        <img 
                            src="/assets/login_illustration.png" 
                            alt="ERP Background" 
                            className="w-full h-full object-cover opacity-80 dark:opacity-60 mix-blend-luminosity dark:mix-blend-normal transition-opacity duration-500" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-slate-50/20 via-slate-100/10 to-slate-200/5 dark:from-[#010404]/40 dark:via-[#090d16]/20 dark:to-transparent" />
                    </div>
                    
                    {/* Branding Logo & Header */}
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative z-10 flex items-center gap-4"
                    >
                        <div className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-2xl flex items-center justify-center border border-slate-100 dark:border-[#30363d] shadow-xl">
                            <img src="/mano-logo.svg" alt="MANO logo" className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-none">
                                MANO <span className="text-blue-600 dark:text-blue-400 not-italic font-medium opacity-80">ERP</span>
                            </h1>
                            <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.4em] mt-1">Enterprise Operations Portal</span>
                        </div>
                    </motion.div>

                    {/* Central Text/Slogan */}
                    <div className="relative z-10 my-auto max-w-lg space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-4"
                        >
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight uppercase">
                                Precision <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Operations.</span>
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                                Unify your design documentation, resources, client relations, and task workflows in a single, high-performance platform.
                            </p>
                        </motion.div>
                    </div>

                    {/* Footer info in left pane */}
                    <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                        <span className="font-bold uppercase tracking-widest">© {new Date().getFullYear()} MANO-ERP</span>
                    </div>
                </div>

                {/* --- RIGHT FORM PANEL --- */}
                <div className="relative flex flex-col justify-center w-full lg:w-[42%] z-10 bg-white dark:bg-[#010101] transition-colors duration-500 shadow-[-20px_0_60px_rgba(0,0,0,0.02)] dark:shadow-none p-8 lg:p-24">
                    <div className="w-full max-w-md mx-auto space-y-10">
                        {/* Header */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase mb-3">Sign In</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-normal tracking-tight">Enter your credentials to access the enterprise dashboard.</p>
                        </motion.div>

                        {/* Form */}
                        <motion.form
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            onSubmit={handleSubmit}
                            className="space-y-6"
                        >
                            {/* Email/Identifier Field */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 px-1">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-5 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Password
                                    </label>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#30363d] rounded-2xl py-4 pl-14 pr-12 text-slate-900 dark:text-white font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1 cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me Checkbox */}
                            <div className="flex items-center justify-between px-1">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-5 h-5 rounded-lg border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#0d1117] flex items-center justify-center transition-all peer-checked:bg-blue-600 peer-checked:border-blue-600 group-hover:scale-105">
                                        <svg
                                            className={`w-3.5 h-3.5 text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="3.5"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-100">
                                        Remember me for 30 days
                                    </span>
                                </label>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[1.25rem] text-sm font-bold uppercase tracking-tight flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : (
                                        <>
                                            Sign In
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.form>
                    </div>
                </div>

            </div>
        </div>
    );
}
