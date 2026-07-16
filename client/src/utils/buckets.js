export const BUCKET_META = {
  important: {
    icon: '⚡',
    color: '#ef4444',
    bg: '#fef2f2',
    description: 'Urgent threads that need your attention',
  },
  'can-wait': {
    icon: '🕐',
    color: '#3b82f6',
    bg: '#eff6ff',
    description: 'Read later, no rush',
  },
  'auto-archive': {
    icon: '📦',
    color: '#64748b',
    bg: '#f1f5f9',
    description: 'Receipts, alerts, low-priority noise',
  },
  newsletter: {
    icon: '📰',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    description: 'Subscriptions, digests, marketing',
  },
  other: {
    icon: '📁',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    description: 'Everything else',
  },
}

export const getBucketMeta = (bucket) => {
  const preset = BUCKET_META[bucket.id]
  if (preset) return { ...preset, label: bucket.name }
  return {
    label: bucket.name,
    icon: '✨',
    color: '#6366f1',
    bg: '#eef2ff',
    description: 'Your custom bucket',
  }
}

export const CLASSIFY_STAGES = [
  { until: 0.08, message: 'Connecting to Gmail…' },
  { until: 0.25, message: 'Fetching your latest threads…' },
  { until: 0.55, message: 'Reading subjects and snippets…' },
  { until: 0.85, message: 'AI is sorting into buckets…' },
  { until: 1, message: 'Almost done — saving results…' },
]

export const getClassifyStage = (done, total) => {
  if (!total) return CLASSIFY_STAGES[0].message
  const ratio = done / total
  return CLASSIFY_STAGES.find((s) => ratio <= s.until)?.message ?? CLASSIFY_STAGES.at(-1).message
}
