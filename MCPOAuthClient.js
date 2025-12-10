/**
 * MCPOAuthClient.js
 * OAuth 2.1 Client for MCP Protocol
 *
 * Implements full OAuth 2.1 authorization flow for protected MCP servers:
 * - Protected Resource Metadata discovery (RFC 9728)
 * - Authorization Server discovery
 * - PKCE with S256 (RFC 7636)
 * - Resource Indicators (RFC 8707)
 * - Token management and refresh
 * - Step-up authorization
 *
 * Authors: Didier PH Martin & Claude Code (Anthropic)
 * Version: 1.0.0
 * License: MIT
 */

class MCPOAuthClient {
    constructor(mcpServerUrl, options = {}) {
        this.mcpServerUrl = mcpServerUrl;
        this.clientName = options.clientName || 'MCPeek';
        this.clientVersion = options.clientVersion || '2.0.0';
        this.logger = options.logger || console;

        // OAuth state
        this.authorizationServer = null;
        this.resourceMetadata = null;
        this.clientId = null;
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = null;
        this.scopes = null;

        // PKCE state
        this.codeVerifier = null;
        this.state = null;

        // Retry limits
        this.maxStepUpRetries = 3;
        this.stepUpRetryCount = 0;
    }

    /**
     * Main authorization flow entry point
     * Returns access token or throws error
     */
    async authorize(requiredScopes = null) {
        try {
            this.logger.log('🔐 Starting OAuth 2.1 authorization flow...');

            // Phase 1: Discovery
            await this.discoverProtectedResourceMetadata();
            await this.discoverAuthorizationServer();

            // Phase 2: Client registration
            await this.registerClient();

            // Phase 3: PKCE preparation
            this.preparePKCE();

            // Phase 4: Determine scopes
            const scopesToRequest = requiredScopes || this.resourceMetadata?.scopes_supported?.join(' ') || 'mcp:tools:read';

            // Phase 5: Authorization request
            const authCode = await this.requestAuthorization(scopesToRequest);

            // Phase 6: Token exchange
            await this.exchangeCodeForToken(authCode);

            this.logger.log('✅ OAuth authorization complete');
            return this.accessToken;

        } catch (error) {
            this.logger.error('❌ OAuth authorization failed:', error);
            throw error;
        }
    }

    /**
     * Phase 1: Discover Protected Resource Metadata (RFC 9728)
     */
    async discoverProtectedResourceMetadata() {
        this.logger.log('🔍 Discovering protected resource metadata...');

        const url = new URL(this.mcpServerUrl);
        const basePath = url.pathname.replace(/\/+$/, '');

        // Try well-known URIs in order
        const wellKnownPaths = [
            `/.well-known/oauth-protected-resource${basePath}`,
            '/.well-known/oauth-protected-resource'
        ];

        for (const path of wellKnownPaths) {
            try {
                const metadataUrl = `${url.origin}${path}`;
                this.logger.log(`  Trying: ${metadataUrl}`);

                const response = await fetch(metadataUrl);
                if (response.ok) {
                    this.resourceMetadata = await response.json();

                    // Validate metadata
                    if (!this.resourceMetadata.authorization_servers ||
                        this.resourceMetadata.authorization_servers.length === 0) {
                        throw new Error('Protected Resource Metadata missing authorization_servers');
                    }

                    this.logger.log(`  ✅ Found metadata at: ${metadataUrl}`);
                    this.logger.log(`  Authorization Server: ${this.resourceMetadata.authorization_servers[0]}`);

                    return;
                }
            } catch (error) {
                this.logger.log(`  ⚠️ Failed to fetch from ${path}: ${error.message}`);
            }
        }

        throw new Error('Failed to discover protected resource metadata. Server may not require OAuth.');
    }

