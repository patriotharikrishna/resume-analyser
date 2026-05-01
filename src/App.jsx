import { useEffect, useMemo, useState } from 'react'
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
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null)
  const [jobDescriptionText, setJobDescriptionText] = useState('')
  const [jobDescriptionError, setJobDescriptionError] = useState('')
  const [builderInput, setBuilderInput] = useState('')
  const [builderMessages, setBuilderMessages] = useState([
    {
      role: 'assistant',
      text: 'Upload the employer job description first. I will analyse it, then help you create a targeted resume for that role.',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Upload a resume, then ask me what to improve, how to rewrite a section, or how ready it looks for ATS screening.',
    },
  ])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      setResumeText('')
      setReadError('')
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

  const analysis = useMemo(() => analyseResume(resumeText), [resumeText])
  const jobAnalysis = useMemo(
    () => analyseJobDescription(jobDescriptionText),
    [jobDescriptionText],
  )
  const score = file ? analysis.score : 0
  const suggestions = file ? analysis.suggestions : defaultSuggestions

  if (currentView === 'home') {
    return (
      <main className="app-shell">
        <section className="home-hero" aria-labelledby="home-title">
          <nav className="top-nav">
            <strong>ResAi</strong>
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
                <span className="chat-status">Draft helper</span>
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
                onSubmit={(event) => {
                  event.preventDefault()
                  const prompt = builderInput.trim()

                  if (!prompt) {
                    return
                  }

                  setBuilderMessages((messages) => [
                    ...messages,
                    { role: 'user', text: prompt },
                    {
                      role: 'assistant',
                      text: createBuilderResponse(prompt, jobAnalysis),
                    },
                  ])
                  setBuilderInput('')
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
                <button type="submit">Ask</button>
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
          <strong>ResAi</strong>
          <button type="button" onClick={() => setCurrentView('home')}>
            Home
          </button>
        </nav>
        <div className="hero-copy">
          <p className="eyebrow">Resume analysis</p>
          <h1 id="page-title">Check your resume before you apply.</h1>
          <p className="hero-text">
            Upload a resume to preview it, review likely ATS issues, and spot
            sections that need clearer wording or stronger proof.
          </p>
        </div>

        <div className="upload-panel">
          <label className="upload-box">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(event) => {
                const selectedFile = event.target.files?.[0]
                setFile(selectedFile || null)
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

      <section className="dashboard" aria-label="Resume analysis preview">
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

      {file && (
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
              <span className="chat-status">Local assistant</span>
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
              onSubmit={(event) => {
                event.preventDefault()
                const question = chatInput.trim()

                if (!question) {
                  return
                }

                const answer = createChatResponse(question, analysis, file, resumeText)
                setChatMessages((messages) => [
                  ...messages,
                  { role: 'user', text: question },
                  { role: 'assistant', text: answer },
                ])
                setChatInput('')
              }}
            >
              <input
                type="text"
                value={chatInput}
                placeholder="Ask: What should I improve first?"
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button type="submit">Send</button>
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

function analyseResume(text) {
  if (!text.trim()) {
    return {
      score: 72,
      summary: 'The file is uploaded. Use PDF/TXT text extraction next for deeper analysis.',
      conclusion:
        'This resume has been uploaded successfully, but the current browser-only analyser cannot read all document text from this file type. For a deeper conclusion with exact highlights, upload a TXT/MD version or add a PDF text parser in the next development step.',
      suggestions: defaultSuggestions,
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

  const score = Math.max(45, 92 - issues.length * 7)

  return {
    score,
    summary:
      issues.length > 0
        ? `${issues.length} improvement area${issues.length === 1 ? '' : 's'} found in the resume text.`
        : 'Strong first pass. The resume text is clear and easy to scan.',
    conclusion:
      issues.length > 0
        ? `Overall, this resume is a workable draft with a score of ${score}%, but it needs sharper wording, stronger measurable outcomes, and cleaner ATS-friendly sections before it is ready for serious applications. Fix the high-priority items first, then compare the final version against a target job description for keyword fit.`
        : `Overall, this resume looks strong with a score of ${score}%. It is easy to scan and does not show obvious text-level problems in this first pass, so the next best step is matching it against a real job description for missing role-specific keywords.`,
    suggestions: issues.length > 0 ? issues.map((issue) => issue.detail) : defaultSuggestions,
    issues,
  }
}

function createChatResponse(question, analysis, file, resumeText) {
  if (!file) {
    return 'Upload a resume first, then I can discuss its score, weak sections, keywords, and suggested rewrites.'
  }

  const normalizedQuestion = question.toLowerCase()
  const topIssue = analysis.issues[0]

  if (normalizedQuestion.includes('score') || normalizedQuestion.includes('ats')) {
    return `The current ATS-style score is ${analysis.score}%. ${analysis.summary} The fastest way to improve it is to fix the highest priority issue: ${topIssue?.detail || 'compare your resume with a target job description for missing keywords.'}`
  }

  if (normalizedQuestion.includes('first') || normalizedQuestion.includes('priority')) {
    return topIssue
      ? `Start with "${topIssue.title}". ${topIssue.detail} This gives you the best improvement for the least editing effort.`
      : 'Start by checking the resume against a specific job description. The current text does not show obvious structural problems.'
  }

  if (normalizedQuestion.includes('keyword') || normalizedQuestion.includes('job')) {
    return 'For keyword matching, paste the target job description into the app in a future version. For now, make sure your Skills and Experience sections repeat important role terms naturally, such as tools, frameworks, certifications, and responsibilities from the posting.'
  }

  if (normalizedQuestion.includes('rewrite') || normalizedQuestion.includes('change')) {
    return topIssue
      ? `A good rewrite pattern is: action verb + technical skill + measurable result. For example, replace weak phrasing with something like "Improved dashboard load time by 32% by optimizing API calls and caching repeated requests."`
      : 'Use strong bullet points with this structure: action verb + what you built or improved + measurable result.'
  }

  if (!resumeText.trim()) {
    return 'I can discuss the uploaded file at a high level, but exact line-by-line coaching needs extractable text. Upload TXT/MD or add PDF/DOCX parsing to make the chat more specific.'
  }

  return `${analysis.conclusion} Ask me about ATS score, keywords, rewrite help, or what to improve first for a more focused answer.`
}

function createBuilderResponse(prompt, jobAnalysis) {
  const normalizedPrompt = prompt.toLowerCase()
  const hasJobDescription = jobAnalysis.source.trim().length > 0
  const pastedJobDescription =
    normalizedPrompt.includes('responsibilities') ||
    normalizedPrompt.includes('requirements') ||
    normalizedPrompt.includes('qualifications')

  if (!hasJobDescription && !pastedJobDescription) {
    return 'Before creating the resume, upload or paste the employer job description. I need the role requirements first so the resume can match the right keywords, responsibilities, and skill expectations.'
  }

  const keywordAdvice = jobAnalysis.keywords.length
    ? `I will target these keywords: ${jobAnalysis.keywords.join(', ')}. `
    : 'I will target the employer requirements you shared. '

  if (normalizedPrompt.includes('summary') || normalizedPrompt.includes('profile')) {
    return `${keywordAdvice}Try this summary format: "Motivated [role] with experience in [top matching skills], focused on solving [employer problem]. Strong in [tool/technology], with projects that show [measurable impact]." Share your exact background and I can make it specific.`
  }

  if (normalizedPrompt.includes('project')) {
    return `${keywordAdvice}For each project, use this structure: project name, tech stack, employer-relevant problem solved, your contribution, and result. Example bullet: "Built a React dashboard that reduced manual tracking time by 40% using reusable components and filtered views."`
  }

  if (normalizedPrompt.includes('skill')) {
    return `${keywordAdvice}Create a Skills section that mirrors the job language. Group it into Languages, Frontend, Backend, Databases, Tools, and Soft Skills, but include only skills you can honestly discuss.`
  }

  if (normalizedPrompt.includes('fresher') || normalizedPrompt.includes('student')) {
    return `${keywordAdvice}For a fresher resume, lead with Education, Skills, Projects, Internships or Training, Certifications, and Achievements. Your projects should echo the job description, so each bullet should show what you built and why it matters for this employer.`
  }

  if (normalizedPrompt.includes('experience') || normalizedPrompt.includes('work')) {
    return `${keywordAdvice}Write experience bullets with this pattern: action verb + job-relevant task + tool/skill + measurable result. Avoid "responsible for" and use words like built, improved, automated, designed, analysed, or led.`
  }

  return `${keywordAdvice}Now send your target role, education, top 6 skills, 2 projects, and any internship or work experience. I will convert that into a job-targeted professional summary and resume bullet points.`
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
