export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="loading-screen">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}