    /**
     * Phase 2: Discover Authorization Server Metadata
     */
    async discoverAuthorizationServer() {
        this.logger.log('🔍 Discovering authorization server metadata...');

        const issuerUrl = new URL(this.resourceMetadata.authorization_servers[0]);
        const issuerPath = issuerUrl.pathname.replace(/\/+$/, '');

        // Try well-known URIs based on whether issuer has path
        const wellKnownPaths = issuerPath
            ? [
                `/.well-known/oauth-authorization-server${issuerPath}`,
                `/.well-known/openid-configuration${issuerPath}`,
                `${issuerPath}/.well-known/openid-configuration`
              ]
            : [
                '/.well-known/oauth-authorization-server',
                '/.well-known/openid-configuration'
              ];

        for (const path of wellKnownPaths) {
            try {
                const metadataUrl = `${issuerUrl.origin}${path}`;
                this.logger.log(`  Trying: ${metadataUrl}`);

                const response = await fetch(metadataUrl);
                if (response.ok) {
                    this.authorizationServer = await response.json();

                    // Validate PKCE support (REQUIRED)
                    if (!this.authorizationServer.code_challenge_methods_supported ||
                        !this.authorizationServer.code_challenge_methods_supported.includes('S256')) {
                        throw new Error('Authorization Server does not support PKCE with S256. ABORTING for security.');
                    }

                    this.logger.log(`  ✅ Found authorization server metadata`);
                    this.logger.log(`  Authorization Endpoint: ${this.authorizationServer.authorization_endpoint}`);
                    this.logger.log(`  Token Endpoint: ${this.authorizationServer.token_endpoint}`);
                    this.logger.log(`  PKCE Support: ✅ S256`);

                    return;
                }
            } catch (error) {
                this.logger.log(`  ⚠️ Failed to fetch from ${path}: ${error.message}`);
            }
        }

        throw new Error('Failed to discover authorization server metadata');
    }

    /**
     * Phase 3: Dynamic Client Registration (RFC 7591)
     */
    async registerClient() {
        // Check if already registered
        const storedClientId = this.getStoredClientId();
        if (storedClientId) {
            this.clientId = storedClientId;
            this.logger.log('✅ Using stored client ID');
            return;
        }

        // Check if dynamic registration is supported
        if (!this.authorizationServer.registration_endpoint) {
            this.logger.log('⚠️ Dynamic registration not supported. Using manual client ID...');
            this.clientId = prompt('Enter OAuth Client ID (or leave empty for public client):') || 'mcpeek-public-client';
            this.storeClientId(this.clientId);
            return;
        }

        this.logger.log('🔧 Registering dynamic client...');

        try {
            const redirectUri = `${window.location.origin}/oauth-callback.html`;

            const registrationRequest = {
                client_name: this.clientName,
                redirect_uris: [redirectUri],
                grant_types: ['authorization_code', 'refresh_token'],
                token_endpoint_auth_method: 'none', // Public client
                application_type: 'web'
            };

            const response = await fetch(this.authorizationServer.registration_endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationRequest)
            });

            if (!response.ok) {
                throw new Error(`Registration failed: ${response.status}`);
            }

            const registration = await response.json();
            this.clientId = registration.client_id;
            this.storeClientId(this.clientId);

