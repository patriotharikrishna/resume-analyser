const OPENAI_API_URL = 'https://api.openai.com/v1/responses'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return jsonResponse(500, {
      error: 'Missing OPENAI_API_KEY environment variable.',
    })
  }

  try {
    const payload = JSON.parse(event.body || '{}')
    const prompt = buildPrompt(payload)

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: prompt,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: data.error?.message || 'OpenAI request failed.',
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

function buildPrompt(payload) {
  const mode = payload.mode === 'builder' ? 'builder' : 'analyser'
  const question = limitText(payload.question || '', 1200)
  const jobDescription = limitText(payload.jobDescription || '', 3000)
  const resumeText = limitText(payload.resumeText || '', 3500)
  const jobKeywords = Array.isArray(payload.jobKeywords)
    ? payload.jobKeywords.slice(0, 12).join(', ')
    : ''

  if (mode === 'builder') {
    return `
You are ResAi, an AI resume creation assistant.
Before creating resume content, require an employer job description. If no job description is available, ask the user to upload or paste it first.
When a job description is available, help create a targeted resume using only the user's truthful background.
Keep the response concise, practical, and resume-ready.

Job description:
${jobDescription || 'Not provided'}

Detected job keywords:
${jobKeywords || 'None detected'}

User message:
${question}
`
  }

  const analysis = payload.analysis || {}

  return `
You are ResAi, an AI resume analysis assistant.
Discuss only the user's resume and how to improve it. If an employer job description is provided, compare the resume with it.
Give specific, concise advice. Do not mention implementation details, browser parsing, code, APIs, or internal analysis limitations.

Uploaded file:
${payload.fileName || 'Resume'}

ATS-style score:
${analysis.score || 'Not available'}

Analysis summary:
${analysis.summary || 'No summary available'}

Current conclusion:
${analysis.conclusion || 'No conclusion available'}

Detected job keywords:
${jobKeywords || 'None provided'}

Employer job description:
${jobDescription || 'Not provided'}

Resume text:
${resumeText || 'Text not available'}

User question:
${question}
`
}

function extractOutputText(data) {
  if (data.output_text) {
    return data.output_text
  }

  const textParts = []

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        textParts.push(content.text)
      }
    }
  }

  return textParts.join('\n').trim() || 'I could not generate a response right now.'
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
