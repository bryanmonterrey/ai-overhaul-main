// src/app/components/common/Input.tsx

import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  variant?: 'default' | 'system';
  className?: string;
}

export const Input = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  variant = 'default',
  ...props
}: InputProps) => {
  const baseStyles = 'w-full px-4 py-2 focus:outline-none';
  const variants = {
    default: 'font-ia border border-zinc-800 focus:border-black focus:ring-1 focus:ring-black',
    system: 'font-ia bg-black text-white border border-zinc-800 focus:border-white placeholder-white'
  };

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    />
  );
};