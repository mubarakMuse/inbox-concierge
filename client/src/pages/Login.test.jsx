import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Login from './Login';

vi.mock('../api/index.js', () => ({
  getAuthUrl: vi.fn(),
  getAuthStatus: vi.fn(),
}))

const { getAuthUrl, getAuthStatus } = await import('../api/index.js')

describe('Login', () => {
  beforeEach(() => {
    vi.mocked(getAuthUrl).mockReset();
    vi.mocked(getAuthStatus).mockReset();
  });

  it('renders title and Connect Gmail button', () => {
    render(<Login onConnect={() => {}} />);
    expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect gmail/i })).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<Login onConnect={() => {}} />)
    expect(screen.getByText(/sorted into clear buckets/i)).toBeInTheDocument()
  })

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

  it('calls onConnect when URL has auth=success', async () => {
    const onConnect = vi.fn();
    vi.mocked(getAuthStatus).mockResolvedValue({ connected: true, hasTokens: true });
    Object.defineProperty(window, 'location', {
      value: { search: '?auth=success', pathname: '/' },
      writable: true,
    });
    window.history.replaceState = vi.fn();
    render(<Login onConnect={onConnect} />);
    await vi.waitFor(() => {
      expect(onConnect).toHaveBeenCalled();
    });
  });
});
