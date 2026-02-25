# SkyHawk API Specification

> **Status: IMPLEMENTED — Express.js backend deployed on Hetzner VPS (89.167.94.69) with PostgreSQL database, JWT auth, and full CRUD for all resources.**

## Version: 2.0

## Base URL
```
/api
```

## Authentication
JWT Bearer token in Authorization header:
```
Authorization: Bearer <token>
```
API key authentication also supported via `X-API-Key` header for third-party integrations.

## Endpoints

### Auth
```
POST   /auth/register      - Create new account (returns JWT + reportCredits)
POST   /auth/login          - Login and receive JWT (returns JWT + reportCredits)
GET    /auth/me             - Get current user profile (includes reportCredits)
POST   /auth/use-credit     - Deduct 1 report credit (402 if balance ≤ 0)
POST   /auth/logout         - Logout (invalidate session)
```
**Not yet implemented:** `/auth/refresh`, `/auth/forgot`, `/auth/reset`

### Properties
```
GET    /properties                    - List user's properties
POST   /properties                    - Create new property
GET    /properties/:id                - Get property details
PUT    /properties/:id                - Update property
DELETE /properties/:id                - Delete property
```

### Measurements
```
GET    /properties/:id/measurements          - List measurements for property
POST   /properties/:id/measurements          - Create new measurement (transactional)
GET    /measurements/:id                      - Get measurement details (assembled graph)
PUT    /measurements/:id                      - Update measurement
DELETE /measurements/:id                      - Delete measurement
```

### Reports
```
POST   /reports/generate                      - Generate PDF report
GET    /reports                               - List generated reports
GET    /reports/:id                           - Get report metadata
GET    /reports/:id/download                  - Download PDF file
DELETE /reports/:id                           - Delete report
```

### Claims
```
GET    /claims                                - List claims
POST   /claims                                - Create claim
GET    /claims/:id                            - Get claim details
PUT    /claims/:id                            - Update claim
POST   /claims/:id/inspections               - Schedule inspection
PUT    /claims/:claimId/inspections/:id      - Update inspection
```

### EagleView Uploads
```
POST   /uploads/eagleview                     - Upload PDF, extract data, award 2 credits
GET    /uploads/eagleview                     - List user's uploads
GET    /uploads/eagleview/:id                 - Get single upload with extracted data
```

### Vision Analysis
```
POST   /vision/analyze                        - AI roof analysis via Claude Vision
POST   /vision/condition                      - Roof condition assessment
POST   /vision/detect-edges                   - Edge detection from imagery
```

### Organizations (Enterprise)
```
POST   /organizations                         - Create organization
GET    /organizations/:id                     - Get organization details
PUT    /organizations/:id                     - Update organization
POST   /organizations/:id/members            - Add member
DELETE /organizations/:id/members/:userId    - Remove member
```

### Sharing (Enterprise)
```
POST   /sharing/links                         - Create sharing link
GET    /sharing/links                         - List sharing links
DELETE /sharing/links/:id                     - Revoke sharing link
```

### Webhooks (Enterprise)
```
POST   /webhooks                              - Register webhook
GET    /webhooks                              - List webhooks
PUT    /webhooks/:id                          - Update webhook
DELETE /webhooks/:id                          - Delete webhook
```

### Audit Log (Enterprise)
```
GET    /audit                                 - Query audit log (paginated, filterable)
```

### API Keys (Enterprise)
```
POST   /api-keys                              - Create API key
GET    /api-keys                              - List API keys
DELETE /api-keys/:id                          - Revoke API key
```

### Checkout (Stripe)
```
POST   /checkout/session                      - Create Stripe checkout session
POST   /checkout/webhook                      - Stripe webhook handler
```

## Middleware Stack
- `auth.ts` — JWT token validation
- `rbac.ts` — Role-based access control (admin > manager > adjuster > roofer > viewer)
- `apiKeyAuth.ts` — API key authentication for third-party access
- `rateLimit.ts` — Rate limiting (20 requests/minute per IP)
- `auditLog.ts` — Logs all mutating requests to audit trail
- `validate.ts` — Request validation (requireFields, requireUuidParam, parseNumericQuery)

## Data Formats

### Property Request
```json
{
  "address": "string",
  "city": "string",
  "state": "string",
  "zip": "string",
  "lat": "number",
  "lng": "number",
  "notes": "string"
}
```

### Measurement Request
```json
{
  "vertices": [{ "id": "uuid", "lat": "number", "lng": "number" }],
  "edges": [{
    "id": "uuid",
    "startVertexId": "uuid",
    "endVertexId": "uuid",
    "type": "ridge|hip|valley|rake|eave|flashing|step-flashing",
    "lengthFt": "number"
  }],
  "facets": [{
    "id": "uuid",
    "name": "string",
    "vertexIds": ["uuid"],
    "pitch": "number",
    "areaSqFt": "number",
    "trueAreaSqFt": "number"
  }]
}
```

## Error Responses
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Rate Limits
- Standard: 20 requests/minute per IP (via express-rate-limit)
- Configurable per route

## Database Schema
PostgreSQL 16 with 18+ tables. See `server/db/migrations/001_initial_schema.sql` for full schema.
Key tables: users, properties, measurements, vertices, edges, facets, claims, organizations, audit_log, api_keys, eagleview_uploads.
