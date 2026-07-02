export default function AddBucketForm({ value, onChange, onSubmit, disabled }) {
  return (
    <form className="add-bucket-form" onSubmit={onSubmit} aria-label="Add new bucket">
      <input
        type="text"
        className="input"
        placeholder="New bucket name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="New bucket name"
      />
      <button
        type="submit"
        className="btn btn-primary btn-compact"
        disabled={disabled || !value.trim()}
        aria-label="Add bucket and recategorize"
      >
        Add
      </button>
    </form>
  )
}
