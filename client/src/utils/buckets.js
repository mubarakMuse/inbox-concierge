export const BUCKET_META = {
  important: {
    icon: '⚡',
    color: '#b42318',
    bg: '#fef3f2',
    description: 'Urgent threads that need your attention',
  },
  'can-wait': {
    icon: '🕐',
    color: '#1f4b99',
    bg: '#e8eef8',
    description: 'Read later, no rush',
  },
  'auto-archive': {
    icon: '📦',
    color: '#5c5650',
    bg: '#f3f1ec',
    description: 'Receipts, alerts, low-priority noise',
  },
  newsletter: {
    icon: '📰',
    color: '#0f766e',
    bg: '#f0fdfa',
    description: 'Subscriptions, digests, marketing',
  },
  other: {
    icon: '📁',
    color: '#3d5a80',
    bg: '#eef2f6',
    description: 'Everything else',
  },
}

export const getBucketMeta = (bucket) => {
  const preset = BUCKET_META[bucket.id]
  if (preset) return { ...preset, label: bucket.name }
  return {
    label: bucket.name,
    icon: '✨',
    color: '#1f4b99',
    bg: '#e8eef8',
    description: 'Your custom bucket',
  }
}

export const CLASSIFY_STAGES = [
  { until: 0.08, message: 'Connecting to Gmail…' },
  { until: 0.25, message: 'Fetching your latest threads…' },
  { until: 0.55, message: 'Reading subjects and snippets…' },
  { until: 0.85, message: 'Sorting into Important first…' },
  { until: 1, message: 'Almost done — saving results…' },
]

export const getClassifyStage = (done, total) => {
  if (!total) return CLASSIFY_STAGES[0].message
  const ratio = done / total
  return CLASSIFY_STAGES.find((s) => ratio <= s.until)?.message ?? CLASSIFY_STAGES.at(-1).message
}
