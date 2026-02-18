import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';
import { act } from 'react';

const TestComponent = () => {
  const { addToast } = useToast();

  return (
    <button onClick={() => addToast({ variant: 'success', message: 'Success!' })}>
      Add Toast
    </button>
  );
};

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds and removes a toast message', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));

    expect(screen.getByText('Success!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('removes a toast message when clicked', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));

    const toast = screen.getByText('Success!');
    expect(toast).toBeInTheDocument();

    fireEvent.click(toast);

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });
});
