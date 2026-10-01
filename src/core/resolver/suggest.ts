const MAX_SUGGESTION_DISTANCE = 3

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j] ?? 0
      const substitution = previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      row[j] = Math.min((row[j - 1] ?? 0) + 1, current + 1, substitution)
      previous = current
    }
  }
  return row[b.length] ?? 0
}

/** The closest known id within a small edit distance, for "did you mean" fixes. */
export function closestId(unknown: string, known: Iterable<string>): string | undefined {
  let best: { id: string; distance: number } | undefined
  for (const id of known) {
    const distance = editDistance(unknown, id)
    if (distance <= MAX_SUGGESTION_DISTANCE && (best === undefined || distance < best.distance)) {
      best = { id, distance }
    }
  }
  return best?.id
}
