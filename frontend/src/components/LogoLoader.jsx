import React from 'react';
import { motion } from 'framer-motion';

const LogoLoader = ({ text = "Loading data...", size = "md", fullPage = true }) => {
    const sizeMap = {
        sm: {
            box: "w-10 h-10 rounded-lg p-2",
            ringOuter: "w-14 h-14 rounded-[1.2rem]",
            ringBorder: "w-12 h-12 rounded-[0.8rem]",
            title: "text-[10px] tracking-[0.25em]",
            sub: "text-[8px]"
        },
        md: {
            box: "w-12 h-12 rounded-xl p-2.5",
            ringOuter: "w-20 h-20 rounded-[1.5rem]",
            ringBorder: "w-16 h-16 rounded-[1rem]",
            title: "text-xs tracking-[0.35em]",
            sub: "text-[9px]"
        },
        lg: {
            box: "w-14 h-14 rounded-2xl p-3",
            ringOuter: "w-24 h-24 rounded-[1.8rem]",
            ringBorder: "w-20 h-20 rounded-[1.2rem]",
            title: "text-xs md:text-sm tracking-[0.35em]",
            sub: "text-[9px] md:text-[10px]"
        }
    };

    const s = sizeMap[size] || sizeMap.md;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={
                fullPage 
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
                        fullPage 
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
                        fullPage 
                            ? "absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 dark:bg-violet-600/10 blur-[100px] rounded-full"
                            : "absolute bottom-[10%] right-[10%] w-[35%] h-[35%] bg-violet-600/5 dark:bg-violet-600/10 blur-[50px] rounded-full"
                    }
                />
            </div>

            {/* Core Brand Icon & Status Container */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-4 text-center px-4 max-w-sm">
                {/* Brand Icon Outer Container */}
                <div className="relative flex items-center justify-center">
                    {/* Pulsing Outer Gradient Ring */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.2, 0.45, 0.2]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className={`absolute ${s.ringOuter} bg-gradient-to-tr from-indigo-500 to-violet-500 opacity-25 dark:opacity-35 blur-md`}
                    />
                    
                    {/* Rotating Spinner Border */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className={`absolute ${s.ringBorder} border-2 border-indigo-500/20 border-t-indigo-500 dark:border-indigo-400/20 dark:border-t-indigo-400`}
                    />
                    
                    {/* Central Logo - Clean and transparent without black background card */}
                    <motion.div 
                        initial={{ scale: 0.8, y: 5 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        className={`${s.box} flex items-center justify-center relative`}
                    >
                        <img src="/mano-logo.svg" alt="MANO" className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(99,102,241,0.4)]" />
                    </motion.div>
                </div>

                {/* Loading Header & Message */}
                <div className="space-y-1.5 mt-1">
                    <motion.h2 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`${s.title} font-black text-slate-800 dark:text-white uppercase`}
                    >
                        MANO <span className="text-indigo-600 dark:text-indigo-400 font-medium">ERP PLATFORM</span>
                    </motion.h2>
                    {text && (
                        <motion.p 
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className={`${s.sub} text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase`}
                        >
                            {text}
                        </motion.p>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default LogoLoader;
