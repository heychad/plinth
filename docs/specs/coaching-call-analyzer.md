# Coaching Call Analyzer

## Overview
A templatized coaching call quality analysis agent. Transcript in, structured scorecard out. The curriculum table, rubric dimensions, scoring scale, and notification threshold are configurable data stored in the agentConfig — not hardcoded for any specific program. The Growth Factor Implementation program (Daniela's 14-call business coaching program) is the first deployment of this template.

## Requirements

### Must Have
- 4-step pipeline: Intake → Analyze → Format → Deliver
- Configurable curriculum: per-call topic requirements stored in agentConfig.config.curriculum as a JSON array — not hardcoded
- Configurable rubric: scoring dimensions, point allocations, and anchor descriptions stored in agentConfig.config.rubricDimensions
- Configurable notification threshold: score below threshold triggers alert to program admin
- Structured AI output: Claude returns JSON matching AnalysisResult schema (via Zod structured output)
- Speaker-label parsing from VTT: compute coachTalkPercent from VTT timestamps + speaker labels before sending to Claude
- coachingCallReports documents: stores the analysis result, supports edit before delivery, tracks status
- Report delivery: formatted report to Google Docs; email notification via Resend to admin if flagged

### Should Have
- Report edit workflow: admin can edit the AI-generated narrative before sending to coach
- Coach portal: coaches see only reports the admin has explicitly released to them
- Manual call number fallback: admin can manually tag a transcript if automatic call number detection fails
- Score history: per-coach score trend queryable across reports
- Configurable report sections: which sections are shown to coach (admin may hide raw dimension scores)

### Nice to Have
- Slack DM notification to admin alongside email (Phase 2)
- Trend charts: per-coach score over time, per-call-number average score (Phase 2)
- Bonus call handling: admin picks topic from dropdown when reviewing a Bonus-tagged call

## Data Models

### Convex Document: coachingCallReports
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"coachingCallReports"> | yes | Convex auto-generated |
| tenantId | Id<"tenants"> | yes | Which tenant (coaching program) this report belongs to |
| agentRunId | Id<"agentRuns"> | yes | The run that produced this report |
| coachId | string | yes | External coach identifier (GHL user ID or internal coach record ID) |
| coachName | string | no | Display name of the coach |
| studentId | string | no | External student/client identifier |
| studentName | string | no | Display name of the student |
| callNumber | number \| "onboarding" \| "bonus" | yes | Call number in the program sequence |
| zoomMeetingId | string | no | Source Zoom meeting ID |
| recordedAt | number | no | Unix timestamp of the call |
| durationMinutes | number | no | Call duration in minutes |
| transcriptStorageId | string | yes | Convex file storage ID for the raw VTT transcript |
| parsedTranscript | string | no | Plain text transcript (VTT → text), stored separately if large |
| overallScore | number | yes | 0–100 computed from dimension scores |
| dimensionScores | object | yes | Map of dimension slug to score and notes (see AnalysisDimension type) |
| highlights | string[] | yes | 2–3 things the coach did well |
| concerns | string[] | yes | Specific issues to address |
| narrative | string | yes | AI-generated 3-paragraph feedback draft (editable before sending) |
| coachTalkPercent | number | no | Percent of speaking time by coach (derived from VTT) |
| flagged | boolean | yes | true if overallScore < threshold at time of analysis |
| status | "draft" \| "reviewed" \| "sent" \| "no_action" | yes | Report workflow state |
| editedNarrative | string | no | Admin's edited version; if set, this is what gets sent to coach |
| releasedToCoach | boolean | yes | Default false; true when admin sends the report |
| sentAt | number | no | Unix timestamp when sent to coach |
| rawAnalysisJson | object | yes | Full Claude structured output for debugging/audit |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

**Index:** `by_tenantId_status` on (tenantId, status); `by_tenantId_coachId` on (tenantId, coachId); `by_tenantId_flagged` on (tenantId, flagged); `by_agentRunId` on agentRunId.

### AnalysisDimension type (embedded in dimensionScores)
```typescript
{
  score: number,           // Points scored on this dimension
  maxScore: number,        // Maximum points available (from rubricDimensions config)
  notes: string,           // One-line explanation of the score with transcript evidence
  additionalData: object   // Dimension-specific fields, e.g., { topicsCovered, topicsMissed }
}
```

### Agent Config Shape (stored in agentConfigs.config)
This is the configurable data that makes the template work for any coaching program.

```typescript
{
  // Program identity
  programName: string,           // "Growth Factor Implementation"
  adminName: string,             // "Daniela"
  adminEmail: string,            // email to notify on flagged calls

  // Scoring configuration
  notificationThreshold: number, // Default 70; flag calls below this score

  // Rubric dimensions (drives both AI scoring and structured output schema)
  rubricDimensions: [
    {
      slug: string,              // "curriculum_adherence"
      displayName: string,       // "Curriculum Adherence"
      maxScore: number,          // 25
      description: string,       // "Did the coach cover required topics for this call number?"
      anchors: [                 // Score anchor descriptions for Claude
        { score: number, description: string }
        // e.g., { score: 25, description: "All required topics covered with depth" }
        // e.g., { score: 0, description: "Completely off-curriculum" }
      ]
    }
    // ...additional dimensions
  ],

  // Curriculum table (what Claude checks per call number)
  curriculum: [
    {
      callNumber: number | "onboarding" | "bonus",
      title: string,             // "Ideal Client Avatar"
      mustCoverTopics: string[], // ["ICA profile", "psychographics", "pain points"]
      expectedHomeworkReviewed: string,  // "ICA pre-work video"
      actionItemsToAssign: string[]      // ["ICA worksheet", "market research"]
    }
    // ...one entry per call in the program
  ],

  // Integration slots configured for this deployment
  googleDocsSlot: string,        // "google_docs" — slot name for report output
  resendFromEmail: string,       // "reports@smartscale.com"
  coachFeedbackEmailTemplate: string // Template name for coach notification email
}
```

**Locked fields (set by consultant at deploy time):** `rubricDimensions`, `curriculum`, `programName`
**Customizable fields (admin of the program can adjust):** `notificationThreshold`, `adminEmail`, `adminName`

## Four-Step Pipeline

### Step 0: Intake
- **Input:** Zoom webhook payload (zoomMeetingId, downloadUrl, downloadToken) OR manually provided transcript text + call number
- **Behavior:**
  1. Download VTT transcript from Zoom using downloadToken (expires 24h)
  2. Store raw VTT in Convex file storage → get storageId
  3. Parse VTT to plain text: strip timestamps, preserve speaker labels
  4. Compute coachTalkPercent from speaker labels and cumulative speaking time
  5. Determine callNumber from: (a) GHL contact lookup for automatic, (b) agentRun.input.callNumber for manual
  6. Write initial coachingCallReport document with transcript storageId, coachTalkPercent, callNumber
- **Output:** `{ reportId, transcriptText, callNumber, coachTalkPercent, coachName?, studentName? }`
- **Exit condition:** "inputs collected"

### Step 1: Analyze
- **Input:** transcriptText, callNumber, agentConfig.config (curriculum + rubricDimensions)
- **Behavior:**
  1. Look up curriculum entry for callNumber from agentConfig.config.curriculum
  2. Build analysis prompt: include full transcript, call-specific curriculum entry, rubric dimension anchors
  3. Call Claude (claude-sonnet-4-6) with messages.parse() using Zod structured output schema
  4. Validate output: all dimension scores present, sum ≤ total maxScore
  5. Compute overallScore = sum of all dimension scores
  6. Set flagged = overallScore < agentConfig.config.notificationThreshold
- **Output:** Full AnalysisResult object matching the Zod schema
- **Exit condition:** "analysis complete"

### Step 2: Format
- **Input:** AnalysisResult from Step 1 + agentConfig.config.programName
- **Behavior:**
  1. Format structured analysis into a clean human-readable report document
  2. Create Google Doc via google_docs integration slot
  3. Write formatted report to Google Doc (scorecard table, highlights, concerns, narrative)
  4. Return Google Doc URL
- **Output:** `{ docUrl: string, reportFormatted: string }`
- **Exit condition:** "report complete"

### Step 3: Deliver
- **Input:** AnalysisResult, docUrl, flagged, agentConfig.config
- **Behavior:**
  1. Update coachingCallReport document with overallScore, dimensionScores, highlights, concerns, narrative, docUrl, flagged
  2. If flagged: send email via Resend to adminEmail with subject "Flagged Call — [CoachName] — Call #[X] — [Score]/100" and docUrl link
  3. If not flagged: no notification sent; report saved to DB for admin to view at their convenience
- **Output:** `{ notificationSent: boolean, notificationChannel: "email" | null }`
- **Exit condition:** "notification ready"

## Zod Analysis Schema (used with Claude structured output)

```typescript
const AnalysisResultSchema = z.object({
  callNumber: z.union([z.number(), z.literal("onboarding"), z.literal("bonus")]),
  overallScore: z.number().min(0).max(100),
  dimensions: z.record(z.string(), z.object({   // keyed by dimension slug
    score: z.number(),
    notes: z.string(),
    additionalData: z.record(z.string(), z.unknown()).optional(),
  })),
  highlights: z.array(z.string()).min(1).max(5),
  concerns: z.array(z.string()).min(0).max(6),
  narrative: z.string(),                         // 3 paragraphs
  coachTalkPercent: z.number().min(0).max(100),
})
```

## API Contracts

### Query: getCoachingReport
- **Signature:** `query(ctx, { reportId }) => CoachingCallReport | null`
- **Auth:** Admin of the tenant (full access); coach users see only reports where releasedToCoach = true and coachId matches their coach record
- **Returns:** Full report; for coach callers, omit rawAnalysisJson and transcriptStorageId

### Query: listCoachingReports
- **Signature:** `query(ctx, { tenantId, coachId?, status?, flagged?, callNumber?, cursor?, limit? }) => { reports: CoachingCallReport[], nextCursor: string | null }`
- **Auth:** Admin sees all for their tenantId; coach sees only their released reports
- **Default sort:** Flagged first (flagged=true, status="draft"), then by createdAt descending

### Mutation: updateReportNarrative
- **Signature:** `mutation(ctx, { reportId, editedNarrative }) => void`
- **Auth:** Admin user only (role is "client" with admin_access claim, or consultant)
- **Behavior:** Sets editedNarrative and updates status to "reviewed"

### Mutation: sendReportToCoach
- **Signature:** `mutation(ctx, { reportId }) => void`
- **Auth:** Admin user only
- **Behavior:**
  1. Validate report status is "draft" or "reviewed" (not already "sent")
  2. Trigger email to coach: use editedNarrative if set, otherwise narrative
  3. Set releasedToCoach = true, status = "sent", sentAt = now()
- **Errors:** Throws if report is already "sent"

### Mutation: markNoAction
- **Signature:** `mutation(ctx, { reportId }) => void`
- **Auth:** Admin user only
- **Behavior:** Sets status = "no_action"; report is still visible in admin dashboard but removed from "needs attention" queue

### Query: getCoachScoreTrend
- **Signature:** `query(ctx, { tenantId, coachId, limitDays? }) => { date: string, score: number, callNumber: string }[]`
- **Auth:** Admin user or the specific coach (their own data only)
- **Returns:** One entry per report, ordered by createdAt ascending, limited to limitDays (default 90)

## Behavioral Constraints
- The rubric dimensions in agentConfig.config.rubricDimensions drive the Claude prompt — Claude is told to score exactly these dimensions, not a hardcoded list
- The curriculum table in agentConfig.config.curriculum is included in the analysis prompt for the specific callNumber — Claude does not have access to curriculum entries for other call numbers
- overallScore must equal the sum of all dimension scores — validated before storing the report
- A report can only be sent once (status transitions: draft → reviewed → sent or draft → no_action)
- editedNarrative takes precedence over narrative in all coach-facing views — if admin has edited, the raw AI narrative is never shown to the coach
- Coach users cannot see rawAnalysisJson, the full transcript, or reports where releasedToCoach = false
- notificationThreshold is per-deployment (agentConfig) not per-report — changing the threshold does not retroactively re-flag old reports

## Edge Cases
- **Call number cannot be determined automatically:** VTT transcript arrives but GHL lookup fails (or GHL integration not connected). The agentRun stalls at the Intake step waiting for manual intervention. Admin receives a "pending manual tagging" notification email. Admin opens the run, selects the call number, and retriggers from Step 1.
- **VTT download token expired:** Token is valid for 24 hours after webhook fires. If the action doesn't run within 24 hours (system down, queue backlog), the token is expired. Fallback: use the Zoom Server-to-Server OAuth token to re-request the download URL for the meeting ID.
- **Bonus call:** callNumber = "bonus". The curriculum lookup finds the bonus entry in the curriculum array. If no bonus entry exists, Claude uses a generic rubric anchor ("Topic-specific; assess appropriateness for the stated objective"). Admin can manually set the bonus topic by updating the report before sending.
- **Very short transcript (< 5 minutes):** Some Zoom calls are brief technical check-ins, not coaching calls. If transcript word count < 500, skip the analysis and create a report with status "no_action" and a note "Transcript too short for coaching analysis."
- **Transcript language other than English:** Claude analyzes in the transcript language but the report narrative is always in English. If Claude returns a narrative in another language, the raw output is stored but the report is flagged for admin review.
- **Score output out of range:** If Claude returns a dimension score exceeding maxScore (e.g., returns 30 for a 25-point dimension), cap the score at maxScore and log a warning. Do not fail the run.

## Growth Factor Implementation Configuration

This is the first deployment of the coaching-call-analyzer template. The following values are seeded into the agentConfig.config for Daniela's tenant:

```json
{
  "programName": "Growth Factor Implementation",
  "adminName": "Daniela",
  "notificationThreshold": 70,
  "rubricDimensions": [
    {
      "slug": "curriculum_adherence",
      "displayName": "Curriculum Adherence",
      "maxScore": 25,
      "description": "Did the coach cover the required topics for this specific call number?",
      "anchors": [
        { "score": 25, "description": "All required topics covered with depth" },
        { "score": 20, "description": "Most topics covered; one minor omission" },
        { "score": 15, "description": "Core topic covered but supporting elements missed" },
        { "score": 10, "description": "Topic partially addressed; significant gaps" },
        { "score": 5, "description": "Wrong topics covered / significant deviation" },
        { "score": 0, "description": "Completely off-curriculum" }
      ]
    },
    {
      "slug": "homework_follow_through",
      "displayName": "Homework & Action Item Follow-Through",
      "maxScore": 25,
      "description": "Did the coach review prior homework and assign clear next steps?",
      "anchors": [
        { "score": 25, "description": "Prior action items fully reviewed + new items assigned with deadlines" },
        { "score": 20, "description": "Homework reviewed briefly; action items assigned without full accountability" },
        { "score": 15, "description": "One of the two (review OR assignment) done well" },
        { "score": 10, "description": "Cursory mention only" },
        { "score": 0, "description": "Neither reviewed nor assigned" }
      ]
    },
    {
      "slug": "coaching_technique",
      "displayName": "Coaching Technique",
      "maxScore": 25,
      "description": "Active listening, asking vs. telling, holding space, not over-advising.",
      "anchors": [
        { "score": 25, "description": "Primarily question-based; client does most of the talking; empathetic; stays in coach role" },
        { "score": 20, "description": "Mostly coaching; occasional advice-giving or over-talking" },
        { "score": 15, "description": "Mixed; coach frequently shifted into consultant/advisor mode" },
        { "score": 10, "description": "Predominantly advice-giving; client was passive" },
        { "score": 0, "description": "Lecture/training mode; no coaching dynamic" }
      ]
    },
    {
      "slug": "client_progress_tracking",
      "displayName": "Client Progress Tracking",
      "maxScore": 25,
      "description": "Is the coach actively monitoring where the client is in the milestone system?",
      "anchors": [
        { "score": 25, "description": "Milestone tracker explicitly referenced; stuck points identified; progress celebrated" },
        { "score": 20, "description": "Progress discussed but not tied to milestone system" },
        { "score": 15, "description": "Progress mentioned in passing; no structured review" },
        { "score": 0, "description": "No reference to progress, milestones, or where client is in the journey" }
      ]
    }
  ],
  "curriculum": [
    {
      "callNumber": "onboarding",
      "title": "1:1 with Daniela",
      "mustCoverTopics": ["Program overview", "milestone tracker intro", "top 3 priorities", "90-day goals"],
      "expectedHomeworkReviewed": "n/a",
      "actionItemsToAssign": ["First call prep", "ICA worksheet"]
    },
    { "callNumber": 1, "title": "Ideal Client Avatar", "mustCoverTopics": ["ICA profile", "psychographics", "pain points", "desires", "business alignment to avatar"], "expectedHomeworkReviewed": "ICA pre-work video", "actionItemsToAssign": ["ICA worksheet", "market research", "competitor analysis"] },
    { "callNumber": 2, "title": "Pricing + Profitability", "mustCoverTopics": ["COT analysis", "profitability tracker", "POS reports", "loss leaders", "profit-based pricing"], "expectedHomeworkReviewed": "COT + Profitability Tracker video", "actionItemsToAssign": ["COT for all services", "POS data pull", "pricing adjustments"] },
    { "callNumber": 3, "title": "Cash Flow Mastery", "mustCoverTopics": ["YNAB setup", "business account structure", "cash flow patterns", "% allocations", "90-day forecast"], "expectedHomeworkReviewed": "YNAB pre-work", "actionItemsToAssign": ["YNAB setup + bank connection", "fund accounts", "first month allocation"] },
    { "callNumber": 4, "title": "Offers Architecture", "mustCoverTopics": ["Critical Number", "membership structure", "packages audit", "profit margins", "offer pricing matrix"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Membership design/revision", "package creation", "menu updates", "POS setup"] },
    { "callNumber": 5, "title": "Online Presence", "mustCoverTopics": ["Instagram audit", "Google Business Profile", "website review", "brand consistency", "30-day content plan"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Profile updates", "brand photo audit", "website copy", "GMB calendar"] },
    { "callNumber": 6, "title": "Marketing Systems", "mustCoverTopics": ["Email platform setup", "welcome sequence", "review automation", "referral program", "photo protocol", "90-day calendar"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Email sequences", "review automation", "referral launch", "photo system"] },
    { "callNumber": 7, "title": "Sales Process", "mustCoverTopics": ["Consultation framework", "sales training outline", "conversion tracking", "follow-up systems", "objection handling", "client acquisition cost"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Consultation script", "team training scheduled", "tracking spreadsheet", "follow-up automation"] },
    { "callNumber": 8, "title": "Client Journey & Retention", "mustCoverTopics": ["Client journey mapping", "retention program", "re-engagement campaign", "communication calendar", "win-back offer", "retention benchmarks"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Journey map", "retention build-out", "communication sequences", "re-engagement launch"] },
    { "callNumber": 9, "title": "Hiring & Onboarding", "mustCoverTopics": ["Job descriptions", "hiring process framework", "interview bank", "onboarding system", "training protocols"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Job descriptions", "hiring timeline", "onboarding checklist", "training manual started"] },
    { "callNumber": 10, "title": "Leadership & Team Culture", "mustCoverTopics": ["Daily huddle structure", "meeting agendas", "motivation systems", "communication protocols", "culture definition", "feedback frameworks"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Meeting templates", "huddle implementation", "recognition program", "culture doc"] },
    { "callNumber": 11, "title": "Team Compensation & Growth", "mustCoverTopics": ["Compensation review", "growth plan framework", "review/raise system", "non-monetary retention", "appreciation calendar"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Compensation audit", "growth plan templates", "review schedule", "appreciation program"] },
    { "callNumber": 12, "title": "Team Optimization", "mustCoverTopics": ["Staff development systems", "schedule optimization", "service assignment strategy", "productivity metrics", "capacity analysis"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Development plans per member", "schedule template", "capacity calculator", "productivity dashboard"] },
    { "callNumber": 13, "title": "Tech Stack & PM", "mustCoverTopics": ["Monday.com", "Google Drive org", "Loom for training", "Slack setup", "integration opportunities"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Monday.com boards", "Drive structure", "first Loom recorded", "tech stack doc"] },
    { "callNumber": 14, "title": "Lead Gen & Capacity", "mustCoverTopics": ["Lead flow strategy", "team utilization analysis", "CAC vs LTV", "hiring triggers", "90-day growth roadmap"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Lead flow calendar", "capacity calculator", "hiring triggers", "90-day action plan"] },
    { "callNumber": "bonus", "title": "Flexible Deep-Dive", "mustCoverTopics": ["Topic-specific (designated for this call)"], "expectedHomeworkReviewed": "Previous action items", "actionItemsToAssign": ["Topic-specific action items"] }
  ]
}
```

## Dependencies
- `agent-config-system.md` — agentTemplates and agentConfigs (this is one template instance)
- `agent-execution-engine.md` — pipeline execution engine runs the 4 steps
- `zoom-integration.md` — provides transcriptText and zoomMeetingId as run input
- `output-integrations.md` — Google Docs for report creation, Resend for notification email
- Anthropic SDK with Zod structured output for Step 1
