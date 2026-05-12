import mammoth from 'mammoth'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

const HUGGING_FACE_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions'

const weakPhraseRules = [
  {
    pattern: /\b(responsible for|worked on|helped with|hardworking|team player)\b/gi,
    reason: 'Replace weak wording with direct action verbs and measurable impact.',
  },
  {
    pattern: /\b(objective|career objective)\b/gi,
    reason: 'Use a concise professional summary instead of an old-style objective.',
  },
]

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const payload = JSON.parse(event.body || '{}')
    const fileName = String(payload.fileName || 'resume')
    const fileType = String(payload.fileType || '')
    const fileBase64 = String(payload.fileBase64 || '')
    const jobDescription = String(payload.jobDescription || '')
    const jobKeywords = Array.isArray(payload.jobKeywords) ? payload.jobKeywords : []

    if (!fileBase64) {
      return jsonResponse(400, { error: 'No resume file was provided.' })
    }

    const buffer = Buffer.from(fileBase64, 'base64')
    const extractedText = await extractResumeText({ buffer, fileName, fileType })

    if (!extractedText.trim()) {
      return jsonResponse(422, {
        error:
          'I could not extract readable text from this resume. Try uploading a text-based PDF, DOCX, TXT, or MD file.',
      })
    }

    const ruleAnalysis = analyseResumeText(extractedText, { jobDescription, jobKeywords })
    const aiAnalysis = await getAiAnalysis({
      resumeText: extractedText,
      jobDescription,
      jobKeywords,
      ruleAnalysis,
    })

    return jsonResponse(200, {
      extractedText,
      analysis: aiAnalysis || ruleAnalysis,
      aiUsed: Boolean(aiAnalysis),
    })
  } catch (error) {
    return jsonResponse(500, {
      error: error.message || 'Resume analysis failed.',
    })
  }
}

async function extractResumeText({ buffer, fileName, fileType }) {
  const name = fileName.toLowerCase()

  if (fileType.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return buffer.toString('utf8')
  }

  if (fileType === 'application/pdf' || name.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer)
    return parsed.text || ''
  }

  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || name.endsWith('.docx')
  ) {
    const parsed = await mammoth.extractRawText({ buffer })
    return parsed.value || ''
  }

  if (name.endsWith('.doc')) {
    throw new Error('Legacy DOC files are not supported yet. Please upload DOCX, PDF, TXT, or MD.')
  }

  throw new Error('Unsupported resume file type. Please upload PDF, DOCX, TXT, or MD.')
}

function analyseResumeText(text, { jobDescription, jobKeywords }) {
  const lines = text.split(/\r?\n/)
  const issues = []
  const normalizedResume = text.toLowerCase()
  const targetKeywords = normalizeKeywords(jobDescription, jobKeywords)
  const matchedKeywords = targetKeywords.filter((keyword) =>
    normalizedResume.includes(keyword.toLowerCase()),
  )
  const missingKeywords = targetKeywords.filter(
    (keyword) => !normalizedResume.includes(keyword.toLowerCase()),
  )

  lines.forEach((line, index) => {
    weakPhraseRules.forEach((rule) => {
      if (rule.pattern.test(line)) {
        issues.push({
          title: 'Weak wording',
          detail: rule.reason,
          severity: 'high',
          line: index,
        })
      }
      rule.pattern.lastIndex = 0
    })

    if (line.length > 120) {
      issues.push({
        title: 'Long sentence',
        detail: 'Break this into shorter, easier-to-scan bullet points.',
        severity: 'review',
        line: index,
      })
    }
  })

  if (!/\b\d+[%+]?\b/.test(text)) {
    issues.push({
      title: 'Missing metrics',
      detail: 'Add numbers such as percentages, time saved, revenue, users, or accuracy gains.',
      severity: 'high',
    })
  }

  if (!/\b(skills|technical skills|technologies)\b/i.test(text)) {
    issues.push({
      title: 'Skills section missing',
      detail: 'Add a dedicated skills section so ATS tools can classify your profile.',
      severity: 'review',
    })
  }

  if (!/\b(experience|projects|education)\b/i.test(text)) {
    issues.push({
      title: 'Core section missing',
      detail: 'Use clear headings such as Experience, Projects, Education, and Skills.',
      severity: 'review',
    })
  }

  if (missingKeywords.length > 0) {
    issues.push({
      title: 'Job keyword gap',
      detail: `The resume does not clearly include these job-description keywords: ${missingKeywords.slice(0, 5).join(', ')}.`,
      severity: 'high',
    })
  }

  const keywordMatch = targetKeywords.length
    ? Math.round((matchedKeywords.length / targetKeywords.length) * 100)
    : null
  const score = Math.max(
    34,
    Math.min(96, 92 - issues.length * 6 + Math.round((keywordMatch || 0) / 8)),
  )

  return {
    score,
    summary:
      issues.length > 0
        ? keywordMatch === null
          ? `${issues.length} improvement area${issues.length === 1 ? '' : 's'} found in the resume.`
          : `${issues.length} improvement area${issues.length === 1 ? '' : 's'} found. Keyword match with the job description is ${keywordMatch}%.`
        : keywordMatch === null
          ? 'Strong first pass. The resume is clear and easy to scan.'
          : `Strong first pass. The resume is clear and matches ${keywordMatch}% of the detected job-description keywords.`,
    conclusion:
      issues.length > 0
        ? `Overall, this resume scores ${score}%. Improve the highest-impact issues first: clearer ATS-friendly headings, stronger action wording, measurable achievements, and truthful role-specific keywords.`
        : `Overall, this resume scores ${score}% and is in good shape for refinement. Keep the content concise, role-specific, and easy for recruiters and ATS parsers to scan.`,
    suggestions:
      issues.length > 0
        ? [...new Set(issues.map((issue) => issue.detail))]
        : [
            keywordMatch === null
              ? 'Keep the strongest role-relevant skills visible in the summary, skills, and experience sections.'
              : `Keep the strongest matched keywords visible: ${matchedKeywords.slice(0, 5).join(', ') || 'role skills and tools'}.`,
            'Add measurable results to your latest project experience.',
            'Keep section headings simple: Experience, Projects, Skills, Education.',
          ],
    issues,
    keywordMatch,
    matchedKeywords,
    missingKeywords,
  }
}

