# MCPeek OAuth 2.1 Implementation Specification

**Authors:** Didier PH Martin & Claude Code (Anthropic)
**Version:** 1.0.0
**Last Updated:** 2025-01-05
**MCP Protocol Version:** 2024-11-05 (with June 2025 OAuth updates)

## Purpose

This document specifies the exact OAuth 2.1 authorization flow implementation for MCPeek MCP client, ensuring full compliance with:
- MCP Authorization Specification (June 2025 revision)
- OAuth 2.1 (draft)
- RFC 9728 (Protected Resource Metadata)
- RFC 8707 (Resource Indicators)
- RFC 7636 (PKCE)
- RFC 9068 (JWT Access Tokens)

## Architecture Overview

### Three-Party Model

1. **MCPeek (MCP Client)** - Browser-based JavaScript application
2. **MCP Server (Resource Server)** - Protected MCP endpoints requiring authorization
3. **Authorization Server** - Issues and validates access tokens (separate from MCP server)

### Key Principle: Separation of Concerns

The MCP server MUST NOT be the authorization server. The authorization server can be:
- Existing enterprise IdP (Auth0, Okta, Keycloak)
- Dedicated OAuth server (Hydra, ORY)
- Custom implementation (as long as it's separate)

## Complete OAuth Flow (Client Perspective)

### Phase 1: Unauthenticated Request & Discovery

#### Step 1.1: Initial MCP Request
```javascript
// Client attempts to connect to MCP server without authorization
POST https://mcp.example.com/mcp
Headers:
  Content-Type: application/json

Body:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "clientInfo": { "name": "MCPeek", "version": "2.0.0" }
  }
}
```

#### Step 1.2: Server Returns 401 with Discovery Information
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="mcp:tools:read mcp:tools:call"
```

**Client MUST:**
- Parse `WWW-Authenticate` header
- Extract `resource_metadata` URL
- Extract `scope` parameter (if present) - these are the required scopes
- Store scope for later use in authorization request

**Fallback Discovery (if no resource_metadata in header):**
Try in order:
1. `https://mcp.example.com/.well-known/oauth-protected-resource/[mcp-path]`
2. `https://mcp.example.com/.well-known/oauth-protected-resource`

### Phase 2: Protected Resource Metadata Discovery

#### Step 2.1: Fetch Protected Resource Metadata
```javascript
GET https://mcp.example.com/.well-known/oauth-protected-resource

Response:
{
  "resource": "https://mcp.example.com",
  "authorization_servers": [
    "https://auth.example.com"
  ],
  "scopes_supported": [
    "mcp:tools:read",
    "mcp:tools:call",
    "mcp:prompts:read",
    "mcp:resources:read"
  ],
  "bearer_methods_supported": ["header"]
}
```

**Client MUST:**
- Verify `authorization_servers` array contains at least one entry
- Select an authorization server (typically first one)
- Store `resource` value for use in Resource Indicators
- Note `scopes_supported` for fallback if WWW-Authenticate didn't specify scopes

**CRITICAL:** The `resource` value MUST be used in authorization and token requests (RFC 8707)

### Phase 3: Authorization Server Discovery

#### Step 3.1: Fetch Authorization Server Metadata

For issuer URL: `https://auth.example.com/tenant1` (with path):
Try in order:
1. `https://auth.example.com/.well-known/oauth-authorization-server/tenant1`
2. `https://auth.example.com/.well-known/openid-configuration/tenant1`
3. `https://auth.example.com/tenant1/.well-known/openid-configuration`

For issuer URL: `https://auth.example.com` (no path):
Try in order:
1. `https://auth.example.com/.well-known/oauth-authorization-server`
2. `https://auth.example.com/.well-known/openid-configuration`

```javascript
GET https://auth.example.com/.well-known/oauth-authorization-server

Response:
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "registration_endpoint": "https://auth.example.com/register",
  "code_challenge_methods_supported": ["S256"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "response_types_supported": ["code"],
  "scopes_supported": ["mcp:tools:read", "mcp:tools:call"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_basic"]
}
```

**Client MUST:**
- Verify `code_challenge_methods_supported` includes "S256"
- **ABORT if PKCE is not supported** (security requirement)
- Store `authorization_endpoint` and `token_endpoint`
- Check if `registration_endpoint` exists (for dynamic client registration)

### Phase 4: Client Registration

#### Option A: Dynamic Client Registration (Preferred)
```javascript
POST https://auth.example.com/register
Content-Type: application/json

{
  "client_name": "MCPeek",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_method": "none",
  "application_type": "web"
}

Response:
{
  "client_id": "mcpeek_abc123",
  "client_secret": null,  // Public client
  "redirect_uris": ["http://localhost:8080/callback"]
}
```

**Client SHOULD:**
- Use dynamic registration when supported (reduces configuration burden)
- Register as public client (no client_secret for browser apps)
- Store `client_id` for authorization requests

#### Option B: Pre-configured Credentials
- Use client_id provided by administrator
- Store in localStorage or configuration

### Phase 5: PKCE Preparation

#### Step 5.1: Generate PKCE Parameters
```javascript
// Generate code_verifier (43-128 characters, unreserved characters only)
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Generate code_challenge using S256 method
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

// Base64-URL encoding (without padding)
function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

**Client MUST:**
- Generate cryptographically random `code_verifier` (43-128 chars)
- Generate `code_challenge` using SHA-256 hash of verifier
- Store `code_verifier` securely (sessionStorage) for later token exchange
- Use `code_challenge_method=S256` (MUST NOT use plain)

### Phase 6: Scope Selection

```javascript
function determineScopes(wwwAuthScope, metadataScopes) {
  // Priority 1: Use scopes from WWW-Authenticate header
  if (wwwAuthScope) {
    return wwwAuthScope;  // "mcp:tools:read mcp:tools:call"
  }

  // Priority 2: Use all scopes from Protected Resource Metadata
  if (metadataScopes && metadataScopes.length > 0) {
    return metadataScopes.join(' ');
  }

  // Fallback: minimal scope
  return 'mcp:tools:read';
}
```

**Client MUST:**
- Prioritize scopes from 401 WWW-Authenticate header
- Fallback to scopes_supported from Protected Resource Metadata
- Request space-separated scope string

### Phase 7: Authorization Request

#### Step 7.1: Build Authorization URL
```javascript
const authParams = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: 'http://localhost:8080/callback',
  scope: scopes,
  state: generateRandomState(),  // CSRF protection
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  resource: 'https://mcp.example.com'  // REQUIRED: Resource Indicator
});

