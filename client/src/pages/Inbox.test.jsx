import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Inbox from './Inbox.jsx';

vi.mock('../api/index.js', () => ({
  getBucketsWithCounts: vi.fn(),
  getThreads: vi.fn(),
  classifyWithProgress: vi.fn(),
  resumeJobWithProgress: vi.fn(),
  recategorize: vi.fn(),
  createBucket: vi.fn(),
  deleteBucket: vi.fn(),
  disconnect: vi.fn(),
  deleteAllMyData: vi.fn(),
  moveThread: vi.fn(),
  getActiveJob: vi.fn(),
  getJob: vi.fn(),
  cancelActiveJobPoll: vi.fn(),
  getStoredActiveJobId: vi.fn(),
  clearStoredActiveJobId: vi.fn(),
}));

const api = await import('../api/index.js')

describe('Inbox', () => {
  const defaultBuckets = [
    { id: 'important', name: 'Important', is_default: true },
    { id: 'can-wait', name: 'Can wait', is_default: true },
    { id: 'auto-archive', name: 'Auto-archive', is_default: true },
    { id: 'newsletter', name: 'Newsletter', is_default: true },
    { id: 'other', name: 'Other', is_default: true },
  ];

  beforeEach(() => {
    vi.mocked(api.getBucketsWithCounts).mockResolvedValue({
      buckets: defaultBuckets,
      counts: { important: 2, 'can-wait': 1, 'auto-archive': 0, newsletter: 0, other: 1 },
      lastSortedAt: '2026-07-17T10:00:00.000Z',
    });
    vi.mocked(api.getThreads).mockResolvedValue({ threads: [], needClassify: false });
    vi.mocked(api.getActiveJob).mockResolvedValue({ job: null });
    vi.mocked(api.getStoredActiveJobId).mockReturnValue(null);
    vi.mocked(api.disconnect).mockResolvedValue(undefined);
    vi.mocked(api.moveThread).mockResolvedValue({ thread_id: 't1', bucket_id: 'can-wait', reason: '' });
  });

  it('renders bucket bar and main area', async () => {
    const onDisconnect = vi.fn();
    render(<Inbox onDisconnect={onDisconnect} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /inbox concierge/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /refresh and reclassify inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^buckets$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^account$/i })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /email list/i })).toBeInTheDocument();
  });

  it('shows bucket names and counts', async () => {
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Important.*2 emails/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Other.*1 emails/i })).toBeInTheDocument();
  });

  it('shows summary line when classified', async () => {
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/2 need you · 1 can wait · 1 noise/i)).toBeInTheDocument();
    });
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
    expect(screen.getByRole('link', { name: /open in gmail/i })).toHaveAttribute(
      'href',
      'https://mail.google.com/mail/u/0/#inbox/t1'
    );
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
    vi.mocked(api.getBucketsWithCounts).mockResolvedValue({ buckets: defaultBuckets, counts: {}, lastSortedAt: null });
    vi.mocked(api.getThreads).mockResolvedValue({ threads: [], needClassify: true });
    render(<Inbox onDisconnect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fetch and classify emails/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/ready when you are/i)).toBeInTheDocument();
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

  it('calls onDisconnect when disconnect is clicked from Account', async () => {
    const onDisconnect = vi.fn();
    render(<Inbox onDisconnect={onDisconnect} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^account$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^account$/i }));
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
    vi.mocked(api.createBucket).mockResolvedValue({ id: 'my-bucket', name: 'My Bucket', is_default: false })
    vi.mocked(api.getBucketsWithCounts).mockResolvedValueOnce({ buckets: defaultBuckets, counts: {}, lastSortedAt: null })
    render(<Inbox onDisconnect={() => {}} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^buckets$/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^buckets$/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/new bucket name/i)).toBeInTheDocument()
    })
    const input = screen.getByLabelText(/new bucket name/i)
    const addBtn = screen.getByRole('button', { name: /add bucket and recategorize/i })
    fireEvent.change(input, { target: { value: 'My Bucket' } })
    expect(addBtn).not.toBeDisabled()
    fireEvent.click(addBtn)
    await waitFor(() => {
      expect(api.createBucket).toHaveBeenCalledWith('My Bucket')
    })
  })

  it('shows AI reason on thread card', async () => {
    vi.mocked(api.getThreads).mockResolvedValue({
      threads: [{ id: 't1', subject: 'Subj', snippet: '', reason: 'Because it is urgent' }],
      needClassify: false,
    })
    render(<Inbox onDisconnect={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('Because it is urgent')).toBeInTheDocument()
    })
  })

  it('moves thread when wrong-bucket chip is clicked', async () => {
    vi.mocked(api.getThreads).mockResolvedValue({
      threads: [{ id: 't1', subject: 'Move me', snippet: 'x', reason: 'Maybe important' }],
      needClassify: false,
    })
    render(<Inbox onDisconnect={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('Move me')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /move to wait/i }))
    await waitFor(() => {
      expect(api.moveThread).toHaveBeenCalledWith('t1', 'can-wait')
    })
  })

  it('shows delete all data link and confirm flow', async () => {
    vi.mocked(api.deleteAllMyData).mockResolvedValue({})
    const onDisconnect = vi.fn()
    render(<Inbox onDisconnect={onDisconnect} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^account$/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^account$/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete all my data/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /delete all my data/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete all$/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^delete all$/i }))
    await waitFor(() => {
      expect(api.deleteAllMyData).toHaveBeenCalled()
      expect(onDisconnect).toHaveBeenCalled()
    })
  })
});
