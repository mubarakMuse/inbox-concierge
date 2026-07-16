import { getClassifyStage } from '../../utils/buckets.js'

export default function ClassifyExperience({ done, total }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  const stage = getClassifyStage(done, total)

  return (
    <div className="classify-overlay" role="dialog" aria-modal="true" aria-labelledby="classify-title">
      <div className="classify-card">
        <div className="classify-ring-wrap" aria-hidden="true">
          <svg className="classify-ring" viewBox="0 0 120 120">
            <circle className="classify-ring-bg" cx="60" cy="60" r="52" />
            <circle
              className="classify-ring-fill"
              cx="60"
              cy="60"
              r="52"
              style={{ strokeDashoffset: 327 - (327 * pct) / 100 }}
            />
          </svg>
          <span className="classify-pct">{pct}%</span>
        </div>
        <h2 id="classify-title" className="classify-title">Sorting your inbox</h2>
        <p className="classify-stage" aria-live="polite">{stage}</p>
        <p className="classify-count">{done} of {total || '…'} threads</p>
      </div>
    </div>
  )
}
