// src/tests/components/common/Alert.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '@/app/components/common/Alert';

describe('Alert', () => {
  it('renders with default props', () => {
    render(
      <Alert title="Test Alert" description="This is a test alert" />
    );
    
    expect(screen.getByRole('alert')).toHaveClass('bg-green-500/10');
    expect(screen.getByText('Test Alert')).toBeInTheDocument();
    expect(screen.getByText('This is a test alert')).toBeInTheDocument();
  });

  it('renders different variants correctly', () => {
    const { rerender } = render(
      <Alert variant="error" title="Error" description="Error message" />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-red-500/10');

    rerender(
      <Alert variant="warning" title="Warning" description="Warning message" />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-500/10');

    rerender(
      <Alert variant="success" title="Success" description="Success message" />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-emerald-500/10');
  });

  it('renders children components correctly', () => {
    render(
      <Alert>
        <AlertTitle>Custom Title</AlertTitle>
        <AlertDescription>Custom Description</AlertDescription>
      </Alert>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
  });
});