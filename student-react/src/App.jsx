import './App.css'

function App() {
  return (
    <div className="page student-page student-react-shell">
      <header className="student-react-header">
        <h1>Vysti Marker — Student (React)</h1>
        <p className="student-react-subtitle">
          UI shell only. Dropzone and preview will be wired next.
        </p>
      </header>

      <div className="marker-grid">
        <section className="card form-card">
          <h2>Upload (Placeholder)</h2>
          <div className="student-react-placeholder">
            <p>Dropzone goes here.</p>
          </div>
        </section>

        <section className="card upload-card">
          <h2>Preview Panel</h2>
          <div className="student-react-placeholder">
            <p>Marked preview will render here.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
