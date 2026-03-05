import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Login from './Login';

vi.mock('../api', () => ({
  getAuthUrl: vi.fn(),
}));

const { getAuthUrl } = await import('../api');

describe('Login', () => {
  beforeEach(() => {
    vi.mocked(getAuthUrl).mockReset();
  });

  it('renders title and Connect Gmail button', () => {
    render(<Login onConnect={() => {}} />);
    expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<Login onConnect={() => {}} />);
    expect(screen.getByText(/group your gmail into buckets with ai/i)).toBeInTheDocument();
  });

  it('calls getAuthUrl when Connect Gmail is clicked', async () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, get href() { return 'http://localhost/'; }, set href(v) { hrefSetter(v); } },
      writable: true,
    });
    vi.mocked(getAuthUrl).mockResolvedValue('https://accounts.google.com/o/oauth2/auth');
    render(<Login onConnect={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /connect gmail/i }));
    await vi.waitFor(() => {
      expect(getAuthUrl).toHaveBeenCalled();
    });
    expect(hrefSetter).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/auth');
  });

  it('calls onConnect when URL has auth=success', () => {
    const onConnect = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { search: '?auth=success', replaceState: vi.fn(), pathname: '/' },
      writable: true,
    });
    render(<Login onConnect={onConnect} />);
    expect(onConnect).toHaveBeenCalled();
  });
});
