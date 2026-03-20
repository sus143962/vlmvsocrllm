/**
 * Utilities for computing JSON diffs with word-level granularity.
 */

/**
 * Flatten a nested object/array into dot-notation key-value pairs.
 */
export function flattenObject(obj, prefix = '') {
  const result = {}
  if (obj == null) return result

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (item != null && typeof item === 'object') {
          Object.assign(result, flattenObject(item, `${path}.${i}`))
        } else {
          result[`${path}.${i}`] = String(item ?? '')
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

/**
 * Compare two objects and return a Map of dot-notation paths that differ,
 * mapping each path to the OTHER side's string value (or null if missing).
 */
export function getDiffMap(objA, objB) {
  const flatA = flattenObject(objA)
  const flatB = flattenObject(objB)
  const diffMap = new Map()

  const allKeys = new Set([...Object.keys(flatA), ...Object.keys(flatB)])
  for (const key of allKeys) {
    if (flatA[key] !== flatB[key]) {
      diffMap.set(key, flatB[key] ?? null)
    }
  }
  return diffMap
}

/* ------------------------------------------------------------------ */
/* Word-level diff using LCS on tokens                                */
/* ------------------------------------------------------------------ */

/** Split text into tokens (words + whitespace), preserving everything. */
function tokenize(text) {
  return text.split(/(\s+)/).filter(t => t.length > 0)
}

/**
 * Compute a word-level diff of `thisText` against `otherText`.
 * Returns an array of { text, diff: boolean } segments for `thisText`,
 * where diff=true means that word/segment is NOT present in otherText.
 */
export function computeWordDiff(thisText, otherText) {
  if (thisText === otherText) return [{ text: thisText, diff: false }]
  if (otherText == null) return [{ text: thisText, diff: true }]
  if (!thisText) return []

  const tokensA = tokenize(thisText)
  const tokensB = tokenize(otherText)

  // For very long texts, fall back to whole-value highlight
  if (tokensA.length > 400 || tokensB.length > 400) {
    return [{ text: thisText, diff: true }]
  }

  const m = tokensA.length
  const n = tokensB.length

  // LCS dynamic programming
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find which tokens in A are part of the LCS
  const inLcs = new Set()
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (tokensA[i - 1] === tokensB[j - 1]) {
      inLcs.add(i - 1)
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  // Build contiguous segments
  const segments = []
  let cur = null

  for (let k = 0; k < tokensA.length; k++) {
    const isDiff = !inLcs.has(k)
    if (cur === null || cur.diff !== isDiff) {
      if (cur) segments.push(cur)
      cur = { text: tokensA[k], diff: isDiff }
    } else {
      cur.text += tokensA[k]
    }
  }
  if (cur) segments.push(cur)

  return segments
}
