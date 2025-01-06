// src/app/components/common/Card.tsx 

import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'system';
  className?: string;
}

export const Card = ({
  title,
  children,
  variant = 'default',
  className = ''
}: CardProps) => {
  const variants = {
    default: 'bg-[#0D0E15] border border-zinc-900 rounded-3xl',
    system: 'bg-[#0D0E15] border border-zinc-900 text-[#DDDDDD] font-ia rounded-3xl'
  };

  return (
    <div className={`${variants[variant]} p-4 rounded-3xl ${className}`}>
      {title && (
        <h3 className="text-base font-ia mb-4">
          {variant === 'system' ? `> ${title}` : title}
        </h3>
      )}
      {children}
    </div>
  );
};