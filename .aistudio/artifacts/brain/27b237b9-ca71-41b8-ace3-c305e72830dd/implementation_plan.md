# TalentMatch AI — Intelligent Recruitment & Candidate Screening Platform

TalentMatch AI is an end-to-end recruitment platform that streamlines technical hiring from public candidate application to automated AI screening, live in-browser coding assessments, structured HR interview rubrics, and weighted decision ranking.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key architecture and experience choices were confirmed during Phase 1:
> - **Bilingual Support (EN / VI)**: Real-time language switch across both the Candidate Portal and HR Recruiter Command Center, supporting Vietnamese university standards (GPA 4.0/10, TOEIC/IELTS, top universities like UIT, HUST, VNU) and international tech recruiting workflows.
> - **Interactive Live Coding Test Environment**: Candidate Round 2 module includes an in-browser code editor with pre-configured problem statements, test case execution runner, console output, and Gemini AI code quality analysis.
> - **Domain Focus (IT & AI Internships)**: Pre-populated with realistic job postings for AI Engineering Intern, Frontend Engineer Intern, and Backend / Fullstack Intern, populated with realistic candidate profiles and submissions.

- **Dual-Role Simulation Switcher**: A header toggle enables instant switching between **"Ứng viên (Candidate View)"** and **"Nhà tuyển dụng (HR Portal)"** with synchronized state, allowing immediate end-to-end demonstration.
- **Hybrid AI Engine**: Real Gemini 3.8 Flash backend via Express server (`POST /api/ai/screen-resume` and `POST /api/ai/review-code`) paired with a robust deterministic fallback engine so the application performs seamlessly whether network conditions or API keys vary.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Candidate Public Portal**: Multi-step application submission (Basic Information, Education & Academic Records, Achievements & Certifications, PDF/Doc CV parser simulation), real-time pipeline status tracker (Submitted → AI Screening → Coding Test & HR Interview → Final Decision), and an embedded technical coding assessment sandbox.
  2. **HR Recruiter Command Center**: Job listing creator/editor with custom criteria, Candidate Kanban & tabular pipeline with multi-factor filters (Status, University, GPA, AI Fit Score, Skills), AI Screening Studio with side-by-side JD comparison and 0–100% fit score with strengths & red flags, 1-click batch invite to Round 2, HR Interview Evaluation Scorecard, and a Weighted Total Score Decision Center.
- **Target Audience**: Tech interns/graduates applying for software engineering & AI roles, and HR/Tech hiring managers managing high-volume candidate pipelines.
- **Key Value**: Eliminates 80% of manual resume review toil, objectively verifies programming proficiency, and aggregates multi-stage signals into transparent hiring decisions.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Candidate Experience]
  Step 1: Browse Open Positions (AI Engineer, Frontend, Backend)
  Step 2: Multi-step Application Form (Profile + GPA + Certs + CV)
  Step 3: Real-Time Application Tracker (Pipeline Stage Visualizer)
  Step 4: Round 2 Live Coding Sandbox (Write code, run test cases, submit)

[HR Recruiter Experience]
  Step 1: Job Postings Manager (Define required skills, GPA minimums, coding test spec)
  Step 2: Candidate Pipeline (Switch between Kanban Board and High-Density Table)
  Step 3: AI Screening Studio (Run AI analysis, view radar chart, examine red flags)
  Step 4: Batch Invite to Round 2 (Automated email notification simulation)
  Step 5: Assessment Review & HR Interview Scorecard (Rubrics: Tech, Problem Solving, Soft Skills)
  Step 6: Weighted Decision Center (Adjust weights: AI / Code / HR -> Top Candidate Offer Letter)
```

### Visual Identity & Theme
- **Color Palette (60-30-10 Rule)**:
  - Canvas: Deep Slate / Navy `#0B0F19` and `#0F172A` providing a focused, high-contrast tech environment.
  - Structural Surfaces: Clean elevated slate cards `#1E293B` with subtle 1px hairline dividers (`border-slate-800`).
  - Accents: Indigo & Violet (`#6366F1`, `#8B5CF6`) for AI highlights, Emerald (`#10B981`) for Pass / Qualified, Amber (`#F59E0B`) for Under Review / Hold, and Rose (`#F43F5E`) for Rejected.
- **Typography & Tabular Discipline**:
  - Display & Headings: `Plus Jakarta Sans` for modern structural clarity.
  - Body Prose: `DM Sans` for high legibility.
  - Code & Metrics: Monospace `JetBrains Mono` and `font-mono tabular-nums` for GPAs, scores, percentages, and code lines.