const authUrl = `${authorizationEndpoint}?${authParams}`;
```

**Client MUST:**
- Include `resource` parameter with canonical MCP server URI
- Include PKCE parameters (code_challenge, code_challenge_method=S256)
- Include state parameter for CSRF protection
- Use HTTPS for authorization endpoint (except localhost)

**Resource Parameter Format:**
- ✅ Valid: `https://mcp.example.com`
- ✅ Valid: `https://mcp.example.com:8443`
- ✅ Valid: `https://mcp.example.com/mcp`
- ❌ Invalid: `mcp.example.com` (missing scheme)
- ❌ Invalid: `https://mcp.example.com#fragment` (contains fragment)

#### Step 7.2: Open Authorization Popup/Redirect
```javascript
// For browser-based clients: open popup
const popup = window.open(authUrl, 'oauth', 'width=600,height=700');

// Listen for callback
window.addEventListener('message', (event) => {
  if (event.origin === window.location.origin) {
    const { code, state, error } = event.data;
    if (error) {
      handleAuthorizationError(error);
    } else if (state === storedState) {
      exchangeCodeForToken(code);
    }
  }
});
```

**Client MUST:**
- Validate state parameter matches stored value
- Handle authorization errors (access_denied, etc.)
- Close popup after receiving callback

### Phase 8: Token Exchange

#### Step 8.1: Exchange Authorization Code for Access Token
```javascript
POST https://auth.example.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=http://localhost:8080/callback
&client_id=mcpeek_abc123
&code_verifier=CODE_VERIFIER  // PKCE validation
&resource=https://mcp.example.com  // REQUIRED: Resource Indicator

Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_abc123",
  "scope": "mcp:tools:read mcp:tools:call"
}
```

**Client MUST:**
- Include `code_verifier` (authorization server validates against code_challenge)
- Include `resource` parameter (MUST match authorization request)
- Store `access_token` securely (sessionStorage, NOT localStorage for security)
- Store `refresh_token` if provided
- Store `expires_in` to track token expiration
- Clear `code_verifier` after successful exchange

**Token Storage Security:**
- sessionStorage: Tokens cleared on tab close (more secure)
- localStorage: Tokens persist (less secure, but better UX)
- Recommendation: sessionStorage for access tokens, localStorage for refresh tokens

### Phase 9: Authorized MCP Requests

#### Step 9.1: Make MCP Request with Access Token
```javascript
POST https://mcp.example.com/mcp
Headers:
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

Body:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "clientInfo": { "name": "MCPeek", "version": "2.0.0" }
  }
}
```

**Client MUST:**
- Include `Authorization: Bearer <access_token>` header on EVERY request
- **NEVER** include token in URL query string
- **NEVER** include token in request body

### Phase 10: Token Refresh

