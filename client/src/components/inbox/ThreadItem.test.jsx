import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThreadItem from './ThreadItem.jsx'

describe('ThreadItem', () => {
  const buckets = [
    { id: 'important', name: 'Important', is_default: true },
    { id: 'can-wait', name: 'Can wait', is_default: true },
    { id: 'auto-archive', name: 'Auto-archive', is_default: true },
    { id: 'newsletter', name: 'Newsletter', is_default: true },
    { id: 'other', name: 'Other', is_default: true },
    { id: 'vip', name: 'VIP Clients', is_default: false },
  ]

  it('includes custom buckets in move options', () => {
    const onMoveThread = vi.fn()
    render(
      <ThreadItem
        thread={{ id: 't1', subject: 'Hello', snippet: 'x', reason: 'Urgent' }}
        bucketMeta={{ label: 'Important' }}
        currentBucketId="important"
        buckets={buckets}
        onMoveThread={onMoveThread}
        moving={false}
      />
    )

    expect(screen.getByRole('button', { name: /move to vip clients/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move to important/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /move to vip clients/i }))
    expect(onMoveThread).toHaveBeenCalledWith('t1', 'vip')
  })
})
