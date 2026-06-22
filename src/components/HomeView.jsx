import { analyseJobDescription, isTextLikeFile } from '../utils'
import ChatWindow from './ChatWindow'

export default function HomeView({
  setCurrentView,
  jobDescriptionFile,
  jobDescriptionText,
  jobDescriptionError,
  setJobDescriptionFile,
  setJobDescriptionText,
  setJobDescriptionError,
  builderInput,
  setBuilderInput,
  isBuilderThinking,
  setIsBuilderThinking,
  builderMessages,
  setBuilderMessages,
  callAiChat,
  jobAnalysis,
}) {
  const handleJobDescriptionUpload = (event) => {
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
  }

  const handleBuilderSubmit = async (event) => {
    event.preventDefault()

    const prompt = builderInput.trim()
    if (!prompt) {
      return
    }

    setBuilderInput('')
    setIsBuilderThinking(true)
    setBuilderMessages((messages) => [...messages, { role: 'user', text: prompt }])

    try {
      const answer = await callAiChat({
        mode: 'builder',
        question: prompt,
        jobDescription: jobAnalysis.source,
        jobKeywords: jobAnalysis.keywords,
      })

      setBuilderMessages((messages) => [...messages, { role: 'assistant', text: answer }])
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
  }

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
                onChange={handleJobDescriptionUpload}
              />
              <span>{jobDescriptionFile?.name || 'Upload employer job description'}</span>
              <small>TXT/MD can be analysed directly. PDF/DOCX can be uploaded, then pasted in chat.</small>
            </label>

            {jobDescriptionError && <p className="job-error">{jobDescriptionError}</p>}

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

            <ChatWindow messages={builderMessages} className="home-chat-window" />

            <form className="chat-form" onSubmit={handleBuilderSubmit}>
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