- **Zero-Pill Metadata**: Tags, dates, and universities rendered with clean unboxed text and typographic separators (`·` or `/`). Status badges utilize high-contrast flat indicators with explicit text labels.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Stack Express Server with Gemini 3.8 Flash**
  - *Chosen Approach*: Server-side API endpoints (`/api/ai/screen-resume`, `/api/ai/review-code`) using `@google/genai` with `gemini-3.8-flash` and strict JSON schemas.
  - *Why*: Complies with server-side API key protection standards and generates structured evaluations (fit score, strengths, potential risks, recommendation).
  - *Fallback*: Instant local heuristic evaluation if API key is unconfigured or rate-limited.
- **Decision 2: Comprehensive Candidate Simulation State**
  - *Chosen Approach*: Pre-seeded database with 6 realistic tech intern profiles from top Vietnamese universities (UIT, HUST, HCMUS, BK Hanoi, Foreign Trade University) across different pipeline stages (Applied, Screened, Coding Passed, Interviewed, Offered).
  - *Why*: Allows immediate testing of all tabs, charts, score adjustments, and batch actions without forcing the user to manually enter dummy data first.
- **Decision 3: In-Browser Live Code Runner**
  - *Chosen Approach*: Interactive JavaScript/TypeScript sandbox with pre-built test cases (e.g. Array manipulation, Two Sum / Token matching, Data filtering), live syntax highlighting, console execution, and instant pass/fail validation.
  - *Why*: Provides a genuine coding test experience without needing third-party sandboxes.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TalentMatch AI Client                           │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand Wordmark, Portal Tabs, Lang Switcher, Role Switch)│
├──────────────────────────────────┬─────────────────────────────────────┤
│      ỨNG VIÊN / CANDIDATE        │         NHÀ TUYỂN DỤNG / HR         │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Job Catalog & Apply Modal      │ • Job Postings Management           │
│ • Multi-Step Application Form    │ • Candidate Pipeline (Kanban/Table) │
│ • Application Status Timeline    │ • AI Screening Studio & Radar Chart │
│ • Live Coding Test Sandbox       │ • HR Interview Scorecard Rubric     │
│                                  │ • Weighted Decision Ranking Center  │
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
                  ▼                                   ▼
        ┌───────────────────┐               ┌───────────────────┐
        │ LocalStorage State│               │ Express Backend   │
        │ Candidates & Jobs │               │ server.ts :3000   │
        └───────────────────┘               └─────────┬─────────┘
                                                      │
                                                      ▼
                                            ┌───────────────────┐
                                            │ @google/genai SDK │
                                            │ gemini-3.8-flash  │
                                            └───────────────────┘
```

### Data Model Entities
- **JobPosting**: `id`, `title`, `department`, `location`, `type`, `description`, `requirements`, `minGpa`, `englishRequirement`, `codingChallengeId`, `status`, `applicantCount`.
- **Candidate**: `id`, `jobId`, `fullName`, `email`, `phone`, `university`, `major`, `graduationYear`, `gpa`, `gpaScale` (4.0 | 10), `linkedinUrl`, `githubUrl`, `englishCert` (type, score), `techBadges`, `cvFileName`, `cvSummary`, `stage` (`applied` | `ai_screening` | `assessment` | `final_decision`), `status` (`pending` | `passed` | `hold` | `rejected`), `createdAt`.
- **AIScreeningReport**: `candidateId`, `fitScore` (0-100), `strengths` (array), `redFlags` (array), `recommendation` (`pass` | `hold` | `reject`), `skillMatch` (map of skills to 0-100), `summaryAnalysis`, `evaluatedAt`.
- **CodingSubmission**: `candidateId`, `problemId`, `code`, `testsPassed`, `totalTests`, `runtimeMs`, `aiCodeScore`, `aiCodeFeedback`, `submittedAt`.
- **HRScorecard**: `candidateId`, `interviewerName`, `technicalScore` (0-100), `problemSolvingScore` (0-100), `communicationScore` (0-100), `cultureFitScore` (0-100), `notes`, `recommendation`.
- **FinalRanking**: `candidateId`, `aiScore`, `codingScore`, `hrScore`, `weightedScore`, `rank`, `decision` (`hire` | `reserve` | `reject`).

---

## 5. Verification Plan

1. **Compilation & Build**: Run `compile_applet` to verify clean TypeScript compilation and Vite bundle without errors.
2. **Candidate Application Flow**: Verify step-by-step form validation, CV mock upload, and real-time status tracker updates.
3. **AI Screening Execution**: Verify clicking "Run AI Screening" updates score gauge, strengths, red flags, and batch invite.
4. **Coding Assessment Runner**: Test executing candidate code against unit test cases, validating console logs and test results.
5. **Decision Center Weighted Scoring**: Test dynamically moving weight sliders (e.g. AI 30%, Coding 40%, HR 30%) and observing instant re-ranking of candidates.
6. **Bilingual Switching**: Verify every screen, label, and report accurately transitions between English and Vietnamese.
