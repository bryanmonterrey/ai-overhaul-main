import React from 'react';

interface AlertProps {
  variant?: string;
  className?: string;
  children?: React.ReactNode;
  title?: string;
  description?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ 
  children, 
  variant, 
  className,
  title,
  description 
}, ref) => (
  <div ref={ref} data-testid="alert" data-variant={variant} className={className}>
    {title && <AlertTitle>{title}</AlertTitle>}
    {description && <AlertDescription>{description}</AlertDescription>}
    {children}
  </div>
));

Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => (
    <div ref={ref} data-testid="alert-title">{children}</div>
  )
);

AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => (
    <div ref={ref} data-testid="alert-description">{children}</div>
  )
);

AlertDescription.displayName = 'AlertDescription'; 