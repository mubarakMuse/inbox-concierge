import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./api', () => ({
  getAuthStatus: vi.fn(),
  getBucketsWithCounts: vi.fn().mockResolvedValue({ buckets: [], counts: {} }),
  getThreads: vi.fn().mockResolvedValue({ threads: [], needClassify: false }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  deleteAllMyData: vi.fn(),
  createBucket: vi.fn(),
  deleteBucket: vi.fn(),
  getAuthUrl: vi.fn(),
  classifyWithProgress: vi.fn(),
  recategorize: vi.fn(),
}));

const { getAuthStatus } = await import('./api');

describe('App', () => {
  beforeEach(() => {
    vi.mocked(getAuthStatus).mockReset();
  });

  it('shows loading until auth check completes', async () => {
    let resolve;
    vi.mocked(getAuthStatus).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    resolve({ connected: false });
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  it('shows Login when not connected', async () => {
    vi.mocked(getAuthStatus).mockResolvedValue({ connected: false });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
  });

  it('redirects to inbox when connected', async () => {
    vi.mocked(getAuthStatus).mockResolvedValue({ connected: true });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('main', { name: /email list/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
  });

  it('shows Login again after disconnect from inbox', async () => {
    vi.mocked(getAuthStatus).mockResolvedValue({ connected: true });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disconnect gmail/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /disconnect gmail/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
    });
  });
});
