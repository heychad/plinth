# Zoom Integration

## Overview
HTTP webhook endpoint in Convex that receives Zoom `recording.transcript_completed` events, validates the signature, downloads the VTT transcript, parses it to plain text with speaker labels, stores it in Convex file storage, and triggers the coaching call analyzer pipeline. One Zoom Server-to-Server OAuth app covers all coaches under the organization account.

## Requirements

### Must Have
- Convex HTTP endpoint (httpAction) at `/webhooks/zoom` accepting POST requests
- Webhook signature validation using `x-zm-signature` header before any processing
- Subscribe to `recording.transcript_completed` event only (not `recording.completed`)
- VTT transcript download using the downloadToken from the webhook payload (valid for 24 hours)
- VTT → plain text parsing: strip WEBVTT header, strip timestamp lines, preserve speaker labels
- Speaker label extraction for coachTalkPercent computation (cumulative speaking time by speaker)
- Store raw VTT in Convex file storage and return storageId
- Trigger agentRun for the coaching-call-analyzer agent config matching this tenant
- Respond 200 OK within 3 seconds (Zoom requires timely acknowledgment); defer processing to a scheduled action

### Should Have
- Zoom challenge-response handshake handler (one-time validation when setting up webhook)
- Token refresh: Zoom Server-to-Server OAuth tokens expire hourly; auto-refresh before downloading
- zoomCredentials document per tenant storing Zoom Account ID, Client ID, Client Secret (encrypted)
- Mapping from Zoom userId to coach record (match on coachId field in agentConfig)
- Retry on download failure: if VTT download returns non-200, retry up to 3 times with 5s backoff

### Nice to Have
- Duplicate webhook protection: store processed zoomMeetingId values; ignore duplicate events for the same meeting
- Webhook event log for debugging (store raw payload for 30 days)

## Data Models

### Convex Document: zoomCredentials
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"zoomCredentials"> | yes | Convex auto-generated |
| tenantId | Id<"tenants"> | yes | Foreign key — one set per tenant |
| accountId | string | yes | Zoom Account ID (from Zoom Developer Portal) |
| clientId | string | yes | Zoom Server-to-Server OAuth Client ID |
| clientSecret | string | yes | Encrypted; never returned in queries |
| webhookSecretToken | string | yes | Encrypted; used for `x-zm-signature` validation |
| accessToken | string | no | Cached access token (encrypted) |
| accessTokenExpiresAt | number | no | Unix timestamp of cached token expiry |
| createdAt | number | yes | Unix timestamp |
| updatedAt | number | yes | Unix timestamp |

**Index:** `by_tenantId` on tenantId for fast lookup during webhook processing.

### Convex Document: zoomWebhookEvents
| Field | Type | Required | Description |
|---|---|---|---|
| _id | Id<"zoomWebhookEvents"> | yes | Convex auto-generated |
| tenantId | Id<"tenants"> | yes | Which tenant this event belongs to |
| zoomMeetingId | string | yes | Zoom meeting UUID (for deduplication) |
| eventType | string | yes | e.g., "recording.transcript_completed" |
| zoomUserId | string | yes | The Zoom user who hosted the recording |
| rawPayload | object | yes | Full webhook payload for debugging |
| processed | boolean | yes | Default false; true after successful processing |
| processedAt | number | no | Unix timestamp |
| agentRunId | Id<"agentRuns"> | no | Run triggered from this event |
| error | string | no | Error message if processing failed |
| createdAt | number | yes | Unix timestamp |

**Index:** `by_zoomMeetingId` on zoomMeetingId for deduplication checks; `by_tenantId_processed` on (tenantId, processed) for retry queue.

## API Contracts