async function getAiAnalysis({ resumeText, jobDescription, jobKeywords, ruleAnalysis }) {
  const apiKey =
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_TOKEN ||
    process.env.HF_TOKEN

  if (!apiKey) {
    return null
  }

  const response = await fetch(HUGGING_FACE_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.HUGGING_FACE_MODEL || 'HuggingFaceH4/zephyr-7b-beta',
      messages: [
        {
          role: 'system',
          content:
            'You are an ATS-style resume analyst. Return strict JSON only. Do not wrap it in markdown. Keep feedback specific to the provided resume text.',
        },
        {
          role: 'user',
          content: `Resume text:\n${limitText(resumeText, 5000)}\n\nJob description:\n${limitText(jobDescription || 'Not provided', 2500)}\n\nDetected job keywords:\n${jobKeywords.slice(0, 12).join(', ') || 'None'}\n\nBaseline analysis JSON:\n${JSON.stringify(ruleAnalysis)}\n\nReturn JSON with this shape: {"score": number, "summary": string, "conclusion": string, "suggestions": string[], "issues": [{"title": string, "detail": string, "severity": "high"|"review"|"good", "line": number|null}], "keywordMatch": number|null, "matchedKeywords": string[], "missingKeywords": string[]}.`,
        },
      ],
      max_tokens: 700,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const parsed = parseJsonObject(content)

  if (!parsed) {
    return null
  }

  return normalizeAnalysis(parsed, ruleAnalysis)
}

function normalizeAnalysis(analysis, fallback) {
  return {
    score: clampNumber(analysis.score, fallback.score),
    summary: String(analysis.summary || fallback.summary),
    conclusion: String(analysis.conclusion || fallback.conclusion),
    suggestions: Array.isArray(analysis.suggestions) && analysis.suggestions.length
      ? analysis.suggestions.map(String).slice(0, 6)
      : fallback.suggestions,
    issues: Array.isArray(analysis.issues) && analysis.issues.length
      ? analysis.issues.slice(0, 8).map((issue) => ({
          title: String(issue.title || 'Resume issue'),
          detail: String(issue.detail || 'Review this part of the resume.'),
          severity: ['high', 'review', 'good'].includes(issue.severity)
            ? issue.severity
            : 'review',
          line: Number.isInteger(issue.line) ? issue.line : undefined,
        }))
      : fallback.issues,
    keywordMatch: Number.isFinite(analysis.keywordMatch)
      ? analysis.keywordMatch
      : fallback.keywordMatch,
    matchedKeywords: Array.isArray(analysis.matchedKeywords)
      ? analysis.matchedKeywords.map(String).slice(0, 12)
      : fallback.matchedKeywords,
    missingKeywords: Array.isArray(analysis.missingKeywords)
      ? analysis.missingKeywords.map(String).slice(0, 12)
      : fallback.missingKeywords,
  }
}

function normalizeKeywords(jobDescription, providedKeywords) {
  const keywords = new Set(providedKeywords.map((keyword) => String(keyword).toLowerCase()))

  if (jobDescription.trim()) {
    analyseJobDescription(jobDescription).keywords.forEach((keyword) => keywords.add(keyword))
  }

  return [...keywords].filter(Boolean).slice(0, 12)
}

function analyseJobDescription(text) {
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
  const words = text.toLowerCase().match(/\b[a-z][a-z+#.]{2,}\b/g) || []
  const counts = words.reduce((map, word) => {
    if (!commonWords.has(word)) {
      map.set(word, (map.get(word) || 0) + 1)
    }
    return map
  }, new Map())

  return {
    keywords: [...counts.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 8)
      .map(([word]) => word),
  }
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return null
    }

    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function clampNumber(value, fallback) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.max(0, Math.min(100, Math.round(number)))
}

function limitText(text, maxLength) {
  return String(text).slice(0, maxLength)
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}
