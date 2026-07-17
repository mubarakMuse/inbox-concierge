import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BucketsPanel from './BucketsPanel.jsx'

describe('BucketsPanel', () => {
  const buckets = [
    { id: 'important', name: 'Important', is_default: true },
    { id: 'vip', name: 'VIP', is_default: false },
  ]

  it('disables add-bucket form while classifying', () => {
    render(
      <BucketsPanel
        open
        buckets={buckets}
        needClassify={false}
        classifying
        newBucketName="Work"
        creatingBucket={false}
        removingBucketId={null}
        onNewBucketNameChange={vi.fn()}
        onCreateBucket={vi.fn()}
        onRemoveBucket={vi.fn()}
        onRecategorize={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/new bucket name/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /add bucket and recategorize/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /re-run ai on cached mail/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /remove bucket vip/i })).toBeDisabled()
  })

  it('enables add-bucket form when not classifying', () => {
    render(
      <BucketsPanel
        open
        buckets={buckets}
        needClassify={false}
        classifying={false}
        newBucketName="Work"
        creatingBucket={false}
        removingBucketId={null}
        onNewBucketNameChange={vi.fn()}
        onCreateBucket={vi.fn()}
        onRemoveBucket={vi.fn()}
        onRecategorize={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/new bucket name/i)).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /add bucket and recategorize/i })).not.toBeDisabled()
  })
})