#### Step 10.1: Refresh Expired Access Token
```javascript
// Check if token is expired or about to expire
if (Date.now() >= tokenExpiresAt - 60000) {  // Refresh 1 min before expiry
  POST https://auth.example.com/token
  Content-Type: application/x-www-form-urlencoded

  grant_type=refresh_token
  &refresh_token=refresh_abc123
  &client_id=mcpeek_abc123
  &resource=https://mcp.example.com  // REQUIRED: Resource Indicator

  Response:
  {
    "access_token": "new_access_token",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "new_refresh_token",  // May be rotated
    "scope": "mcp:tools:read mcp:tools:call"
  }
}
```

**Client MUST:**
- Include `resource` parameter in refresh requests
- Update stored access_token and refresh_token
- Handle refresh_token rotation (new refresh token may be issued)
- Re-initiate full OAuth flow if refresh fails (invalid_grant)

### Phase 11: Error Handling

#### Error 11.1: 401 Unauthorized (Invalid Token)
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", error_description="Token expired"
```

**Client MUST:**
- Attempt token refresh if refresh_token available
- Otherwise, restart full OAuth flow from Phase 1

#### Error 11.2: 403 Forbidden (Insufficient Scope)
```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope", scope="mcp:tools:call mcp:prompts:read"
```

**Client MUST:**
- Parse required scopes from WWW-Authenticate header
- Initiate "step-up authorization" with additional scopes
- Re-authorize user with combined scopes (existing + new)
- Retry original request with new token
- **Implement retry limit** (max 2-3 step-ups to prevent loops)

#### Error 11.3: 400 Bad Request
```
HTTP/1.1 400 Bad Request
{
  "error": "invalid_request",
  "error_description": "Missing resource parameter"
}
```

**Client MUST:**
- Log error details
- Display user-friendly error message
- Do NOT retry (indicates client bug)

## Implementation Requirements

### MUST Requirements (Non-Negotiable)

1. ✅ Generate PKCE with S256 method
2. ✅ Include `resource` parameter in authorization AND token requests
3. ✅ Verify authorization server supports PKCE (abort if not)
4. ✅ Include `Authorization: Bearer` header in all MCP requests
5. ✅ Use HTTPS for all authorization endpoints (except localhost)
6. ✅ Validate state parameter (CSRF protection)
7. ✅ Implement token refresh logic
8. ✅ Handle step-up authorization (403 insufficient_scope)
9. ✅ Clear sensitive data (code_verifier) after use
10. ✅ Implement retry limits for step-up authorization

### SHOULD Requirements (Recommended)

1. ✅ Support dynamic client registration
2. ✅ Use sessionStorage for access tokens (security)
3. ✅ Implement token expiration checking
4. ✅ Provide clear error messages to users
5. ✅ Log OAuth flow for debugging
6. ✅ Support multiple concurrent MCP servers with different auth

### MUST NOT Requirements (Prohibited)

1. ❌ Include tokens in URL query strings
2. ❌ Use PKCE plain method (only S256)
3. ❌ Proceed without PKCE support
4. ❌ Store tokens in cookies
5. ❌ Forward MCP server tokens to other APIs
6. ❌ Accept tokens not audience-restricted to this MCP server

## Security Considerations

### Token Storage
- **Access tokens:** sessionStorage (cleared on close)
- **Refresh tokens:** localStorage with encryption (persistence)
- **code_verifier:** sessionStorage (temporary, cleared after exchange)
- **Never:** cookies (CSRF risk)

### PKCE Protection
- Prevents authorization code interception
- Required for public clients (browser apps)
- S256 method prevents code_challenge reverse engineering

### Resource Indicators
- Prevents confused deputy attacks
- Ensures tokens only work with intended MCP server
- Authorization server MUST validate audience claim

### State Parameter
- Prevents CSRF attacks
- Must be cryptographically random
- Must be validated on callback

## Testing Checklist

- [ ] Test with protected MCP server requiring OAuth
- [ ] Test PKCE flow (verify code_challenge sent)
- [ ] Test resource parameter inclusion
- [ ] Test token refresh
- [ ] Test step-up authorization (insufficient_scope)
- [ ] Test error handling (401, 403, 400)
- [ ] Test state validation
- [ ] Test with multiple authorization servers
- [ ] Test dynamic client registration
- [ ] Test token expiration and refresh
- [ ] Test with SSE transport (authorization headers)
- [ ] Test with HTTP POST transport

## References

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7591: Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 9068: JWT Access Tokens](https://datatracker.ietf.org/doc/html/rfc9068)
- [Aaron Parecki: OAuth for MCP](https://aaronparecki.com/2025/04/03/15/oauth-for-model-context-protocol)

## Document Version History

- v1.0.0 (2025-01-05): Initial specification based on June 2025 MCP updates

---

**This specification is the authoritative reference for OAuth implementation in MCPeek.**