            this.logger.log(`✅ Client registered: ${this.clientId}`);

        } catch (error) {
            this.logger.error('❌ Dynamic registration failed:', error);
            this.clientId = 'mcpeek-public-client';
            this.storeClientId(this.clientId);
        }
    }

    /**
     * Phase 4: Prepare PKCE (RFC 7636)
     */
    preparePKCE() {
        this.logger.log('🔐 Generating PKCE parameters...');

        // Generate code_verifier (43-128 characters)
        this.codeVerifier = this.generateCodeVerifier();

        // Generate code_challenge (SHA-256 hash of verifier)
        this.codeChallenge = this.generateCodeChallenge(this.codeVerifier);

        // Generate state for CSRF protection
        this.state = this.generateRandomString(32);

        // Store temporarily in sessionStorage
        sessionStorage.setItem('oauth_code_verifier', this.codeVerifier);
        sessionStorage.setItem('oauth_state', this.state);

        this.logger.log('  ✅ PKCE parameters generated');
    }

    /**
     * Generate cryptographically random code_verifier
     */
    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    /**
     * Generate code_challenge from code_verifier using S256
     */
    generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);

        return crypto.subtle.digest('SHA-256', data).then(digest => {
            return this.base64URLEncode(new Uint8Array(digest));
        });
    }

    /**
     * Base64-URL encoding without padding
     */
    base64URLEncode(buffer) {
        return btoa(String.fromCharCode(...buffer))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Generate random string
     */
    generateRandomString(length) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    /**
     * Phase 5: Authorization Request
     */
    async requestAuthorization(scopes) {
        this.logger.log('🚀 Initiating authorization request...');

        const codeChallenge = await this.codeChallenge;
        const redirectUri = `${window.location.origin}/oauth-callback.html`;

        // Get canonical resource URI (RFC 8707)
        const resourceUri = this.getCanonicalResourceUri();

        // Build authorization URL
        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: redirectUri,
            scope: scopes,
            state: this.state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            resource: resourceUri  // REQUIRED: Resource Indicator
        });

        const authUrl = `${this.authorizationServer.authorization_endpoint}?${authParams}`;

        this.logger.log(`  Authorization URL: ${authUrl}`);
        this.logger.log(`  Scopes: ${scopes}`);
        this.logger.log(`  Resource: ${resourceUri}`);

        // Open popup and wait for callback
        return this.openAuthorizationPopup(authUrl);
    }

    /**
     * Get canonical resource URI for Resource Indicators (RFC 8707)
     */
    getCanonicalResourceUri() {
        const url = new URL(this.mcpServerUrl);

        // Format: scheme://host[:port][/path]
        let canonicalUri = `${url.protocol}//${url.host}`;

        if (url.pathname && url.pathname !== '/') {
            canonicalUri += url.pathname;
        }

        // Remove trailing slash
        canonicalUri = canonicalUri.replace(/\/+$/, '');

        return canonicalUri;
    }

    /**
     * Open authorization popup and wait for callback
     */
    async openAuthorizationPopup(authUrl) {
        return new Promise((resolve, reject) => {
            // Open popup
            const width = 600;
            const height = 700;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;

            const popup = window.open(
                authUrl,
                'OAuth Authorization',
                `width=${width},height=${height},left=${left},top=${top}`
            );

            if (!popup) {
                reject(new Error('Failed to open authorization popup. Please allow popups.'));
                return;
            }

            // Listen for callback
            const messageHandler = (event) => {
                // Verify origin
                if (event.origin !== window.location.origin) {
                    return;
                }

                const { code, state, error, error_description } = event.data;

                // Clean up
                window.removeEventListener('message', messageHandler);
                popup.close();

                // Handle error
                if (error) {
                    reject(new Error(`Authorization failed: ${error} - ${error_description}`));
                    return;
                }

                // Validate state (CSRF protection)
                if (state !== this.state) {
                    reject(new Error('State mismatch. Possible CSRF attack.'));
                    return;
                }

                // Return authorization code
                resolve(code);
            };

            window.addEventListener('message', messageHandler);

            // Check if popup was closed without authorization
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    reject(new Error('Authorization cancelled by user'));
                }
            }, 1000);
        });
    }

    /**
     * Phase 6: Exchange Authorization Code for Access Token
     */
    async exchangeCodeForToken(authorizationCode) {
        this.logger.log('🔄 Exchanging authorization code for access token...');

        const redirectUri = `${window.location.origin}/oauth-callback.html`;
        const resourceUri = this.getCanonicalResourceUri();

        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: redirectUri,
            client_id: this.clientId,
            code_verifier: this.codeVerifier,  // PKCE validation
            resource: resourceUri  // REQUIRED: Resource Indicator
        });

        const response = await fetch(this.authorizationServer.token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Token exchange failed: ${error.error} - ${error.error_description}`);
        }

        const tokenResponse = await response.json();

        // Store tokens
        this.accessToken = tokenResponse.access_token;
        this.refreshToken = tokenResponse.refresh_token;
        this.scopes = tokenResponse.scope;

        // Calculate expiration
        if (tokenResponse.expires_in) {
            this.tokenExpiresAt = Date.now() + (tokenResponse.expires_in * 1000);
        }

        // Store tokens securely
        this.storeTokens();

        // Clear PKCE parameters
        sessionStorage.removeItem('oauth_code_verifier');
        sessionStorage.removeItem('oauth_state');

        this.logger.log('  ✅ Access token obtained');
        this.logger.log(`  Expires in: ${tokenResponse.expires_in} seconds`);
        this.logger.log(`  Scopes: ${this.scopes}`);
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available. Re-authorization required.');
        }

        this.logger.log('🔄 Refreshing access token...');

        const resourceUri = this.getCanonicalResourceUri();

        const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
            client_id: this.clientId,
            resource: resourceUri  // REQUIRED: Resource Indicator
        });

        const response = await fetch(this.authorizationServer.token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        if (!response.ok) {
            const error = await response.json();

            // If refresh fails, clear tokens and re-authorize
            if (error.error === 'invalid_grant') {
                this.clearTokens();
                throw new Error('Refresh token invalid. Re-authorization required.');
            }

            throw new Error(`Token refresh failed: ${error.error} - ${error.error_description}`);
        }

        const tokenResponse = await response.json();

        // Update tokens (refresh token may be rotated)
        this.accessToken = tokenResponse.access_token;
        if (tokenResponse.refresh_token) {
            this.refreshToken = tokenResponse.refresh_token;
        }
        this.scopes = tokenResponse.scope;

        // Calculate expiration
        if (tokenResponse.expires_in) {
            this.tokenExpiresAt = Date.now() + (tokenResponse.expires_in * 1000);
        }

        // Store updated tokens
        this.storeTokens();

        this.logger.log('  ✅ Access token refreshed');
    }

    /**
     * Get valid access token (refresh if needed)
     */
    async getAccessToken() {
        // Check if token exists
        if (!this.accessToken) {
            // Try to load from storage
            this.loadTokens();

            if (!this.accessToken) {
                throw new Error('No access token. Authorization required.');
            }
        }

        // Check if token is expired or about to expire (within 60 seconds)
        if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 60000) {
            await this.refreshAccessToken();
        }

        return this.accessToken;
    }

    /**
     * Handle step-up authorization (403 insufficient_scope)
     */
    async handleStepUpAuthorization(requiredScopes) {
        // Check retry limit
        if (this.stepUpRetryCount >= this.maxStepUpRetries) {
            throw new Error('Maximum step-up authorization retries exceeded');
        }

        this.stepUpRetryCount++;

        this.logger.log(`🔼 Step-up authorization required (attempt ${this.stepUpRetryCount}/${this.maxStepUpRetries})`);
        this.logger.log(`  Required scopes: ${requiredScopes}`);

        // Combine existing scopes with new requirements
        const existingScopes = this.scopes ? this.scopes.split(' ') : [];
        const newScopes = requiredScopes.split(' ');
        const combinedScopes = [...new Set([...existingScopes, ...newScopes])].join(' ');

        this.logger.log(`  Requesting combined scopes: ${combinedScopes}`);

        // Re-authorize with expanded scopes
        await this.authorize(combinedScopes);
    }

    /**
     * Storage methods
     */
    storeTokens() {
        const tokenData = {
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            expires_at: this.tokenExpiresAt,
            scopes: this.scopes,
            server_url: this.mcpServerUrl
        };

        // Store access token in sessionStorage (cleared on close)
        sessionStorage.setItem(`mcp_oauth_${this.mcpServerUrl}`, JSON.stringify({
            access_token: this.accessToken,
            expires_at: this.tokenExpiresAt
        }));

        // Store refresh token in localStorage (persistent)
        if (this.refreshToken) {
            localStorage.setItem(`mcp_oauth_refresh_${this.mcpServerUrl}`, JSON.stringify({
                refresh_token: this.refreshToken,
                scopes: this.scopes
            }));
        }
    }

    loadTokens() {
        // Load from sessionStorage first
        const sessionData = sessionStorage.getItem(`mcp_oauth_${this.mcpServerUrl}`);
        if (sessionData) {
            const data = JSON.parse(sessionData);
            this.accessToken = data.access_token;
            this.tokenExpiresAt = data.expires_at;
        }

        // Load refresh token from localStorage
        const localData = localStorage.getItem(`mcp_oauth_refresh_${this.mcpServerUrl}`);
        if (localData) {
            const data = JSON.parse(localData);
            this.refreshToken = data.refresh_token;
            this.scopes = data.scopes;
        }
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = null;
        this.scopes = null;

        sessionStorage.removeItem(`mcp_oauth_${this.mcpServerUrl}`);
        localStorage.removeItem(`mcp_oauth_refresh_${this.mcpServerUrl}`);
    }

    storeClientId(clientId) {
        localStorage.setItem(`mcp_oauth_client_id_${this.mcpServerUrl}`, clientId);
    }

    getStoredClientId() {
        return localStorage.getItem(`mcp_oauth_client_id_${this.mcpServerUrl}`);
    }
}
