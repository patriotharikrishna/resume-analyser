# ResAi Resume Analyser

ResAi is a resume analysis web app that helps users review, improve, and tailor resumes before applying for jobs.

## Features

- Upload resumes in PDF, DOC, DOCX, TXT, or MD format.
- Preview uploaded resumes directly in the browser.
- Check resumes for ATS-friendly structure, weak wording, missing metrics, and missing skills sections.
- Add an employer job description to compare keywords and role alignment.
- Chat with an AI assistant about resume improvements.
- Create targeted resume content from a job description and user background.

## Tech Stack

- React
- JavaScript
- CSS
- Netlify Functions
- Hugging Face API

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Build the project for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Environment Variables

The AI chat feature uses a Netlify function. Add the required Hugging Face API key in your Netlify environment settings.

```bash
HF_TOKEN=your_hugging_face_token
```

## Project Structure

```text
src/
  App.jsx
  App.css
  index.css
netlify/
  functions/
    resume-chat.js
public/
  favicon.svg
  icons.svg
```

## Deployment

This project is configured for Netlify. The `netlify.toml` file controls the build command, publish directory, and serverless function location.
