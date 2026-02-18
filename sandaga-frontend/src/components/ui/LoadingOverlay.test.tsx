import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react';
import { LoadingOverlay } from './LoadingOverlay';

vi.mock('../../hooks/useGlobalLoading', () => ({
  useGlobalLoading: vi.fn(),
}));

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: vi.fn(),
}));

import * as GlobalLoadingMod from '../../hooks/useGlobalLoading'
import * as I18nMod from '../../contexts/I18nContext'

describe('LoadingOverlay', () => {
  beforeEach(() => {
    vi.mocked(GlobalLoadingMod.useGlobalLoading).mockReturnValue({ isGlobalLoading: true, pendingCount: 1 } as any);
    vi.mocked(I18nMod.useI18n).mockReturnValue({ t: (key: string, params?: any) => (params?.count ? `${key} ${params.count}` : key) } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  it('renders when global loading is active', () => {
    render(<LoadingOverlay />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('loading.global.single…')).toBeInTheDocument();
  });

  it('does not render when global loading is inactive', () => {
    vi.mocked(GlobalLoadingMod.useGlobalLoading).mockReturnValue({ isGlobalLoading: false, pendingCount: 0 } as any);
    render(<LoadingOverlay />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('displays the correct message for multiple pending requests', () => {
    vi.mocked(GlobalLoadingMod.useGlobalLoading).mockReturnValue({ isGlobalLoading: true, pendingCount: 3 } as any);
    render(<LoadingOverlay />);
    expect(screen.getByText('loading.global.multiple 3…')).toBeInTheDocument();
  });
});
