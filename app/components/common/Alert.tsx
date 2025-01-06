// src/app/components/common/Alert.tsx

import React from 'react';
import { X } from 'lucide-react';

interface AlertProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'error' | 'warning' | 'success';
  children?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantStyles = {
  default: {
    container: 'bg-green-500/10 border-green-500 text-green-500',
    icon: 'text-green-500'
  },
  error: {
    container: 'bg-red-500/10 border-red-500 text-red-500',
    icon: 'text-red-500'
  },
  warning: {
    container: 'bg-yellow-500/10 border-yellow-500 text-yellow-500',
    icon: 'text-yellow-500'
  },
  success: {
    container: 'bg-emerald-500/10 border-emerald-500 text-emerald-500',
    icon: 'text-emerald-500'
  }
};

export const Alert = ({
  title,
  description,
  variant = 'default',
  dismissible = false,
  onDismiss,
  className = ''
}: AlertProps) => {
  const styles = variantStyles[variant];

  return (
    <div
      className={`
        font-ia border rounded-lg p-4 relative
        ${styles.container}
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          {title && (
            <div className="flex items-center gap-2 mb-1">
              <h5 className="font-bold uppercase tracking-wider text-sm">
                [{title}]
              </h5>
            </div>
          )}
          {description && (
            <div className="text-sm">
              {description}
            </div>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={`
              ${styles.icon} hover:opacity-70 transition-opacity
              p-1 rounded-lg border border-current
            `}
            aria-label="Dismiss alert"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// Export alert title and description components for composability
export const AlertTitle = ({ children }: { children: React.ReactNode }) => (
  <h5 className="font-bold uppercase tracking-wider text-sm mb-1">
    [{children}]
  </h5>
);

export const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm">{children}</div>
);