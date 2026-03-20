import { useState } from 'react'
import './App.css'
import UploadZone from './components/UploadZone.jsx'
import ResultPanel from './components/ResultPanel.jsx'
import DiffView from './components/DiffView.jsx'
import { generateHtmlReport, generateMarkdownReport } from './utils/reportExport.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

function App() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [vlmResult, setVlmResult] = useState(null)
  const [ocrLlmResult, setOcrLlmResult] = useState(null)
  const [vlmTimeMs, setVlmTimeMs] = useState(0)
  const [ocrLlmTimeMs, setOcrLlmTimeMs] = useState(0)
  const [ocrRawText, setOcrRawText] = useState('')
  const [vlmError, setVlmError] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [activeView, setActiveView] = useState('side-by-side')
  const [fileName, setFileName] = useState('')
  const [vlmInputTokens, setVlmInputTokens] = useState(0)
  const [vlmOutputTokens, setVlmOutputTokens] = useState(0)
  const [ocrInputTokens, setOcrInputTokens] = useState(0)
  const [ocrOutputTokens, setOcrOutputTokens] = useState(0)

  async function handleUpload(file) {
    setIsProcessing(true)
    setError('')
    setVlmError('')
    setOcrError('')
    setVlmResult(null)
    setOcrLlmResult(null)
    setVlmTimeMs(0)
    setOcrLlmTimeMs(0)
    setOcrRawText('')
    setFileName(file.name)
    setVlmInputTokens(0)
    setVlmOutputTokens(0)
    setOcrInputTokens(0)
    setOcrOutputTokens(0)

    const form = new FormData()
    form.append('file', file)

    try {
      const resp = await fetch(`${API_BASE}/api/benchmark`, {
        method: 'POST',
        body: form,
      })

      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({}))
        throw new Error(detail?.detail || `Request failed with status ${resp.status}`)
      }

      const data = await resp.json()

      setVlmResult(data.vlm_result)
      setOcrLlmResult(data.ocr_llm_result)
      setVlmTimeMs(data.vlm_time_ms || 0)
      setOcrLlmTimeMs(data.ocr_llm_time_ms || 0)
      setOcrRawText(data.ocr_raw_text || '')
      setVlmInputTokens(data.vlm_input_tokens || 0)
      setVlmOutputTokens(data.vlm_output_tokens || 0)
      setOcrInputTokens(data.ocr_input_tokens || 0)
      setOcrOutputTokens(data.ocr_output_tokens || 0)

      if (data.vlm_error) setVlmError(data.vlm_error)
      if (data.ocr_llm_error) setOcrError(data.ocr_llm_error)
    } catch (err) {
      setError(err?.message || 'Benchmark failed')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleReset() {
    setIsProcessing(false)
    setError('')
    setVlmError('')
    setOcrError('')
    setVlmResult(null)
    setOcrLlmResult(null)
    setVlmTimeMs(0)
    setOcrLlmTimeMs(0)
    setOcrRawText('')
    setFileName('')
    setActiveView('side-by-side')
    setVlmInputTokens(0)
    setVlmOutputTokens(0)
    setOcrInputTokens(0)
    setOcrOutputTokens(0)
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleDownloadHtml() {
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'benchmark'
    const html = generateHtmlReport({
      fileName, vlmResult, ocrLlmResult, vlmTimeMs, ocrLlmTimeMs,
      vlmInputTokens, vlmOutputTokens, ocrInputTokens, ocrOutputTokens,
    })
    downloadFile(html, `${baseName}_benchmark.html`, 'text/html')
  }

  function handleDownloadMarkdown() {
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'benchmark'
    const md = generateMarkdownReport({
      fileName, vlmResult, ocrLlmResult, vlmTimeMs, ocrLlmTimeMs,
      vlmInputTokens, vlmOutputTokens, ocrInputTokens, ocrOutputTokens,
    })
    downloadFile(md, `${baseName}_benchmark.md`, 'text/markdown')
  }

  const hasResults = vlmResult || ocrLlmResult

  const speedRatio =
    vlmTimeMs > 0 && ocrLlmTimeMs > 0
      ? (ocrLlmTimeMs / vlmTimeMs).toFixed(1)
      : null

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">VLM vs OCR+LLM</div>
          <div className="brand-sub">Structured Data Extraction Benchmark</div>
        </div>
        {hasResults && (
          <div className="header-actions">
            <nav className="view-toggle">
              <button
                className={activeView === 'side-by-side' ? 'active' : ''}
                onClick={() => setActiveView('side-by-side')}
              >
                Side by Side
              </button>
              <button
                className={activeView === 'diff' ? 'active' : ''}
                onClick={() => setActiveView('diff')}
              >
                Diff View
              </button>
            </nav>
            <div className="download-btns">
              <button className="btn-download" onClick={handleDownloadHtml} title="Download as HTML report">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                HTML
              </button>
              <button className="btn-download" onClick={handleDownloadMarkdown} title="Download as Markdown for GitHub">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                MD
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Summary bar */}
      {hasResults && (
        <div className="summary-bar">
          <div className="summary-card">
            <div className="summary-left">
              <span className="summary-label">VLM (Vision)</span>
              <span className="token-info">In: {vlmInputTokens.toLocaleString()} | Out: {vlmOutputTokens.toLocaleString()}</span>
            </div>
            <span className="summary-value vlm">
              {(vlmTimeMs / 1000).toFixed(1)}
              <span className="summary-unit">s</span>
            </span>
          </div>
          <div className="summary-card">
            <div className="summary-left">
              <span className="summary-label">OCR + LLM</span>
              <span className="token-info">In: {ocrInputTokens.toLocaleString()} | Out: {ocrOutputTokens.toLocaleString()}</span>
            </div>
            <span className="summary-value ocr">
              {(ocrLlmTimeMs / 1000).toFixed(1)}
              <span className="summary-unit">s</span>
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Speed Comparison</span>
            <span className="summary-value faster">
              {speedRatio
                ? vlmTimeMs < ocrLlmTimeMs
                  ? `VLM ${speedRatio}x faster`
                  : `OCR ${(vlmTimeMs / ocrLlmTimeMs).toFixed(1)}x faster`
                : '--'}
            </span>
          </div>
        </div>
      )}

      {/* Main content area */}
      <main className="main-content">
        {!hasResults && !isProcessing && !error && (
          <UploadZone onUpload={handleUpload} />
        )}

        {!hasResults && !isProcessing && error && (
          <div className="loading-overlay">
            <div className="error-card">
              <div className="error-icon">!</div>
              <p className="error-title">Benchmark Failed</p>
              <p className="error-detail">{error}</p>
              <button className="btn-retry" onClick={handleReset}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p className="loading-text">Running benchmark...</p>
            <p className="loading-sub">
              Extracting with VLM and OCR+LLM concurrently
            </p>
          </div>
        )}

        {hasResults && activeView === 'side-by-side' && (
          <div className="split">
            <ResultPanel
              title="VLM (Vision)"
              result={vlmResult}
              timeMs={vlmTimeMs}
              error={vlmError}
              variant="vlm"
              compareWith={ocrLlmResult}
              inputTokens={vlmInputTokens}
              outputTokens={vlmOutputTokens}
            />
            <ResultPanel
              title="OCR + LLM"
              result={ocrLlmResult}
              timeMs={ocrLlmTimeMs}
              error={ocrError}
              ocrText={ocrRawText}
              variant="ocr"
              compareWith={vlmResult}
              inputTokens={ocrInputTokens}
              outputTokens={ocrOutputTokens}
            />
          </div>
        )}

        {hasResults && activeView === 'diff' && (
          <DiffView vlmResult={vlmResult} ocrLlmResult={ocrLlmResult} />
        )}
      </main>

      {error && <div className="error-bar">{error}</div>}

      <footer className="app-footer">
        <span className="muted">
          {fileName ? `File: ${fileName}` : 'gemini-2.5-flash | Both paths use identical schema & prompts'}
        </span>
        {hasResults && (
          <button className="btn-reset" onClick={handleReset}>
            New Benchmark
          </button>
        )}
      </footer>
    </div>
  )
}

export default App
