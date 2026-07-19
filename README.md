<div align="center">

# 🎯 ApplyIQ — Backend

REST API powering the ApplyIQ platform — auth, job data, application tracking, and AI reasoning.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-black?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/atlas)
[![Groq](https://img.shields.io/badge/AI-Groq%20%2F%20Llama-orange)](https://groq.com/)
[![License](https://img.shields.io/badge/license-MIT-green)]()

[🔗 Live API](#) · [🖥️ Frontend Repo](https://github.com/sokoo69/ApplyIQ-frontend) · [🌐 Live App](https://apply-iq-frontend.vercel.app/)

</div>

---

## 📖 Overview

This is the backend API for **ApplyIQ** — an AI-powered job application & career copilot. It handles authentication, job/application data, role-based access control, and — most importantly — the AI reasoning layer that powers cover letter generation, match scoring, and interview coaching.

The AI provider is fully isolated behind a single service wrapper, so it can be swapped (Groq, Gemini, OpenAI, etc.) without touching any feature logic.

🔗 **Live Frontend:** [https://apply-iq-frontend.vercel.app/](https://apply-iq-frontend.vercel.app/)

**Try it instantly:**

Email: test@test.com
Password: test1234
---

## 🧱 Tech Stack

- **Node.js + Express + TypeScript**
- **MongoDB Atlas** (Mongoose ODM)
- **Better Auth** — JWT plugin (httpOnly cookies) + Google OAuth
- **Groq** (Llama 3.3 70B / 3.1 8B) — LLM provider for all AI features
- **Zod** — request validation
- **Multer + pdf-parse** — resume PDF text extraction

---

## ✨ Core Capabilities

| Module | Description |
|---|---|
| 🔐 **Auth** | Register, login, Google OAuth, one-click demo login, logout — all JWT via httpOnly cookies |
| 🛡️ **RBAC** | `job_seeker` / `admin` roles enforced via middleware on every protected route — not just hidden UI, verified server-side |
| 💼 **Jobs** | Public read (search/filter/sort/pagination), admin-only write |
| 📌 **Applications** | Ownership-isolated tracking pipeline with duplicate-prevention (unique compound index on user+job) |
| 🤖 **AI Services** | Cover letter generation, 3-step agentic match scoring, streaming interview coach — all behind one swappable LLM wrapper |
| ⏱️ **Rate Limiting** | Per-user daily limits on all AI endpoints, with graceful 429 handling and reset timestamps |
| 📋 **Audit Log** | Tracks every admin job-management action (create/update/delete) with a human-readable change summary |
| 📄 **Resume Parsing** | Extracts text from uploaded PDF resumes in-memory, no file persistence |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas connection string
- Groq API key ([console.groq.com](https://console.groq.com))

### Installation

```bash
git clone https://github.com/sokoo69/ApplyIQ-backend.git
cd ApplyIQ-backend
npm install
cp .env.example .env
npm run dev
```

API runs at **http://localhost:8000**

### Environment Variables

```env
PORT=8000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<dbname>
FRONTEND_ORIGIN=http://localhost:3000
BETTER_AUTH_SECRET=your_better_auth_secret
BETTER_AUTH_URL=http://localhost:8000/api/v1/auth
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AI_LIMIT_COVER_LETTER=10
AI_LIMIT_MATCH_SCORE=15
AI_LIMIT_CHAT_MESSAGES=30
NODE_ENV=development
```

### Seed Test Data

```bash
npm run seed
```

Creates `test@test.com` / `test1234` (job seeker, fully populated with resume, applications, and chat history) and an admin test account.

---
---

## 📡 API Reference

| Route | Method | Access | Description |
|---|---|---|---|
| `/api/v1/auth/register` | POST | Public | Create account |
| `/api/v1/auth/login` | POST | Public | Email/password login |
| `/api/v1/auth/demo-login` | POST | Public | One-click demo login |
| `/api/v1/auth/google` | POST | Public | Google OAuth flow |
| `/api/v1/auth/logout` | POST | Auth | Clear session |
| `/api/v1/auth/me` | GET | Auth | Current session |
| `/api/v1/jobs` | GET | Public | List/filter/search/sort/paginate jobs |
| `/api/v1/jobs` | POST | Admin | Create job |
| `/api/v1/jobs/:id` | PATCH/DELETE | Admin | Update/delete job |
| `/api/v1/applications` | POST | Seeker | Track a job |
| `/api/v1/applications/me` | GET | Seeker | List own applications |
| `/api/v1/applications/:id` | PATCH/DELETE | Seeker | Update status / delete (ownership-checked) |
| `/api/v1/ai/cover-letter` | POST | Seeker | Generate cover letter |
| `/api/v1/ai/match` | POST | Seeker | Get 3-step agentic match score |
| `/api/v1/ai/match/feedback` | POST | Seeker | Record applied/rejected/saved signal |
| `/api/v1/ai/chat/sessions` | POST | Seeker | Start interview coach session |
| `/api/v1/ai/chat/sessions/:id/messages` | POST | Seeker | Send message (streams response) |
| `/api/v1/users/me` | PATCH | Auth | Update profile / resume text |
| `/api/v1/users/me/resume-upload` | POST | Auth | Upload PDF, extract resume text |
| `/api/v1/admin/jobs/:jobId/applications` | GET | Admin | View applicants for a job |
| `/api/v1/admin/applications/:id/status` | PATCH | Admin | Update applicant status |
| `/api/v1/admin/audit-log` | GET | Admin | View admin action history |
| `/api/v1/dashboard/summary` | GET | Seeker | Aggregated pipeline stats |
| `/api/v1/dashboard/skill-gaps` | GET | Seeker | Aggregated skill-gap trends |

---

## 🧠 AI Architecture

All LLM calls route through a **single wrapper function** (`src/services/llm.service.ts`), making the provider fully swappable:

Feature Services (coverLetter, matchScore, interviewCoach)
↓
llm.service.ts  ←  GROQ_API_KEY
↓
Groq API (Llama 3.3 70B / 3.1 8B)
The **Match Score** engine specifically runs 3 sequential Groq calls rather than one:

1. Extract structured skills/experience from the resume
2. Extract structured requirements from the job description
3. Compare both, factoring in a summary of the user's past feedback signals

Each step has its own retry-once-on-malformed-JSON logic, so a single bad response doesn't fail the entire request.

The **Interview Coach** sends the full conversation history (system context + every prior message) on every turn and streams the response back via Server-Sent Events — genuine memory, not a stateless Q&A loop.

---

## 🔒 Security Notes

- Passwords hashed, never stored in plain text
- JWT delivered via httpOnly cookies — never exposed to client-side JS
- Demo login endpoint hardcoded to one specific test account — cannot be used to authenticate arbitrary emails
- All admin routes protected by `requireRole("admin")` middleware, verified server-side (not just hidden UI)
- Per-user daily rate limits on every AI endpoint to prevent abuse and control API costs

---

## 👤 Author

**Saykot Biswas Shawon**
Full-Stack Developer · CSE Student, ULAB

- 🌐 Portfolio: [saykot.dev](https://saykot.dev)
- 💼 LinkedIn: [linkedin.com/in/saykot-biswas-shawon](https://linkedin.com/in/saykot-biswas-shawon)
- 🐙 GitHub: [github.com/sokoo69](https://github.com/sokoo69)
- 📧 Email: shawon.saykot2023@gmail.com

---

## 📄 License

MIT