### HTTP Endpoint: POST /webhooks/zoom
- **Handler:** Convex httpAction
- **Authentication:** Zoom webhook signature validation (not Clerk — this is an external webhook)
- **Headers required:** `x-zm-signature`, `x-zm-request-timestamp`
- **Request body:** Zoom webhook JSON payload
- **Response:** 200 OK with empty body within 3 seconds; all processing is deferred
- **Behavior:**
  1. Extract `x-zm-signature` and `x-zm-request-timestamp` headers
  2. Compute expected signature: `HMAC-SHA256(webhookSecretToken, "v0:{timestamp}:{raw_body}")` — format: `v0={hex_digest}`
  3. If signature mismatch: respond 400 Bad Request, do not process
  4. If event type is `endpoint.url_validation` (challenge): respond with `{ plainToken, encryptedToken }` challenge response
  5. If event type is `recording.transcript_completed`: resolve tenantId from Zoom accountId, schedule processZoomTranscript action, respond 200 OK
  6. Any other event type: respond 200 OK silently (ignore)

### Internal Action: processZoomTranscript
- **Signature:** `internalAction(ctx, { webhookEventId, zoomMeetingId, downloadUrl, downloadToken, zoomUserId, tenantId })`
- **Behavior:**
  1. Check for duplicate: query zoomWebhookEvents by zoomMeetingId + tenantId; if processed=true, skip
  2. Fetch Zoom access token via getOrRefreshZoomToken
  3. Download VTT file from downloadUrl using downloadToken as Bearer token
  4. If download fails: retry up to 3 times with 5s backoff; on final failure, mark event as error
  5. Store raw VTT in Convex file storage → get storageId
  6. Parse VTT to plain text and compute coachTalkPercent
  7. Query agentConfigs for tenantId where templateSlug = "coaching-call-analyzer" and status = "deployed"
  8. Trigger agentRun via triggerAgentRun with input: `{ zoomMeetingId, transcriptStorageId, parsedTranscript, coachTalkPercent, zoomUserId }`
  9. Update zoomWebhookEvents record: processed=true, agentRunId

### Internal Action: getOrRefreshZoomToken
- **Signature:** `internalAction(ctx, { tenantId }) => string`
- **Behavior:**
  1. Read zoomCredentials for tenantId
  2. If accessToken exists and accessTokenExpiresAt > now() + 60s: return cached accessToken
  3. Otherwise: POST to `https://zoom.us/oauth/token?grant_type=account_credentials&account_id={accountId}` with Basic auth (clientId:clientSecret)
  4. Store new accessToken and accessTokenExpiresAt (now + 3600s) in zoomCredentials
  5. Return new accessToken
- **Errors:** Throws ZoomAuthError if token request fails

### Mutation: saveZoomCredentials
- **Signature:** `mutation(ctx, { tenantId, accountId, clientId, clientSecret, webhookSecretToken }) => void`
- **Auth:** Consultant who owns the tenant
- **Behavior:** Upserts zoomCredentials document; clientSecret and webhookSecretToken are stored encrypted using Convex environment variable as key
- **Errors:** Throws if called by non-consultant role

### Query: getZoomConnectionStatus
- **Signature:** `query(ctx, { tenantId }) => { connected: boolean, accountId?: string, lastUsedAt?: number }`
- **Auth:** Tenant user or consultant
- **Returns:** Connection status without exposing credentials

## VTT Parsing Specification

### Input format (Zoom WebVTT):
```
WEBVTT

1
00:00:16.239 --> 00:00:27.079
John: Hi, this is a test for audio transcripts.

2
00:00:27.140 --> 00:00:35.220
Sarah: Great, let's get started.
```

### Parsing rules:
1. Discard the `WEBVTT` header line
2. Discard all timestamp lines (`HH:MM:SS.mmm --> HH:MM:SS.mmm`)
3. Discard blank lines and cue index numbers (lines that are only digits)
4. Preserve speaker-labeled lines: `{SpeakerName}: {text}`
5. If no speaker label on a line, attribute to the previous speaker
6. Output: concatenated plain text with `\n` between speaker turns, preserving `{Speaker}: {text}` format

