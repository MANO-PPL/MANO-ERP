import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const LogoLoader = ({ text = "Loading data...", message, size = "md", fullPage = true, fullScreen, isSuperAdmin = false }) => {
    const isFullScreen = fullScreen !== undefined ? fullScreen : fullPage;
    const displayMessage = message || text;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={
                isFullScreen 
                    ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#010404] transition-colors duration-500 font-sans select-none"
                    : "w-full h-full min-h-[250px] flex flex-col items-center justify-center bg-transparent transition-colors duration-500 font-sans select-none p-6 relative overflow-hidden"
            }
        >
            {/* Background Ambient Blurs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.15, 1],
                        opacity: [0.3, 0.45, 0.3]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className={
                        isFullScreen 
                            ? "absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full"
                            : "absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[60px] rounded-full"
                    }
                />
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.4, 0.3]
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2
                    }}
                    className={
                        isFullScreen 
                            ? "absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 dark:bg-violet-600/10 blur-[100px] rounded-full"
                            : "absolute bottom-[10%] right-[10%] w-[35%] h-[35%] bg-violet-600/5 dark:bg-violet-600/10 blur-[50px] rounded-full"
                    }
                />
            </div>

            {/* Core Loading Container */}
            <div className="relative z-10 flex flex-col items-center gap-4 text-center px-4 max-w-sm">
                {/* Brand Icon Outer Container */}
                <div className="relative flex items-center justify-center">
                    {/* Pulsing Outer Gradient Ring */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute w-20 h-20 rounded-[1.5rem] bg-gradient-to-tr from-indigo-500 to-violet-500 opacity-20 dark:opacity-30 blur-md" 
                    />
                    
                    {/* Rotating Spinner Border */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute w-16 h-16 rounded-[1rem] border-2 border-indigo-500/10 border-t-indigo-500 dark:border-indigo-400/10 dark:border-t-indigo-400" 
                    />
                    
                    {/* Central Icon Box */}
                    <motion.div 
                        initial={{ scale: 0.8, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        className="w-12 h-12 bg-white dark:bg-[#0d1117] rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-[#30363d] shadow-2xl relative overflow-hidden p-2.5"
                    >
                        {isSuperAdmin ? (
                            <ShieldAlert className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                        ) : (
                            <img src="/mano-logo.svg" alt="MANO" className="w-full h-full object-contain" />
                        )}
                    </motion.div>
                </div>

                {/* Loading Status Information */}
                <div className="space-y-1.5 mt-2">
                    <motion.h2 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.35em]"
                    >
                        MANO <span className="text-indigo-600 dark:text-indigo-400 font-medium">{isSuperAdmin ? 'INTERNAL' : 'ERP PLATFORM'}</span>
                    </motion.h2>
                    {displayMessage && (
                        <motion.p 
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase"
                        >
                            {displayMessage}
                        </motion.p>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default LogoLoader;
