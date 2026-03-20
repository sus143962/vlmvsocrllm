import { flattenObject, computeWordDiff } from './jsonDiff.js'

/**
 * Compute diff rows from two result objects.
 */
function computeDiffRows(vlmResult, ocrLlmResult) {
  const vlmFlat = flattenObject(vlmResult)
  const ocrFlat = flattenObject(ocrLlmResult)
  const allKeys = [...new Set([...Object.keys(vlmFlat), ...Object.keys(ocrFlat)])].sort()

  let matchCount = 0, changedCount = 0, vlmOnlyCount = 0, ocrOnlyCount = 0

  const rows = allKeys.map(key => {
    const vVal = vlmFlat[key]
    const oVal = ocrFlat[key]
    let status
    if (vVal === undefined) { status = 'ocr-only'; ocrOnlyCount++ }
    else if (oVal === undefined) { status = 'vlm-only'; vlmOnlyCount++ }
    else if (vVal === oVal) { status = 'match'; matchCount++ }
    else { status = 'changed'; changedCount++ }
    return { key, vVal: vVal ?? '', oVal: oVal ?? '', status }
  })

  return { rows, stats: { total: allKeys.length, match: matchCount, changed: changedCount, vlmOnly: vlmOnlyCount, ocrOnly: ocrOnlyCount } }
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * For a changed row, produce HTML with <mark> around differing words.
 */
function wordDiffHtml(thisText, otherText) {
  if (!thisText) return '<em style="color:#5c6078">--</em>'
  if (!otherText) return `<mark style="background:rgba(250,204,21,0.25);color:#fde047;padding:1px 4px;border-radius:3px">${escHtml(thisText)}</mark>`
  const segments = computeWordDiff(thisText, otherText)
  return segments.map(seg =>
    seg.diff
      ? `<mark style="background:rgba(250,204,21,0.25);color:#fde047;padding:1px 4px;border-radius:3px">${escHtml(seg.text)}</mark>`
      : escHtml(seg.text)
  ).join('')
}

/**
 * Generate a self-contained HTML report with full styling and diff table.
 */
export function generateHtmlReport({ fileName, vlmResult, ocrLlmResult, vlmTimeMs, ocrLlmTimeMs, vlmInputTokens, vlmOutputTokens, ocrInputTokens, ocrOutputTokens }) {
  const { rows, stats } = computeDiffRows(vlmResult, ocrLlmResult)
  const matchPct = stats.total > 0 ? ((stats.match / stats.total) * 100).toFixed(1) : '0.0'
  const date = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const statusColors = {
    'match': '',
    'changed': 'background:rgba(245,158,11,0.08);',
    'vlm-only': 'background:rgba(99,102,241,0.08);',
    'ocr-only': 'background:rgba(239,68,68,0.08);',
  }
  const borderColors = {
    'changed': 'border-left:3px solid #f59e0b;',
    'vlm-only': 'border-left:3px solid #6366f1;',
    'ocr-only': 'border-left:3px solid #ef4444;',
  }

  const tableRows = rows.map(({ key, vVal, oVal, status }) => {
    const bg = statusColors[status] || ''
    const bl = borderColors[status] || ''
    let vCell, oCell
    if (status === 'changed') {
      vCell = wordDiffHtml(vVal, oVal)
      oCell = wordDiffHtml(oVal, vVal)
    } else if (status === 'vlm-only' || status === 'ocr-only') {
      vCell = vVal ? `<mark style="background:rgba(250,204,21,0.25);color:#fde047;padding:1px 4px;border-radius:3px">${escHtml(vVal)}</mark>` : '<em style="color:#5c6078">--</em>'
      oCell = oVal ? `<mark style="background:rgba(250,204,21,0.25);color:#fde047;padding:1px 4px;border-radius:3px">${escHtml(oVal)}</mark>` : '<em style="color:#5c6078">--</em>'
    } else {
      vCell = escHtml(vVal)
      oCell = escHtml(oVal)
    }
    return `<tr><td style="${bg}${bl}padding:6px 12px;border-bottom:1px solid #2a2e3f;color:#8b90a5;font-weight:500;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis">${escHtml(key)}</td><td style="${bg}padding:6px 12px;border-bottom:1px solid #2a2e3f;max-width:400px;word-break:break-word">${vCell}</td><td style="${bg}padding:6px 12px;border-bottom:1px solid #2a2e3f;max-width:400px;word-break:break-word">${oCell}</td></tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Benchmark Report – ${escHtml(fileName)}</title>
<style>
  body { font-family: 'Inter',system-ui,sans-serif; background:#0f1117; color:#e4e6f0; margin:0; padding:24px; }
  h1 { font-size:20px; margin-bottom:4px; }
  .meta { color:#8b90a5; font-size:13px; margin-bottom:20px; }
  .cards { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  .card { background:#161922; border:1px solid #2a2e3f; border-radius:8px; padding:16px 20px; flex:1; min-width:180px; }
  .card-label { font-size:12px; color:#8b90a5; font-weight:500; }
  .card-value { font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:700; margin-top:4px; }
  .card-tokens { font-family:'JetBrains Mono',monospace; font-size:11px; color:#8b90a5; margin-top:4px; }
  .vlm { color:#22c55e; }
  .ocr { color:#f59e0b; }
  .stats { display:flex; gap:16px; margin-bottom:12px; font-size:13px; }
  .stat-dot { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; }
  .dot-match { background:#22c55e; }
  .dot-changed { background:#f59e0b; }
  .dot-vlm { background:#6366f1; }
  .dot-ocr { background:#ef4444; }
  table { width:100%; border-collapse:collapse; font-size:12px; font-family:'JetBrains Mono',monospace; }
  th { background:#1e2130; padding:8px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#8b90a5; border-bottom:1px solid #2a2e3f; position:sticky; top:0; }
</style>
</head>
<body>
<h1>VLM vs OCR+LLM Benchmark Report</h1>
<div class="meta">File: ${escHtml(fileName)} | Date: ${date} | Model: gemini-2.5-flash</div>
<div class="cards">
  <div class="card"><div class="card-label">VLM (Vision) Time</div><div class="card-value vlm">${(vlmTimeMs / 1000).toFixed(1)}s</div><div class="card-tokens">In: ${vlmInputTokens.toLocaleString()} | Out: ${vlmOutputTokens.toLocaleString()}</div></div>
  <div class="card"><div class="card-label">OCR + LLM Time</div><div class="card-value ocr">${(ocrLlmTimeMs / 1000).toFixed(1)}s</div><div class="card-tokens">In: ${ocrInputTokens.toLocaleString()} | Out: ${ocrOutputTokens.toLocaleString()}</div></div>
  <div class="card"><div class="card-label">Match Rate</div><div class="card-value" style="color:#e4e6f0">${matchPct}%</div><div class="card-tokens">${stats.match} of ${stats.total} fields</div></div>
</div>
<div class="stats">
  <span><span class="stat-dot dot-match"></span>${stats.match} matched</span>
  <span><span class="stat-dot dot-changed"></span>${stats.changed} different</span>
  <span><span class="stat-dot dot-vlm"></span>${stats.vlmOnly} VLM only</span>
  <span><span class="stat-dot dot-ocr"></span>${stats.ocrOnly} OCR only</span>
</div>
<table>
<thead><tr><th style="width:35%">Field Path</th><th style="width:32.5%">VLM (Vision)</th><th style="width:32.5%">OCR + LLM</th></tr></thead>
<tbody>
${tableRows}
</tbody>
</table>
</body>
</html>`
}

/**
 * Generate a Markdown report suitable for GitHub issues/PRs.
 */
export function generateMarkdownReport({ fileName, vlmResult, ocrLlmResult, vlmTimeMs, ocrLlmTimeMs, vlmInputTokens, vlmOutputTokens, ocrInputTokens, ocrOutputTokens }) {
  const { rows, stats } = computeDiffRows(vlmResult, ocrLlmResult)
  const matchPct = stats.total > 0 ? ((stats.match / stats.total) * 100).toFixed(1) : '0.0'
  const date = new Date().toISOString().slice(0, 10)

  const escMd = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')

  let md = `# VLM vs OCR+LLM Benchmark Report\n\n`
  md += `**File:** \`${fileName}\` | **Date:** ${date} | **Model:** gemini-2.5-flash\n\n`
  md += `## Summary\n\n`
  md += `| Metric | VLM (Vision) | OCR + LLM |\n`
  md += `|--------|-------------|------------|\n`
  md += `| Time | ${(vlmTimeMs / 1000).toFixed(1)}s | ${(ocrLlmTimeMs / 1000).toFixed(1)}s |\n`
  md += `| Input Tokens | ${vlmInputTokens.toLocaleString()} | ${ocrInputTokens.toLocaleString()} |\n`
  md += `| Output Tokens | ${vlmOutputTokens.toLocaleString()} | ${ocrOutputTokens.toLocaleString()} |\n\n`
  md += `**Match Rate:** ${matchPct}% (${stats.match}/${stats.total} fields)\n`
  md += `- ${stats.match} matched | ${stats.changed} different | ${stats.vlmOnly} VLM-only | ${stats.ocrOnly} OCR-only\n\n`

  // Only include non-matching rows to keep it concise
  const diffRows = rows.filter(r => r.status !== 'match')
  if (diffRows.length > 0) {
    md += `## Differences\n\n`
    md += `| Status | Field Path | VLM Value | OCR Value |\n`
    md += `|--------|-----------|-----------|----------|\n`
    for (const { key, vVal, oVal, status } of diffRows) {
      const label = status === 'changed' ? 'Changed' : status === 'vlm-only' ? 'VLM only' : 'OCR only'
      const vDisplay = vVal ? escMd(vVal.length > 80 ? vVal.slice(0, 80) + '...' : vVal) : '--'
      const oDisplay = oVal ? escMd(oVal.length > 80 ? oVal.slice(0, 80) + '...' : oVal) : '--'
      md += `| ${label} | \`${escMd(key)}\` | ${vDisplay} | ${oDisplay} |\n`
    }
  } else {
    md += `## Differences\n\nNo differences found — both paths produced identical results.\n`
  }

  md += `\n---\n*Generated by VLM vs OCR+LLM Benchmark Tool*\n`
  return md
}
