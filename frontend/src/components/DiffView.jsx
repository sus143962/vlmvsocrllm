import { useMemo } from 'react'
import { computeWordDiff } from '../utils/jsonDiff.js'

/**
 * Flatten a nested object/array into dot-notation key-value pairs.
 */
function flattenObject(obj, prefix = '') {
  const result = {}
  if (obj == null) return result

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (item != null && typeof item === 'object') {
          Object.assign(result, flattenObject(item, `${path}[${i}]`))
        } else {
          result[`${path}[${i}]`] = String(item ?? '')
        }
      })
    } else if (val != null && typeof val === 'object') {
      Object.assign(result, flattenObject(val, path))
    } else {
      result[path] = String(val ?? '')
    }
  }
  return result
}

function isCoordinateField(key) {
  return /\b(fieldCoordinates|sectionCoordinates)\b/.test(key)
}

/**
 * Render word-diff segments as React elements with highlights.
 */
function renderSegments(segments) {
  return segments.map((seg, i) =>
    seg.diff
      ? <mark key={i} className="diff-highlight">{seg.text}</mark>
      : <span key={i}>{seg.text}</span>
  )
}

/**
 * Render a cell value with word-level highlighting against the other side.
 */
function DiffCell({ value, otherValue, status }) {
  if (!value) return <span className="diff-empty">--</span>

  if (status === 'changed' && otherValue) {
    const segments = computeWordDiff(value, otherValue)
    return <span>{renderSegments(segments)}</span>
  }

  // vlm-only / ocr-only: highlight the whole thing
  if (status === 'vlm-only' || status === 'ocr-only') {
    return <mark className="diff-highlight">{value}</mark>
  }

  return <span>{value}</span>
}

export default function DiffView({ vlmResult, ocrLlmResult }) {
  const { rows, stats } = useMemo(() => {
    const vlmFlat = flattenObject(vlmResult)
    const ocrFlat = flattenObject(ocrLlmResult)

    const allKeys = [
      ...new Set([...Object.keys(vlmFlat), ...Object.keys(ocrFlat)])
    ]
      .filter(k => !isCoordinateField(k))
      .sort()

    let matchCount = 0
    let changedCount = 0
    let vlmOnlyCount = 0
    let ocrOnlyCount = 0

    const rows = allKeys.map(key => {
      const vVal = vlmFlat[key]
      const oVal = ocrFlat[key]
      let status

      if (vVal === undefined) {
        status = 'ocr-only'
        ocrOnlyCount++
      } else if (oVal === undefined) {
        status = 'vlm-only'
        vlmOnlyCount++
      } else if (vVal === oVal) {
        status = 'match'
        matchCount++
      } else {
        status = 'changed'
        changedCount++
      }

      return { key, vVal: vVal ?? '', oVal: oVal ?? '', status }
    })

    return {
      rows,
      stats: {
        total: allKeys.length,
        match: matchCount,
        changed: changedCount,
        vlmOnly: vlmOnlyCount,
        ocrOnly: ocrOnlyCount,
      },
    }
  }, [vlmResult, ocrLlmResult])

  if (!vlmResult && !ocrLlmResult) {
    return <div className="diff-view"><p style={{ padding: 24, color: 'var(--text-muted)' }}>No results to compare.</p></div>
  }

  const matchPct = stats.total > 0
    ? ((stats.match / stats.total) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="diff-view">
      <div className="diff-toolbar">
        <div className="diff-stats">
          <span className="diff-stat">
            <span className="diff-stat-dot match" />
            {stats.match} matched ({matchPct}%)
          </span>
          <span className="diff-stat">
            <span className="diff-stat-dot changed" />
            {stats.changed} different
          </span>
          <span className="diff-stat">
            <span className="diff-stat-dot vlm-only" />
            {stats.vlmOnly} VLM only
          </span>
          <span className="diff-stat">
            <span className="diff-stat-dot ocr-only" />
            {stats.ocrOnly} OCR only
          </span>
        </div>
        <div className="diff-legend">
          {stats.total} total fields (coordinates excluded)
        </div>
      </div>

      <div className="diff-table-wrapper">
        <table className="diff-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Field Path</th>
              <th style={{ width: '32.5%' }}>VLM (Vision)</th>
              <th style={{ width: '32.5%' }}>OCR + LLM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, vVal, oVal, status }) => (
              <tr key={key} className={`diff-row ${status}`}>
                <td>{key}</td>
                <td>
                  <DiffCell value={vVal} otherValue={oVal} status={status} />
                </td>
                <td>
                  <DiffCell value={oVal} otherValue={vVal} status={status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
