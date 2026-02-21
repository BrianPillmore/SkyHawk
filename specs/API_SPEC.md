# SkyHawk API Specification

## Version: 1.0 (Planned - Backend)

## Base URL
```
/api/v1
```

## Authentication
JWT Bearer token in Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth
```
POST   /auth/register     - Create new account
POST   /auth/login         - Login and receive JWT
POST   /auth/refresh       - Refresh JWT token
GET    /auth/me            - Get current user profile
PUT    /auth/me            - Update profile
POST   /auth/forgot        - Request password reset
POST   /auth/reset         - Reset password with token
```

### Properties
```
GET    /properties                    - List user's properties (paginated)
POST   /properties                    - Create new property
GET    /properties/:id                - Get property details
PUT    /properties/:id                - Update property
DELETE /properties/:id                - Delete property
GET    /properties/search?q=address   - Search properties by address
```

### Measurements
```
GET    /properties/:id/measurements          - List measurements for property
POST   /properties/:id/measurements          - Create new measurement
GET    /measurements/:id                      - Get measurement details
PUT    /measurements/:id                      - Update measurement
DELETE /measurements/:id                      - Delete measurement
POST   /measurements/:id/duplicate            - Duplicate measurement
```

### Reports
```
POST   /reports/generate                      - Generate PDF report
GET    /reports                               - List generated reports
GET    /reports/:id                           - Get report metadata
GET    /reports/:id/download                  - Download PDF file
DELETE /reports/:id                           - Delete report
```

### Claims (Phase 3)
```
GET    /claims                                - List claims
POST   /claims                                - Create claim
GET    /claims/:id                            - Get claim details
PUT    /claims/:id                            - Update claim
PUT    /claims/:id/status                     - Update claim status
POST   /claims/:id/photos                    - Upload damage photos
GET    /claims/:id/photos                    - List claim photos
POST   /claims/:id/annotations               - Add damage annotation
```

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
- Standard: 100 requests/minute
- Report generation: 10 requests/minute
- File uploads: 20 requests/minute

## Pagination
```
GET /properties?page=1&limit=20&sort=-createdAt
```
Response includes:
```json
{
  "data": [],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```
