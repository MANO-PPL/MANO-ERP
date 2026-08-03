import React from 'react';

const LogoLoader = ({ text = "Loading data...", size = "md", fullPage = true }) => {
    const sizeMap = {
        sm: { logo: "w-7 h-7", ring: "w-14 h-14", font: "text-xs" },
        md: { logo: "w-10 h-10", ring: "w-20 h-20", font: "text-xs" },
        lg: { logo: "w-14 h-14", ring: "w-28 h-28", font: "text-sm" }
    };

    const s = sizeMap[size] || sizeMap.md;

    const content = (
        <div className="w-full flex flex-col items-center justify-center p-6 text-center space-y-3 select-none mx-auto my-auto">
            <div className="relative flex items-center justify-center mx-auto">
                {/* Outer spinning gradient ring */}
                <div className={`${s.ring} rounded-full border-2 border-purple-500/20 border-t-purple-600 dark:border-t-purple-400 border-r-blue-500 animate-spin`} />
                
                {/* Inner reverse spinning ring */}
                <div className={`${s.ring} absolute inset-0 rounded-full border-2 border-transparent border-b-indigo-500/60 border-l-purple-500/40 animate-[spin_1.5s_linear_infinite_reverse]`} />
                
                {/* MANO-ERP Logo in center with gentle pulsing */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <img
                        src="/mano-logo.svg"
                        alt="MANO ERP Logo"
                        className={`${s.logo} object-contain drop-shadow-md animate-pulse`}
                    />
                </div>
            </div>

            {text && (
                <div className="space-y-0.5 text-center">
                    <p className={`${s.font} font-bold tracking-tight text-gray-700 dark:text-gray-300`}>
                        {text}
                    </p>
                </div>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center bg-white/60 dark:bg-[#0d1117]/60 backdrop-blur-xs mx-auto my-auto">
                {content}
            </div>
        );
    }

    return (
        <div className="w-full flex items-center justify-center mx-auto">
            {content}
        </div>
    );
};

export default LogoLoader;
