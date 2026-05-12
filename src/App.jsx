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

function App() {
  const [currentView, setCurrentView] = useState('home')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [readError, setReadError] = useState('')
  const [analysis, setAnalysis] = useState(createEmptyAnalysis())
  const [analysisError, setAnalysisError] = useState('')
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
      setAnalysis(createEmptyAnalysis())
      setAnalysisError('')
      setIsAnalysing(false)
      setAnalysisComplete(false)
      return undefined
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setResumeText('')
    setReadError('')
    setAnalysis(createEmptyAnalysis())
    setAnalysisError('')

    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const jobAnalysis = useMemo(
    () => analyseJobDescription(jobDescriptionText),
    [jobDescriptionText],
  )
  const score = file ? analysis.score : 0
  const suggestions = file ? analysis.suggestions : defaultSuggestions

  useEffect(() => {
    if (!file) {
      return undefined
    }

    let cancelled = false
    setIsAnalysing(true)
    setAnalysisComplete(false)
    setAnalysisError('')

    callResumeAnalysis({
      file,
      jobDescription: jobAnalysis.source,
      jobKeywords: jobAnalysis.keywords,
    })
      .then((result) => {
        if (cancelled) {
          return
        }

        setResumeText(result.extractedText || '')
        setAnalysis(result.analysis || createEmptyAnalysis())
        setAnalysisComplete(true)
        window.setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setAnalysisError(error.message || 'Could not analyse this resume.')
        setReadError(error.message || 'Could not extract readable text from this file.')
      })
      .finally(() => {
        if (!cancelled) {
          setIsAnalysing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [file, jobAnalysis.source, jobAnalysis.keywords])

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
                setAnalysisError('')
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

      {analysisError && (
        <section className="analysing-panel error-panel" aria-live="polite">
          <h2>Could not analyse this resume</h2>
          <p>{analysisError}</p>
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

async function callResumeAnalysis({ file, jobDescription, jobKeywords }) {
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

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Resume analysis request failed')
  }

  return data
}

function readFileAsBase64(file) {
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

function createEmptyAnalysis() {
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
