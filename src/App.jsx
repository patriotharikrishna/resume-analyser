import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const checks = [
  { label: 'ATS friendly format', status: 'Ready' },
  { label: 'Skills section clarity', status: 'Good' },
  { label: 'Impact metrics', status: 'Needs work' },
  { label: 'Role keyword match', status: 'Review' },
]

const defaultSuggestions = [
  'Add measurable results to your latest project experience.',
  'Keep section headings simple: Experience, Projects, Skills, Education.',
  'Include role-specific keywords from the job description.',
]

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

function App() {
  const [currentView, setCurrentView] = useState('home')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [readError, setReadError] = useState('')
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null)
  const [jobDescriptionText, setJobDescriptionText] = useState('')
  const [jobDescriptionError, setJobDescriptionError] = useState('')
  const [builderInput, setBuilderInput] = useState('')
  const [isBuilderThinking, setIsBuilderThinking] = useState(false)
  const [builderMessages, setBuilderMessages] = useState([
    {
      role: 'assistant',
      text: 'Upload the employer job description first. I will analyse it, then help you create a targeted resume for that role.',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isResumeChatThinking, setIsResumeChatThinking] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Upload a resume, then ask me what to improve, how to rewrite a section, or how ready it looks for ATS screening.',
    },
  ])
  const resultsRef = useRef(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      setResumeText('')
      setReadError('')
      setIsAnalysing(false)
      setAnalysisComplete(false)
      return undefined
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setResumeText('')
    setReadError('')

    if (isTextLikeFile(file)) {
      const reader = new FileReader()
      reader.onload = () => setResumeText(String(reader.result || ''))
      reader.onerror = () => {
        setReadError('Could not read this file for text highlighting.')
      }
      reader.readAsText(file)
    }

    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const jobAnalysis = useMemo(
    () => analyseJobDescription(jobDescriptionText),
    [jobDescriptionText],
  )
  const analysis = useMemo(
    () => analyseResume(resumeText, jobAnalysis),
    [resumeText, jobAnalysis],
  )
  const score = file ? analysis.score : 0
  const suggestions = file ? analysis.suggestions : defaultSuggestions

  useEffect(() => {
    if (!file) {
      return undefined
    }

    if (isTextLikeFile(file) && !resumeText.trim() && !readError) {
      return undefined
    }

    setIsAnalysing(true)
    setAnalysisComplete(false)

    const timer = window.setTimeout(() => {
      setIsAnalysing(false)
      setAnalysisComplete(true)
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [file, resumeText, readError, jobAnalysis.source])

  if (currentView === 'home') {
    return (
      <main className="app-shell">
        <section className="home-hero" aria-labelledby="home-title">
          <nav className="top-nav">
            <a className="brand-mark" href="/" aria-label="ResAi home">
              <img src="/resai-logo.jpeg" alt="ResAi" />
            </a>
            <button type="button" onClick={() => setCurrentView('analyser')}>
              Analyse resume
            </button>
          </nav>

          <div className="home-hero-grid">
            <div className="home-copy">
              <p className="eyebrow">Create, improve, and analyse</p>
              <h1 id="home-title">Build a stronger resume with AI guidance.</h1>
              <p className="hero-text">
                ResAi helps you create a resume around an employer's job
                description, improve weak bullet points, check ATS readiness,
                preview your resume, and understand what needs to change before
                applying.
              </p>
              <div className="home-actions">
                <button type="button" onClick={() => setCurrentView('analyser')}>
                  Start analysing
                </button>
                <a href="#builder-chat">Create with chatbot</a>
              </div>
            </div>

            <section
              className="builder-chat-card"
              id="builder-chat"
              aria-label="Resume builder chatbot"
            >
              <div className="chatbot-header">
                <div>
                  <span className="panel-label">Job-targeted builder</span>
                  <h2>Create a resume with AI</h2>
                </div>
                <span className="chat-status">Hugging Face AI</span>
              </div>

              <label className="job-upload-box">
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0]
                    setJobDescriptionFile(selectedFile || null)
                    setJobDescriptionText('')
                    setJobDescriptionError('')
                    setBuilderMessages([
                      {
                        role: 'assistant',
                        text: selectedFile
                          ? `I received ${selectedFile.name}. If it is TXT or MD, I will analyse the text now. For PDF/DOC/DOCX, paste the job description into chat after uploading so I can target the resume accurately.`
                          : 'Upload the employer job description first.',
                      },
                    ])

                    if (!selectedFile) {
                      return
                    }

                    if (!isTextLikeFile(selectedFile)) {
                      setJobDescriptionError(
                        'This file is uploaded, but browser text reading is available for TXT and MD. Paste the job description into chat for targeting.',
                      )
                      return
                    }

                    const reader = new FileReader()
                    reader.onload = () => {
                      const text = String(reader.result || '')
                      setJobDescriptionText(text)
                      setBuilderMessages([
                        {
                          role: 'assistant',
                          text: `I analysed the job description. Key focus areas: ${analyseJobDescription(text).keywords.join(', ') || 'role skills, experience, and measurable achievements'}. Now tell me your education, skills, projects, and experience so I can shape a targeted resume.`,
                        },
                      ])
                    }
                    reader.onerror = () => {
                      setJobDescriptionError('Could not read this job description file.')
                    }
                    reader.readAsText(selectedFile)
                  }}
                />
                <span>
                  {jobDescriptionFile?.name || 'Upload employer job description'}
                </span>
                <small>TXT/MD can be analysed directly. PDF/DOCX can be uploaded, then pasted in chat.</small>
              </label>

              {jobDescriptionError && (
                <p className="job-error">{jobDescriptionError}</p>
              )}

              {jobAnalysis.keywords.length > 0 && (
                <div className="job-insights">
                  <span>Detected keywords</span>
                  <div>
                    {jobAnalysis.keywords.map((keyword) => (
                      <mark key={keyword}>{keyword}</mark>
                    ))}
                  </div>
                </div>
              )}

              <div className="chat-window home-chat-window">
                {builderMessages.map((message, index) => (
                  <div
                    className={`chat-message ${message.role}`}
                    key={`${message.role}-${index}`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>

              <form
                className="chat-form"
                onSubmit={async (event) => {
                  event.preventDefault()
                  const prompt = builderInput.trim()

                  if (!prompt) {
                    return
                  }

                  setBuilderInput('')
                  setIsBuilderThinking(true)
                  setBuilderMessages((messages) => [
                    ...messages,
                    { role: 'user', text: prompt },
                  ])

                  try {
                    const answer = await callAiChat({
                      mode: 'builder',
                      question: prompt,
                      jobDescription: jobAnalysis.source,
                      jobKeywords: jobAnalysis.keywords,
                    })
                    setBuilderMessages((messages) => [
                      ...messages,
                      { role: 'assistant', text: answer },
                    ])
                  } catch (error) {
                    setBuilderMessages((messages) => [
                      ...messages,
                      {
                        role: 'assistant',
                        text:
                          error.message ||
                          'The Hugging Face chatbot is not available right now. Please check your Netlify environment variables and try again.',
                      },
                    ])
                  } finally {
                    setIsBuilderThinking(false)
                  }
                }}
              >
                <input
                  type="text"
                  value={builderInput}
                  placeholder={
                    jobDescriptionFile
                      ? 'Share your education, skills, projects, and experience'
                      : 'Upload the job description first'
                  }
                  onChange={(event) => setBuilderInput(event.target.value)}
                />
                <button type="submit" disabled={isBuilderThinking}>
                  {isBuilderThinking ? 'Thinking' : 'Ask'}
                </button>
              </form>
            </section>
          </div>
        </section>

        <section className="feature-section" aria-label="Website features">
          <article>
            <span>01</span>
            <h2>Create resume content</h2>
            <p>
              Use the chatbot to draft summaries, skills, project bullets, and
              experience points based on your background.
            </p>
          </article>
          <article>
            <span>02</span>
            <h2>Analyse uploaded resumes</h2>
            <p>
              Upload your resume to preview it, review ATS-style checks, and
              find weak wording or missing sections.
            </p>
          </article>
          <article>
            <span>03</span>
            <h2>Improve before applying</h2>
            <p>
              Get a conclusion, suggested fixes, and a resume chat assistant to
              discuss what to change next.
            </p>
          </article>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-section" aria-labelledby="page-title">
        <nav className="top-nav analyser-nav">
          <a className="brand-mark" href="/" aria-label="ResAi home">
            <img src="/resai-logo.jpeg" alt="ResAi" />
          </a>
          <button type="button" onClick={() => setCurrentView('home')}>
            Home
          </button>
        </nav>
        <div className="hero-copy">
          <p className="eyebrow">Resume analysis</p>
          <h1 id="page-title">Check your resume before you apply.</h1>
          <p className="hero-text">
            Add the employer job description if you have one, then upload your
            resume. ResAi compares both when a description is provided and shows
            ATS, keyword, and wording results.
          </p>
        </div>

        <div className="upload-panel">
          <section className="job-target-card" aria-label="Employer job description">
            <span className="panel-label">Step 1</span>
            <h2>Provide job description <small>Optional</small></h2>
            <textarea
              value={jobDescriptionText}
              placeholder="Paste the employer's job description here if you want role-specific comparison."
              onChange={(event) => {
                setJobDescriptionText(event.target.value)
                setJobDescriptionError('')
                setAnalysisComplete(false)
              }}
            />
            <label className="mini-upload">
              <input
                type="file"
                accept=".txt,.md"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0]
                  setJobDescriptionFile(selectedFile || null)
                  setJobDescriptionError('')

                  if (!selectedFile) {
                    return
                  }

                  const reader = new FileReader()
                  reader.onload = () => setJobDescriptionText(String(reader.result || ''))
                  reader.onerror = () => {
                    setJobDescriptionError('Could not read this job description file.')
                  }
                  reader.readAsText(selectedFile)
                }}
              />
              Upload TXT/MD job description
            </label>
            {jobDescriptionError && (
              <p className="job-error">{jobDescriptionError}</p>
            )}
            {jobAnalysis.keywords.length > 0 && (
              <div className="job-insights compact-insights">
                <span>Target keywords</span>
                <div>
                  {jobAnalysis.keywords.slice(0, 6).map((keyword) => (
                    <mark key={keyword}>{keyword}</mark>
                  ))}
                </div>
              </div>
            )}
          </section>

          <label className="upload-box">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0]
                setFile(selectedFile || null)
                setAnalysisComplete(false)
                setChatMessages([
                  {
                    role: 'assistant',
                    text: selectedFile
                      ? `I can discuss ${selectedFile.name}. Ask about keywords, formatting, weak wording, or what to fix first.`
                      : 'Upload a resume, then ask me what to improve.',
                  },
                ])
              }}
            />
            <span className="upload-icon" aria-hidden="true">
              +
            </span>
            <span className="upload-title">
              {file?.name || 'Upload resume'}
            </span>
            <span className="upload-meta">PDF, DOC, DOCX, TXT, or MD</span>
          </label>
        </div>
      </section>

      {isAnalysing && (
        <section className="analysing-panel" aria-live="polite">
          <div className="spinner" aria-hidden="true"></div>
          <h2>Analysing your resume</h2>
          <p>
            {jobAnalysis.source
              ? 'Comparing your resume with the employer job description and checking keywords, structure, wording, and ATS readiness.'
              : 'Checking your resume structure, wording, measurable impact, and ATS readiness.'}
          </p>
        </section>
      )}

      {analysisComplete && (
      <section className="dashboard" ref={resultsRef} aria-label="Resume analysis preview">
        <div className="score-panel">
          <span className="panel-label">ATS score</span>
          <strong>{score}%</strong>
          <p>
            {file
              ? analysis.summary
              : 'Upload a resume to generate an analysis preview.'}
          </p>
        </div>

        <div className="checks-panel">
          <span className="panel-label">Quick checks</span>
          <div className="check-list">
            {checks.map((check) => (
              <div className="check-row" key={check.label}>
                <span>{check.label}</span>
                <span className="status">{check.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="suggestions-panel">
          <span className="panel-label">Suggestions</span>
          <ul>
            {suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {file && analysisComplete && (
        <section className="preview-section" aria-label="Resume preview">
          <div className="preview-header">
            <div>
              <span className="panel-label">Resume preview</span>
              <h2>{file.name}</h2>
            </div>
            <span className="file-pill">{formatFileSize(file.size)}</span>
          </div>

          <div className="preview-grid">
            <div className="resume-preview">
              {renderPreview({
                file,
                previewUrl,
                resumeText,
                readError,
                issues: analysis.issues,
              })}
            </div>

            <div className="analysis-column">
              <aside className="issues-panel">
                <span className="panel-label">Needs changes</span>
                {analysis.issues.length > 0 ? (
                  <div className="issue-list">
                    {analysis.issues.map((issue, index) => (
                      <article className="issue-card" key={`${issue.title}-${index}`}>
                        <span className={`severity ${issue.severity}`}>
                          {issue.severity}
                        </span>
                        <h3>{issue.title}</h3>
                        <p>{issue.detail}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state compact">
                    No obvious text issues found yet. Add a job description later
                    to compare keywords more accurately.
                  </p>
                )}
              </aside>

              <section className="conclusion-panel">
                <span className="panel-label">Conclusion</span>
                <p>{analysis.conclusion}</p>
              </section>
            </div>
          </div>

          <section className="chatbot-panel" aria-label="Resume AI chat">
            <div className="chatbot-header">
              <div>
                <span className="panel-label">AI resume chat</span>
                <h2>Discuss this resume</h2>
              </div>
              <span className="chat-status">Hugging Face AI</span>
            </div>

            <div className="chat-window">
              {chatMessages.map((message, index) => (
                <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.text}
                </div>
              ))}
            </div>

            <form
              className="chat-form"
              onSubmit={async (event) => {
                event.preventDefault()
                const question = chatInput.trim()

                if (!question) {
                  return
                }

                setChatInput('')
                setIsResumeChatThinking(true)
                setChatMessages((messages) => [
                  ...messages,
                  { role: 'user', text: question },
                ])

                try {
                  const answer = await callAiChat({
                    mode: 'analyser',
                    question,
                    resumeText,
                    analysis,
                    jobDescription: jobAnalysis.source,
                    jobKeywords: jobAnalysis.keywords,
                    fileName: file?.name,
                  })
                  setChatMessages((messages) => [
                    ...messages,
                    { role: 'assistant', text: answer },
                  ])
                } catch (error) {
                  setChatMessages((messages) => [
                    ...messages,
                    {
                      role: 'assistant',
                      text:
                        error.message ||
                        'The Hugging Face chatbot is not available right now. Please check your Netlify environment variables and try again.',
                    },
                  ])
                } finally {
                  setIsResumeChatThinking(false)
                }
              }}
            >
              <input
                type="text"
                value={chatInput}
                placeholder="Ask: What should I improve first?"
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button type="submit" disabled={isResumeChatThinking}>
                {isResumeChatThinking ? 'Thinking' : 'Send'}
              </button>
            </form>
          </section>
        </section>
      )}
    </main>
  )
}

function renderPreview({ file, previewUrl, resumeText, readError, issues }) {
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

function highlightResumeText(text, issues) {
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

function analyseResume(text, jobAnalysis) {
  const hasJobDescription = Boolean(jobAnalysis.source.trim())

  if (!text.trim()) {
    return {
      score: 72,
      summary: hasJobDescription
        ? 'The resume is uploaded for review against the provided job description.'
        : 'The resume is uploaded and ready for a high-level review.',
      conclusion:
        hasJobDescription
          ? 'Overall, this resume should be strengthened around the employer role by making the most relevant skills, projects, and achievements easier to identify. The resume should clearly show how the candidate matches the job description through aligned keywords, concise bullet points, and measurable outcomes.'
          : 'Overall, this resume appears ready for an initial review, but it should still be checked for clear section headings, measurable achievements, role-specific keywords, and concise bullet points. The strongest next improvement is to make every experience or project point show what was done, which skill was used, and what result was achieved.',
      suggestions: hasJobDescription
        ? [
            `Reflect these job-description keywords where truthful: ${jobAnalysis.keywords.slice(0, 6).join(', ') || 'role skills and tools'}.`,
            ...defaultSuggestions,
          ]
        : defaultSuggestions,
      issues: [
        {
          title: 'Text extraction pending',
          detail:
            'This file type can be previewed, but its text is not being parsed yet.',
          severity: 'review',
        },
      ],
    }
  }

  const lines = text.split(/\r?\n/)
  const issues = []
  const normalizedResume = text.toLowerCase()
  const targetKeywords = jobAnalysis.keywords || []
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

  if (!/\b(skills|technical skills)\b/i.test(text)) {
    issues.push({
      title: 'Skills section missing',
      detail: 'Add a dedicated skills section so ATS tools can classify your profile.',
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
    38,
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
        ? keywordMatch === null
          ? `Overall, this resume is a workable draft with a score of ${score}%. It needs sharper wording, stronger measurable outcomes, and cleaner ATS-friendly sections. Improve the highlighted parts first so the resume reads as specific, confident, and results-driven.`
          : `Overall, this resume is a workable draft with a score of ${score}%. Compared with the employer's job description, it needs stronger alignment with the missing role keywords, sharper wording, and more measurable achievements. Improve the highlighted parts first so the resume reads as specific, confident, and clearly matched to the role.`
        : keywordMatch === null
          ? `Overall, this resume looks strong with a score of ${score}%. It is easy to scan, uses clear wording, and does not show obvious text-level problems in this review. The resume should still stay concise and focused, but it is in good shape for refinement.`
          : `Overall, this resume looks strong with a score of ${score}%. It is easy to scan, uses clear wording, and aligns well with the employer's job description. The resume should still stay concise, but it is in good shape for final role-specific refinement.`,
    suggestions:
      issues.length > 0
        ? issues.map((issue) => issue.detail)
        : [
            keywordMatch === null
              ? 'Keep the strongest role-relevant skills visible in the summary, skills, and experience sections.'
              : `Keep the strongest matched keywords visible: ${matchedKeywords.slice(0, 5).join(', ') || 'role skills and tools'}.`,
            ...defaultSuggestions,
          ],
    issues,
  }
}

async function callAiChat(payload) {
  const response = await fetch('/.netlify/functions/resume-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'AI chat request failed')
  }

  return data.answer
}

function analyseJobDescription(text) {
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

  const words = source
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

function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isTextLikeFile(file) {
  const name = file.name.toLowerCase()
  return file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default App
