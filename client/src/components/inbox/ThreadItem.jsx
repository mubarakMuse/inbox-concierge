import { decodeHtmlEntities } from '../../utils/decodeHtml.js'

export default function ThreadItem({ thread, bucketMeta }) {
  const reason = thread.reason ? decodeHtmlEntities(thread.reason) : null

  return (
    <article className="thread-card" role="listitem">
      <div className="thread-card-top">
        <h3 className="thread-subject">{decodeHtmlEntities(thread.subject)}</h3>
        {reason && (
          <span className="thread-reason-badge" title={reason}>
            {reason}
          </span>
        )}
      </div>
      <p className="thread-snippet">{decodeHtmlEntities(thread.snippet)}</p>
      {bucketMeta && (
        <span
          className="thread-bucket-tag"
          style={{ '--tag-color': bucketMeta.color, '--tag-bg': bucketMeta.bg }}
        >
          {bucketMeta.icon} {bucketMeta.label}
        </span>
      )}
    </article>
  )
}
