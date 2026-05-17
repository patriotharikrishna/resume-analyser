import React from 'react'

// Shared constants and helper functions extracted from App.jsx
// to improve readability and separate concerns.

export const checks = [
  { label: 'ATS friendly format', status: 'Ready' },
  { label: 'Skills section clarity', status: 'Good' },
  { label: 'Impact metrics', status: 'Needs work' },
  { label: 'Role keyword match', status: 'Review' },
]

export const defaultSuggestions = [
  'Add measurable results to your latest project experience.',
  'Keep section headings simple: Experience, Projects, Skills, Education.',
  'Include role-specific keywords from the job description.',
]

/**
 * Create a new, empty analysis object used as initial state.
 */
export function createEmptyAnalysis() {
  return {
    score: 0,
    summary: 'Upload a resume to generate an analysis preview.',
    conclusion: '',
    suggestions: defaultSuggestions,
    issues: [],
    keywordMatch: null,
    matchedKeywords: [],
    missingKeywords: [],
  }
}

/**
 * Simple keyword extractor for pasted job descriptions.
 * Returns the original source and up to 8 most frequent keywords.
 */
export function analyseJobDescription(text) {
  const source = text.trim()

  if (!source) {
    return { source: '', keywords: [] }
  }

  const commonWords = new Set([
    'and',
    'the',
    'for',
    'with',
    'you',
    'our',
    'are',
    'will',
    'this',
    'that',
    'from',
    'have',
    'your',
    'role',
    'work',
    'team',
    'skills',
    'experience',
  ])

  const words =
    source
      .toLowerCase()
      .match(/\b[a-z][a-z+#.]{2,}\b/g)
      || []

  const counts = words.reduce((map, word) => {
    if (!commonWords.has(word)) {
      map.set(word, (map.get(word) || 0) + 1)
    }
    return map
  }, new Map())

  const keywords = [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 8)
    .map(([word]) => word)

  return { source, keywords }
}

/** File type utilities used by preview rendering */
export function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function isTextLikeFile(file) {
  const name = file.name.toLowerCase()
  return file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')
}

export function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Render the resume preview depending on file type.
 * This returns React nodes and relies on the helpers above.
 */
export function renderPreview({ file, previewUrl, resumeText, readError, issues }) {
  if (isPdfFile(file)) {
    return (
      <>
        <iframe src={previewUrl} title="Resume PDF preview" />
        <p className="preview-note">
          Highlighted change areas are listed beside the PDF. Text-level
          highlighting is available for TXT and MD uploads.
        </p>
      </>
    )
  }

  if (isTextLikeFile(file)) {
    if (readError) {
      return <p className="empty-state">{readError}</p>
    }

    if (!resumeText) {
      return <p className="empty-state">Reading resume text...</p>
    }

    return <pre>{highlightResumeText(resumeText, issues)}</pre>
  }

  return (
    <p className="empty-state">
      Browser preview is limited for DOC and DOCX files. Convert the resume to
      PDF or TXT to see the document preview here.
    </p>
  )
}

/**
 * Highlight resume lines that have issues. Returns an array of React nodes.
 */
export function highlightResumeText(text, issues) {
  const lines = text.split(/\r?\n/)

  return lines.map((line, index) => {
    const issue = issues.find((item) => item.line === index)

    if (!issue) {
      return (
        <span className="resume-line" key={`${line}-${index}`}>
          {line || ' '}
          {'\n'}
        </span>
      )
    }

    return (
      <mark className="resume-line flagged" key={`${line}-${index}`}>
        {line || ' '}
        <span className="inline-reason"> {issue.title}</span>
        {'\n'}
      </mark>
    )
  })
}

/**
 * Network helpers: read JSON safely from a `fetch` Response.
 */
export async function readJsonResponse(response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return {
      error: text.slice(0, 180),
    }
  }
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',').pop() : result)
    }
    reader.onerror = () => reject(new Error('Could not read this file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Server calls used by the UI. These call Netlify functions and expect the
 * same contract as the original App.jsx implementation.
 */
export async function callAiChat(payload) {
  const response = await fetch('/.netlify/functions/resume-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'AI chat request failed')
  }

  return data.answer
}

export async function callResumeAnalysis({ file, jobDescription, jobKeywords }) {
  const fileBase64 = await readFileAsBase64(file)
  const response = await fetch('/.netlify/functions/analyse-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileBase64,
      jobDescription,
      jobKeywords,
    }),
  })

  const data = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Resume analysis request failed')
  }

  return data
}
