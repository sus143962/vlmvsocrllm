import { useState, useMemo } from 'react'
import { getDiffMap, computeWordDiff } from '../utils/jsonDiff.js'

/**
 * Render word-diff segments as React elements.
 * Segments with diff=true get wrapped in <mark>.
 */
function renderSegments(segments) {
  return segments.map((seg, i) =>
    seg.diff
      ? <mark key={i} className="diff-highlight">{seg.text}</mark>
      : <span key={i}>{seg.text}</span>
  )
}

/**
 * Look up a value at a dot-notation path inside a nested object.
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = Array.isArray(cur) ? cur[Number(p)] : cur[p]
  }
  return cur
}

/**
 * Recursively render a JSON value as React elements.
 * Leaf values whose path is in diffMap get word-level highlighting.
 */
function renderJson(value, diffMap, compareWith, currentPath = '', indent = 0) {
  const padInner = '  '.repeat(indent + 1)
  const padClose = '  '.repeat(indent)

  if (value === null) {
    const isDiff = diffMap.has(currentPath)
    if (isDiff) return <mark className="diff-highlight">null</mark>
    return <span className="json-null">null</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{'[]'}</span>
    return (
      <span>
        {'[\n'}
        {value.map((item, i) => {
          const itemPath = currentPath ? `${currentPath}.${i}` : `${i}`
          const isLast = i === value.length - 1
          return (
            <span key={i}>
              {padInner}
              {renderJson(item, diffMap, compareWith, itemPath, indent + 1)}
              {isLast ? '' : ','}{'\n'}
            </span>
          )
        })}
        {padClose}{']'}
      </span>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return <span>{'{}'}</span>
    return (
      <span>
        {'{\n'}
        {entries.map(([key, val], i) => {
          const childPath = currentPath ? `${currentPath}.${key}` : key
          const isLast = i === entries.length - 1
          return (
            <span key={key}>
              {padInner}
              <span className="json-key">{`"${key}"`}</span>
              {': '}
              {renderJson(val, diffMap, compareWith, childPath, indent + 1)}
              {isLast ? '' : ','}{'\n'}
            </span>
          )
        })}
        {padClose}{'}'}
      </span>
    )
  }

  // Leaf value
  const thisStr = typeof value === 'string' ? value : String(value)
  const isString = typeof value === 'string'

  if (diffMap.has(currentPath)) {
    // Get the other side's raw value for word-level comparison
    const otherRaw = getNestedValue(compareWith, currentPath)
    const otherStr = otherRaw != null ? String(otherRaw) : null

    const segments = computeWordDiff(thisStr, otherStr)

    if (isString) {
      return <span>{'"'}{renderSegments(segments)}{'"'}</span>
    }
    return <span>{renderSegments(segments)}</span>
  }

  // No diff – plain rendering
  const formatted = isString ? `"${value}"` : String(value)
  return <span>{formatted}</span>
}

export default function ResultPanel({ title, result, timeMs, error, ocrText, variant, compareWith, inputTokens, outputTokens }) {
  const [showOcr, setShowOcr] = useState(false)
  const dotClass = variant === 'vlm' ? 'vlm' : 'ocr'

  // Compute which paths differ and what the other side's value is
  const diffMap = useMemo(() => {
    if (!result || !compareWith) return new Map()
    return getDiffMap(result, compareWith)
  }, [result, compareWith])

  return (
    <div className="result-panel">
      <div className="panel-header">
        <h2>
          <span className={`method-dot ${dotClass}`} />
          {title}
        </h2>
        <div className="panel-header-right">
          {ocrText && (
            <button
              className={`toggle-ocr-btn ${showOcr ? 'active' : ''}`}
              onClick={() => setShowOcr(!showOcr)}
            >
              {showOcr ? 'Show JSON' : 'Show OCR Text'}
            </button>
          )}
          <span className={`time-badge ${dotClass}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {timeMs ? `${(timeMs / 1000).toFixed(1)}s` : '--'}
          </span>
          {(inputTokens > 0 || outputTokens > 0) && (
            <span className="token-badge">
              In: {inputTokens.toLocaleString()} | Out: {outputTokens.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="panel-error">{error}</div>
      )}

      <div className="panel-body">
        {showOcr ? (
          <pre className="ocr-text">{ocrText}</pre>
        ) : (
          <pre className="json-output">
            {result
              ? renderJson(result, diffMap, compareWith)
              : (error ? '' : 'Waiting for result...')}
          </pre>
        )}
      </div>
    </div>
  )
}
