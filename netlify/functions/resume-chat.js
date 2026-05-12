const HUGGING_FACE_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey =
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_TOKEN ||
    process.env.HF_TOKEN

  if (!apiKey) {
    return jsonResponse(500, {
      error:
        'Missing Hugging Face API key. Add HUGGING_FACE_API_KEY in Netlify Environment variables, then redeploy the site.',
    })
  }

  try {
    const payload = JSON.parse(event.body || '{}')
    const topicResponse = getOutOfScopeResponse(payload)

    if (topicResponse) {
      return jsonResponse(200, { answer: topicResponse })
    }

    const messages = buildMessages(payload)

    const response = await fetch(HUGGING_FACE_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.HUGGING_FACE_MODEL || 'HuggingFaceH4/zephyr-7b-beta',
        messages,
        max_tokens: 450,
        temperature: 0.35,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const rawError =
        data.error?.message ||
        data.message ||
        data.error ||
        `Hugging Face request failed with status ${response.status}.`

      if (response.status === 401 || /invalid username|password|unauthorized|token/i.test(rawError)) {
        return jsonResponse(401, {
          error:
            'Hugging Face authentication failed. In Netlify, set HUGGING_FACE_API_KEY to a valid Hugging Face access token that starts with hf_, then clear cache and redeploy.',
        })
      }

      return jsonResponse(response.status, {
        error: rawError,
      })
    }

    return jsonResponse(200, {
      answer: extractOutputText(data),
    })
  } catch (error) {
    return jsonResponse(500, {
      error: error.message || 'AI chat failed.',
    })
  }
}

function buildMessages(payload) {
  const mode = payload.mode === 'builder' ? 'builder' : 'analyser'
  const question = limitText(payload.question || '', 1200)
  const jobDescription = limitText(payload.jobDescription || '', 3000)
  const resumeText = limitText(payload.resumeText || '', 3500)
  const jobKeywords = Array.isArray(payload.jobKeywords)
    ? payload.jobKeywords.slice(0, 12).join(', ')
    : ''

  if (mode === 'builder') {
    return [
      {
        role: 'system',
        content:
          'You are ResAi, an AI resume creation assistant. Only answer questions about resumes, job descriptions, job applications, ATS readiness, interview/job preparation, skills, projects, and career profile writing. If the user asks about anything unrelated, politely ask them to come back to resumes or jobs. Before creating resume content, require an employer job description. When a job description is available, help create targeted resume content using only the user\'s truthful background. Keep responses concise, practical, and resume-ready.',
      },
      {
        role: 'user',
        content: `Job description:\n${jobDescription || 'Not provided'}\n\nDetected job keywords:\n${jobKeywords || 'None detected'}\n\nUser message:\n${question}`,
      },
    ]
  }

  const analysis = payload.analysis || {}

  return [
    {
      role: 'system',
      content:
        'You are ResAi, an AI resume analysis assistant. Only answer questions about the uploaded resume, job descriptions, ATS readiness, keywords, resume rewriting, job applications, skills, projects, and career profile improvement. If the user asks about anything unrelated, politely ask them to come back to the resume or job topic. Discuss only the user\'s resume and how to improve it. If an employer job description is provided, compare the resume with it. Give specific, concise advice. Do not mention implementation details, code, APIs, or internal limitations.',
    },
    {
      role: 'user',
      content: `Uploaded file:\n${payload.fileName || 'Resume'}\n\nATS-style score:\n${analysis.score || 'Not available'}\n\nAnalysis summary:\n${analysis.summary || 'No summary available'}\n\nCurrent conclusion:\n${analysis.conclusion || 'No conclusion available'}\n\nDetected job keywords:\n${jobKeywords || 'None provided'}\n\nEmployer job description:\n${jobDescription || 'Not provided'}\n\nResume text:\n${resumeText || 'Text not available'}\n\nUser question:\n${question}`,
    },
  ]
}

function extractOutputText(data) {
  return (
    data.choices?.[0]?.message?.content?.trim()
    || 'I could not generate a response right now.'
  )
}

function getOutOfScopeResponse(payload) {
  const question = String(payload.question || '').toLowerCase()
  const mode = payload.mode === 'builder' ? 'builder' : 'analyser'
  const hasContext = Boolean(payload.jobDescription || payload.resumeText || payload.analysis)

  if (!question.trim()) {
    return 'Please ask a resume or job-related question.'
  }

  const careerTerms = [
    'resume',
    'cv',
    'job',
    'role',
    'ats',
    'keyword',
    'skill',
    'project',
    'experience',
    'education',
    'internship',
    'summary',
    'profile',
    'career',
    'interview',
    'application',
    'employer',
    'description',
    'bullet',
    'achievement',
    'rewrite',
    'hire',
    'recruiter',
  ]
  const unrelatedTerms = [
    'weather',
    'movie',
    'song',
    'recipe',
    'cricket',
    'football',
    'politics',
    'capital of',
    'joke',
    'game',
    'relationship',
    'travel',
    'stock',
    'crypto',
  ]

  if (unrelatedTerms.some((term) => question.includes(term))) {
    return 'I am here to help with resumes, job descriptions, ATS readiness, and job applications. Please ask something related to your resume or target job.'
  }

  if (careerTerms.some((term) => question.includes(term))) {
    return ''
  }

  if (mode === 'builder' && hasContext) {
    return ''
  }

  if (mode === 'analyser' && hasContext) {
    return ''
  }

  return 'I am here to help with resumes, job descriptions, ATS readiness, and job applications. Please come back to the resume or job topic.'
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
