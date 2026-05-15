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

The AI chat feature uses a Netlify function that requires a Hugging Face API token.

### Setup Instructions:

1. **Get a Hugging Face API Token:**
   - Go to https://huggingface.co/settings/tokens
   - Create a new token (or use an existing one)
   - Copy the token (starts with `hf_`)

2. **Add the token to Netlify:**
   - Go to your Netlify site dashboard
   - Navigate to: **Site settings → Build & deploy → Environment**
   - Click **Add environment variables**
   - Variable name: `HF_TOKEN`
   - Variable value: Paste your Hugging Face token
   - Click **Save**

3. **Redeploy your site:**
   - Go to **Deployments**
   - Click **Trigger deploy → Deploy site**
   - Wait for deployment to complete

### Alternative variable names (any of these work):
- `HF_TOKEN` (recommended)
- `HUGGING_FACE_API_KEY`
- `HUGGINGFACE_API_KEY`
- `HUGGING_FACE_TOKEN`

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