### coachTalkPercent computation:
1. Parse each cue: extract start time, end time, speaker name, text
2. Accumulate total speaking time (seconds) per speaker
3. Identify the coach speaker: match against zoomUserId → coach record → coach display name
4. coachTalkPercent = (coachTotalSeconds / allSpeakersTotalSeconds) × 100, rounded to nearest integer
5. If coach speaker cannot be identified from Zoom userId: set coachTalkPercent = null (not fatal)

## Behavioral Constraints
- The webhook endpoint must respond within 3 seconds — Zoom will retry if no response is received. All actual processing (download, parse, run trigger) happens in a scheduled internalAction, not in the HTTP handler.
- Signature validation is mandatory — skip it only during local development. Never disable in production.
- The downloadToken is valid for 24 hours. If the processZoomTranscript action runs more than 24 hours after the webhook fires (due to queue delay), the token is expired. Fallback: use the stored Server-to-Server OAuth token to fetch a fresh download URL for the meeting.
- One Zoom webhook configuration covers the entire organization account — all coaches' recordings route through the same endpoint. The Zoom userId in the payload identifies which coach made the call.
- Tenant resolution from Zoom payload: match the Zoom accountId in the payload to zoomCredentials.accountId to find the tenantId. If no match, discard the event.
- Encrypted fields in zoomCredentials (clientSecret, webhookSecretToken, accessToken) are encrypted/decrypted using a platform-level secret stored in Convex environment variables — never in the DB unencrypted.

## Edge Cases
- **Challenge request (first setup):** When a Zoom admin adds the webhook URL, Zoom sends an `endpoint.url_validation` event with a `plainToken`. The endpoint must respond with `{ plainToken, encryptedToken: HMAC-SHA256(webhookSecretToken, plainToken) }` in hex encoding.
- **Recording.completed fires before transcript_completed:** Ignore `recording.completed` events entirely. Only process `recording.transcript_completed`.
- **No transcript file in payload:** Some Zoom recordings may complete without a transcript if transcription is disabled or the call was too short. If no `TRANSCRIPT` type file exists in the payload, mark the event as no-op and skip.
- **Duplicate webhook delivery:** Zoom may deliver the same event more than once. The deduplication check on zoomMeetingId + tenantId prevents running the same analysis twice.
- **Coach not found by Zoom userId:** If the Zoom userId cannot be matched to a coach record, the run proceeds with coachName = null. The admin sees the report with coach unknown and can manually tag it.
- **VTT file larger than 1 MiB:** Store in Convex file storage (no size limit there). The parsedTranscript field on coachingCallReports stores the plain text version (average coaching call transcript is ~40KB plain text, well within 1 MiB document limit).
- **Multiple coaching call analyzer configs for one tenant:** If a tenant has more than one deployed coaching-call-analyzer config (unlikely but possible), trigger a run for each. Each config may have a different rubric or curriculum configuration.

## Prerequisites (Must Be Resolved Before Deployment)
1. Zoom account must be on Business tier or above — Pro plan does not include auto-transcription
2. Auto-transcription must be enabled in Zoom Admin > Recording > Advanced Settings > "Create audio transcript"
3. Zoom Server-to-Server OAuth app must be created in Zoom Developer Portal with scopes: `cloud_recording:read:list_user_recordings:admin`, `cloud_recording:read:list_recording_files:admin`
4. Webhook subscription created in the Zoom app pointing to the Convex HTTP endpoint URL
5. Convex HTTP endpoint URL must be publicly reachable (Convex cloud deployment satisfies this)

## Dependencies
- `platform-foundation.md` — tenants document
- `coaching-call-analyzer.md` — the agent this webhook triggers
- `agent-execution-engine.md` — triggerAgentRun called after transcript processing
- Zoom Server-to-Server OAuth (external service)
- Convex file storage for VTT storage
