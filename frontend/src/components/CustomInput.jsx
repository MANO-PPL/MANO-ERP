import React from 'react';

const CustomInput = ({ label, type = "text", rows, value, onChange, placeholder, min, max, step, required, className = '', ...props }) => {
    const inputClasses = `w-full bg-white dark:bg-[#1E2433] border border-gray-300 dark:border-[#3A455C] rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 dark:hover:border-[#4B5A78] shadow-sm dark:shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`;

    return (
        <div className="w-full">
            {label && <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
            {rows ? (
                <textarea
                    rows={rows}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className={`${inputClasses} resize-none`}
                    {...props}
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    step={step}
                    required={required}
                    className={inputClasses}
                    {...props}
                />
            )}
        </div>
    );
};

export default CustomInput;
