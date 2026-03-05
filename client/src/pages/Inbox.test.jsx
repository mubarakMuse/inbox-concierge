import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Inbox from './Inbox.jsx';

vi.mock('../api', () => ({
  getBucketsWithCounts: vi.fn(),
  getThreads: vi.fn(),
  classifyWithProgress: vi.fn(),
  recategorize: vi.fn(),
  createBucket: vi.fn(),
  deleteBucket: vi.fn(),
  disconnect: vi.fn(),
  deleteAllMyData: vi.fn(),
}));

const api = await import('../api');

describe('Inbox', () => {
  const defaultBuckets = [
    { id: 'important', name: 'Important', is_default: true },
    { id: 'other', name: 'Other', is_default: true },
  ];

  beforeEach(() => {
    vi.mocked(api.getBucketsWithCounts).mockResolvedValue({ buckets: defaultBuckets, counts: { important: 2, other: 1 } });
    vi.mocked(api.getThreads).mockResolvedValue({ threads: [], needClassify: false });
    vi.mocked(api.disconnect).mockResolvedValue(undefined);
  });

  it('renders sidebar with buckets and main area', async () => {
    const onDisconnect = vi.fn();
    render(<Inbox onDisconnect={onDisconnect} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /disconnect gmail/i })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /email list/i })).toBeInTheDocument();
  });

  it('shows bucket names and counts', async () => {
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Important.*2 emails/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Other.*1 emails/i })).toBeInTheDocument();
  });

  it('shows threads when loaded', async () => {
    vi.mocked(api.getThreads).mockResolvedValue({
      threads: [
        { id: 't1', subject: 'Hello', snippet: 'Snippet one', reason: 'Urgent' },
      ],
      needClassify: false,
    });
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
    expect(screen.getByText('Snippet one')).toBeInTheDocument();
  });

  it('decodes HTML entities in subject and snippet', async () => {
    vi.mocked(api.getThreads).mockResolvedValue({
      threads: [
        { id: 't1', subject: "Don&amp;#39;t miss this", snippet: '&lt;div&gt;', reason: '' },
      ],
      needClassify: false,
    });
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Don't miss this")).toBeInTheDocument();
    });
    expect(screen.getByText('<div>')).toBeInTheDocument();
  });

  it('shows needClassify alert when needClassify is true', async () => {
    vi.mocked(api.getBucketsWithCounts).mockResolvedValue({ buckets: defaultBuckets, counts: {} });
    vi.mocked(api.getThreads).mockResolvedValue({ threads: [], needClassify: true });
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fetch and classify emails/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/emails not classified yet/i)).toBeInTheDocument();
  });

  it('shows error and dismiss button when load fails', async () => {
    vi.mocked(api.getBucketsWithCounts).mockRejectedValue(new Error('Network error'));
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('calls onDisconnect when disconnect is clicked', async () => {
    const onDisconnect = vi.fn();
    render(<Inbox onDisconnect={onDisconnect} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disconnect gmail/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /disconnect gmail/i }));
    await waitFor(() => {
      expect(api.disconnect).toHaveBeenCalled();
      expect(onDisconnect).toHaveBeenCalled();
    });
  });

  it('shows add bucket form and submits new bucket name', async () => {
    vi.mocked(api.createBucket).mockResolvedValue({ id: 'my-bucket', name: 'My Bucket', is_default: false });
    vi.mocked(api.getBucketsWithCounts).mockResolvedValueOnce({ buckets: defaultBuckets, counts: {} });
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/new bucket name/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/new bucket name/i);
    const addBtn = screen.getByRole('button', { name: /add bucket and recategorize/i });
    fireEvent.change(input, { target: { value: 'My Bucket' } });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(api.createBucket).toHaveBeenCalledWith('My Bucket');
    });
  });

  it('expands reason when Why? is clicked', async () => {
    vi.mocked(api.getThreads).mockResolvedValue({
      threads: [{ id: 't1', subject: 'Subj', snippet: '', reason: 'Because it is urgent' }],
      needClassify: false,
    });
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /why this bucket/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /why this bucket/i }));
    await waitFor(() => {
      expect(screen.getByText('Because it is urgent')).toBeInTheDocument();
    });
  });

  it('shows delete all data link and confirm flow', async () => {
    vi.mocked(api.deleteAllMyData).mockResolvedValue({});
    const onDisconnect = vi.fn();
    render(<Inbox onDisconnect={onDisconnect} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete all my data/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete all my data/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete all$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^delete all$/i }));
    await waitFor(() => {
      expect(api.deleteAllMyData).toHaveBeenCalled();
      expect(onDisconnect).toHaveBeenCalled();
    });
  });
});
