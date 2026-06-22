import { formatFileSize, renderPreview } from '../utils'
import ChatWindow from './ChatWindow'

export default function AnalyserView({
  setCurrentView,
  file,
  setFile,
  previewUrl,
  resumeText,
  readError,
  analysis,
  analysisError,
  isAnalysing,
  analysisComplete,
  jobDescriptionFile,
  jobDescriptionText,
  jobDescriptionError,
  setJobDescriptionFile,
  setJobDescriptionText,
  setJobDescriptionError,
  chatInput,
  setChatInput,
  isResumeChatThinking,
  setIsResumeChatThinking,
  chatMessages,
  setChatMessages,
  callAiChat,
  jobAnalysis,
  resultsRef,
}) {
  const handleJobDescriptionUpload = (event) => {
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
  }

  const handleResumeUpload = (event) => {
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
  }

  const handleChatSubmit = async (event) => {
    event.preventDefault()
    const question = chatInput.trim()

    if (!question) {
      return
    }

    setChatInput('')
    setIsResumeChatThinking(true)
    setChatMessages((messages) => [...messages, { role: 'user', text: question }])

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

      setChatMessages((messages) => [...messages, { role: 'assistant', text: answer }])
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
  }

  const score = file ? analysis.score : 0
  const suggestions = file ? analysis.suggestions : []

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
                // Reset analysis UI while the job description changes.
                setJobDescriptionError('')
              }}
            />
            <label className="mini-upload">
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleJobDescriptionUpload}
              />
              Upload TXT/MD job description
            </label>
            {jobDescriptionError && <p className="job-error">{jobDescriptionError}</p>}
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
              onChange={handleResumeUpload}
            />
            <span className="upload-icon" aria-hidden="true">
              +
            </span>
            <span className="upload-title">{file?.name || 'Upload resume'}</span>
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
            <p>{file ? analysis.summary : 'Upload a resume to generate an analysis preview.'}</p>
          </div>

          <div className="checks-panel">
            <span className="panel-label">Quick checks</span>
            <div className="check-list">
              {analysis.issues.map((check) => (
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
                        <span className={`severity ${issue.severity}`}>{issue.severity}</span>
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

            <ChatWindow messages={chatMessages} />

            <form className="chat-form" onSubmit={handleChatSubmit}>
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
