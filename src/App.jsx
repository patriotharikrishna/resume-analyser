import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  defaultSuggestions,
  createEmptyAnalysis,
  analyseJobDescription,
  callAiChat,
  callResumeAnalysis,
} from './utils'
import HomeView from './components/HomeView'
import AnalyserView from './components/AnalyserView'

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

  const sharedProps = {
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
  }

  if (currentView === 'home') {
    return (
      <HomeView
        setCurrentView={setCurrentView}
        builderInput={builderInput}
        setBuilderInput={setBuilderInput}
        isBuilderThinking={isBuilderThinking}
        setIsBuilderThinking={setIsBuilderThinking}
        builderMessages={builderMessages}
        setBuilderMessages={setBuilderMessages}
        {...sharedProps}
      />
    )
  }

  return (
    <AnalyserView
      setCurrentView={setCurrentView}
      {...sharedProps}
      suggestions={suggestions}
    />
  )
}

export default App
