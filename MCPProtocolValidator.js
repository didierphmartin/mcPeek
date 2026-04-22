/**
 * MCP Protocol Validator
 * Validates MCP JSON-RPC 2.0 messages for protocol compliance across
 * all published MCP spec revisions.
 *
 * Created by Claude Code (Anthropic)
 * Supported specs: 2024-11-05, 2025-03-26, 2025-06-18, 2025-11-25
 */

class MCPProtocolValidator {
    // Ordered oldest → newest. Index = comparable rank.
    static SUPPORTED_VERSIONS = [
        '2024-11-05',
        '2025-03-26',
        '2025-06-18',
        '2025-11-25'
    ];
    static LATEST_VERSION = '2025-11-25';

    constructor(preferredVersion = MCPProtocolValidator.LATEST_VERSION) {
        this.preferredVersion = preferredVersion;
        // Populated from the server's initialize response
        this.negotiatedVersion = null;
        this.validationLog = [];
    }

    // Accessor used by legacy callers that expect `.protocolVersion`.
    // Returns the negotiated version if known, otherwise what the client prefers.
    get protocolVersion() {
        return this.negotiatedVersion || this.preferredVersion;
    }

    /** Is the given spec date one we recognize? */
    isKnownVersion(version) {
        return MCPProtocolValidator.SUPPORTED_VERSIONS.includes(version);
    }

    /** Compare two spec dates: -1 if a<b, 0 if equal, 1 if a>b, NaN if unknown. */
    compareVersions(a, b) {
        const ia = MCPProtocolValidator.SUPPORTED_VERSIONS.indexOf(a);
        const ib = MCPProtocolValidator.SUPPORTED_VERSIONS.indexOf(b);
        if (ia < 0 || ib < 0) return NaN;
        return Math.sign(ia - ib);
    }

    /** True if `version` is >= `minimum` (both must be known). */
    versionAtLeast(version, minimum) {
        const c = this.compareVersions(version, minimum);
        return !Number.isNaN(c) && c >= 0;
    }

    /**
     * Mandatory wire-observable requirements introduced at each spec revision.
     * Cumulative: an entry applies from `since` onward until explicitly superseded.
     * Sourced from the official MCP changelogs.
     */
    getVersionRequirements(version) {
        const reqs = [
            // ── 2024-11-05 baseline ──────────────────────────────────────
            { since: '2024-11-05', id: 'jsonrpc-2.0',
              text: 'Every message MUST use "jsonrpc": "2.0".' },
            { since: '2024-11-05', id: 'init-first',
              text: 'Initialize MUST be the first client→server interaction.' },
            { since: '2024-11-05', id: 'init-req-fields',
              text: 'initialize request MUST carry protocolVersion, capabilities, clientInfo.' },
            { since: '2024-11-05', id: 'init-res-fields',
              text: 'initialize response MUST carry protocolVersion, capabilities, serverInfo.' },
            { since: '2024-11-05', id: 'initialized-notif',
              text: 'Client MUST send notifications/initialized after a successful initialize.' },
            { since: '2024-11-05', id: 'capabilities-shape',
              text: 'capabilities.{tools,resources,prompts} MUST be objects, never arrays.' },
            { since: '2024-11-05', id: 'version-negotiation',
              text: 'If server cannot honor requested protocolVersion it MUST reply with one it supports.' },

            // ── 2025-03-26 ──────────────────────────────────────────────
            { since: '2025-03-26', id: 'oauth-2.1',
              text: 'Authorization (when used) MUST follow the OAuth 2.1 framework.' },
            { since: '2025-03-26', id: 'streamable-http',
              text: 'Streamable HTTP transport replaces the legacy HTTP+SSE transport.' },

            // ── 2025-06-18 ──────────────────────────────────────────────
            { since: '2025-06-18', id: 'mcp-protocol-version-header',
              text: 'Client MUST send MCP-Protocol-Version header with the negotiated version on every post-initialize HTTP request.' },
            { since: '2025-06-18', id: 'no-batching',
              text: 'JSON-RPC batching is REMOVED — MUST NOT send arrays of requests.' },
            { since: '2025-06-18', id: 'resource-indicators',
              text: 'OAuth clients MUST implement Resource Indicators (RFC 8707).' },
            { since: '2025-06-18', id: 'lifecycle-must',
              text: 'Operation-phase capability respect strengthened from SHOULD to MUST.' },

            // ── 2025-11-25 ──────────────────────────────────────────────
            { since: '2025-11-25', id: 'oidc-discovery',
              text: 'Authorization-server discovery MUST support OpenID Connect Discovery 1.0.' },
            { since: '2025-11-25', id: 'origin-403',
              text: 'Servers MUST return HTTP 403 for invalid Origin headers on Streamable HTTP.' },
            { since: '2025-11-25', id: 'incremental-consent',
              text: 'Step-up auth via WWW-Authenticate with insufficient_scope supported.' }
        ];
        if (!this.isKnownVersion(version)) return reqs;
        return reqs.filter(r => this.versionAtLeast(version, r.since));
    }

    /**
     * Validate initialize response.
     * Accepts any version in SUPPORTED_VERSIONS; captures the negotiated version
     * so later calls (e.g. MCP-Protocol-Version headers) can reuse it.
     */
    validateInitializeResponse(response) {
        const errors = [];
        const warnings = [];

        // Validate JSON-RPC 2.0 format
        const rpcValidation = this.validateJSONRPC(response);
        errors.push(...rpcValidation.errors);
        warnings.push(...rpcValidation.warnings);

        if (!response.result) {
            errors.push('Missing "result" field in initialize response');
            return { valid: false, errors, warnings };
        }

        const result = response.result;

        // Validate protocolVersion — accept any known spec revision
        if (!result.protocolVersion) {
            errors.push('Missing "protocolVersion" in initialize result');
        } else if (!this.isKnownVersion(result.protocolVersion)) {
            warnings.push(`Unknown protocol version "${result.protocolVersion}". Known: ${MCPProtocolValidator.SUPPORTED_VERSIONS.join(', ')}`);
            this.negotiatedVersion = result.protocolVersion; // still record it
        } else {
            this.negotiatedVersion = result.protocolVersion;
            if (result.protocolVersion !== this.preferredVersion) {
                warnings.push(`Negotiated protocol version "${result.protocolVersion}" differs from client preferred "${this.preferredVersion}" — both are supported, continuing.`);
            }
        }

        // Validate capabilities
        if (!result.capabilities) {
            errors.push('Missing "capabilities" in initialize result');
        } else {
            const capValidation = this.validateCapabilities(result.capabilities);
            errors.push(...capValidation.errors);
            warnings.push(...capValidation.warnings);
        }

        // Validate serverInfo (per 2024-11-05 lifecycle, server MUST include it)
        if (!result.serverInfo) {
            errors.push('Missing "serverInfo" in initialize result (required by MCP lifecycle)');
        } else {
            if (!result.serverInfo.name) {
                errors.push('Missing "serverInfo.name"');
            }
            if (!result.serverInfo.version) {
                errors.push('Missing "serverInfo.version"');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            negotiatedVersion: this.negotiatedVersion,
            mandatoryChecklist: this.buildMandatoryChecklist(this.negotiatedVersion, result)
        };
    }

    /**
     * Build a pass/fail checklist of mandatory items for the negotiated version,
     * evaluating the ones we can actually observe on this initialize result.
     */
    buildMandatoryChecklist(version, initResult) {
        if (!version) return [];
        const reqs = this.getVersionRequirements(version);
        return reqs.map(r => {
            let status = 'info'; // 'pass' | 'fail' | 'info' (can't verify here)
            switch (r.id) {
                case 'init-res-fields': {
                    const ok = !!(initResult && initResult.protocolVersion && initResult.capabilities && initResult.serverInfo);
                    status = ok ? 'pass' : 'fail';
                    break;
                }
                case 'capabilities-shape': {
                    const caps = initResult && initResult.capabilities;
                    const bad = caps && ['tools','resources','prompts'].some(k => Array.isArray(caps[k]));
                    status = caps ? (bad ? 'fail' : 'pass') : 'info';
                    break;
                }
                case 'jsonrpc-2.0':
                    status = 'pass'; // validated at message level above
                    break;
            }
            return { ...r, status };
        });
    }

    /**
     * Validate capabilities object
     * @param {Object} capabilities - Capabilities object
     * @returns {Object} - Validation result
     */
    validateCapabilities(capabilities) {
        const errors = [];
        const warnings = [];

        if (typeof capabilities !== 'object' || capabilities === null) {
            errors.push('capabilities must be an object');
            return { errors, warnings };
        }

        // Validate tools capability
        if ('tools' in capabilities) {
            // CRITICAL: tools must be an empty object {}, not an array []
            if (Array.isArray(capabilities.tools)) {
                errors.push('❌ CRITICAL: capabilities.tools must be an object {}, not an array []');
                errors.push('   Fix: Change "tools": [] to "tools": {} or "tools": (object)[]');
            } else if (typeof capabilities.tools !== 'object') {
                errors.push('capabilities.tools must be an object');
            }
        }

        // Validate resources capability
        if ('resources' in capabilities) {
            if (Array.isArray(capabilities.resources)) {
                errors.push('❌ CRITICAL: capabilities.resources must be an object {}, not an array []');
            } else if (typeof capabilities.resources !== 'object') {
                errors.push('capabilities.resources must be an object');
            }
        }

        // Validate prompts capability
        if ('prompts' in capabilities) {
            if (Array.isArray(capabilities.prompts)) {
                errors.push('❌ CRITICAL: capabilities.prompts must be an object {}, not an array []');
            } else if (typeof capabilities.prompts !== 'object') {
                errors.push('capabilities.prompts must be an object');
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate tools/list response
     * @param {Object} response - JSON-RPC response
     * @returns {Object} - Validation result
     */
    validateToolsListResponse(response) {
        const errors = [];
        const warnings = [];

        // Validate JSON-RPC 2.0 format
        const rpcValidation = this.validateJSONRPC(response);
        errors.push(...rpcValidation.errors);
        warnings.push(...rpcValidation.warnings);

        if (!response.result) {
            errors.push('Missing "result" field in tools/list response');
            return { valid: false, errors, warnings };
        }

        const result = response.result;

        // Validate tools array
        if (!result.tools) {
            errors.push('Missing "tools" array in tools/list result');
        } else if (!Array.isArray(result.tools)) {
            errors.push('result.tools must be an array');
        } else {
            // Validate each tool
            result.tools.forEach((tool, index) => {
                const toolValidation = this.validateTool(tool, index);
                errors.push(...toolValidation.errors);
                warnings.push(...toolValidation.warnings);
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a single tool definition
     * @param {Object} tool - Tool definition
     * @param {number} index - Tool index in array
     * @returns {Object} - Validation result
     */
    validateTool(tool, index) {
        const errors = [];
        const warnings = [];
        const toolId = tool.name || `tool[${index}]`;

        // Validate name
        if (!tool.name) {
            errors.push(`${toolId}: Missing "name" field`);
        } else if (typeof tool.name !== 'string') {
            errors.push(`${toolId}: "name" must be a string`);
        }

        // Validate description (optional but recommended)
        if (!tool.description) {
            warnings.push(`${toolId}: Missing "description" (recommended)`);
        }

        // Validate inputSchema
        if (!tool.inputSchema) {
            errors.push(`${toolId}: Missing "inputSchema" field`);
        } else {
            const schemaValidation = this.validateInputSchema(tool.inputSchema, toolId);
            errors.push(...schemaValidation.errors);
            warnings.push(...schemaValidation.warnings);
        }

        return { errors, warnings };
    }

    /**
     * Validate tool inputSchema
     * @param {Object} schema - Input schema object
     * @param {string} toolId - Tool identifier for error messages
     * @returns {Object} - Validation result
     */
    validateInputSchema(schema, toolId) {
        const errors = [];
        const warnings = [];

        if (typeof schema !== 'object' || schema === null) {
            errors.push(`${toolId}.inputSchema: Must be an object`);
            return { errors, warnings };
        }

        // Validate type
        if (schema.type !== 'object') {
            errors.push(`${toolId}.inputSchema.type: Must be "object", got "${schema.type}"`);
        }

        // Validate properties
        if ('properties' in schema) {
            // CRITICAL: properties must be an object {}, not an array []
            if (Array.isArray(schema.properties)) {
                errors.push(`❌ CRITICAL: ${toolId}.inputSchema.properties must be an object {}, not an array []`);
                errors.push(`   Fix: Change "properties": [] to "properties": {} or "properties": (object)[]`);
            } else if (typeof schema.properties !== 'object') {
                errors.push(`${toolId}.inputSchema.properties: Must be an object`);
            } else {
                // Validate each property
                for (const [propName, propDef] of Object.entries(schema.properties)) {
                    if (typeof propDef !== 'object') {
                        errors.push(`${toolId}.inputSchema.properties.${propName}: Must be an object`);
                    }
                    if (!propDef.type) {
                        warnings.push(`${toolId}.inputSchema.properties.${propName}: Missing "type" field`);
                    }
                }
            }
        }

        // Validate required array
        if ('required' in schema) {
            if (!Array.isArray(schema.required)) {
                errors.push(`${toolId}.inputSchema.required: Must be an array`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate resources/list response
     * @param {Object} response - JSON-RPC response
     * @returns {Object} - Validation result
     */
    validateResourcesListResponse(response) {
        const errors = [];
        const warnings = [];

        // Validate JSON-RPC 2.0 format
        const rpcValidation = this.validateJSONRPC(response);
        errors.push(...rpcValidation.errors);
        warnings.push(...rpcValidation.warnings);

        if (!response.result) {
            errors.push('Missing "result" field in resources/list response');
            return { valid: false, errors, warnings };
        }

        const result = response.result;

        // Validate resources array
        if (!result.resources) {
            errors.push('Missing "resources" array in resources/list result');
        } else if (!Array.isArray(result.resources)) {
            errors.push('result.resources must be an array');
        } else {
            // Validate each resource
            result.resources.forEach((resource, index) => {
                const resourceValidation = this.validateResource(resource, index);
                errors.push(...resourceValidation.errors);
                warnings.push(...resourceValidation.warnings);
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a single resource definition
     * @param {Object} resource - Resource definition
     * @param {number} index - Resource index in array
     * @returns {Object} - Validation result
     */
    validateResource(resource, index) {
        const errors = [];
        const warnings = [];
        const resourceId = resource.name || resource.uri || `resource[${index}]`;

        // Validate uri (required)
        if (!resource.uri) {
            errors.push(`${resourceId}: Missing "uri" field (required)`);
        } else if (typeof resource.uri !== 'string') {
            errors.push(`${resourceId}: "uri" must be a string`);
        }

        // Validate name (optional but recommended)
        if (!resource.name) {
            warnings.push(`${resourceId}: Missing "name" field (recommended)`);
        }

        // Validate description (optional)
        if (resource.description && typeof resource.description !== 'string') {
            errors.push(`${resourceId}: "description" must be a string`);
        }

        // Validate mimeType (optional)
        if (resource.mimeType && typeof resource.mimeType !== 'string') {
            errors.push(`${resourceId}: "mimeType" must be a string`);
        }

        return { errors, warnings };
    }

    /**
     * Validate prompts/list response
     * @param {Object} response - JSON-RPC response
     * @returns {Object} - Validation result
     */
    validatePromptsListResponse(response) {
        const errors = [];
        const warnings = [];

        // Validate JSON-RPC 2.0 format
        const rpcValidation = this.validateJSONRPC(response);
        errors.push(...rpcValidation.errors);
        warnings.push(...rpcValidation.warnings);

        if (!response.result) {
            errors.push('Missing "result" field in prompts/list response');
            return { valid: false, errors, warnings };
        }

        const result = response.result;

        // Validate prompts array
        if (!result.prompts) {
            errors.push('Missing "prompts" array in prompts/list result');
        } else if (!Array.isArray(result.prompts)) {
            errors.push('result.prompts must be an array');
        } else {
            // Validate each prompt
            result.prompts.forEach((prompt, index) => {
                const promptValidation = this.validatePrompt(prompt, index);
                errors.push(...promptValidation.errors);
                warnings.push(...promptValidation.warnings);
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a single prompt definition
     * @param {Object} prompt - Prompt definition
     * @param {number} index - Prompt index in array
     * @returns {Object} - Validation result
     */
    validatePrompt(prompt, index) {
        const errors = [];
        const warnings = [];
        const promptId = prompt.name || `prompt[${index}]`;

        // Validate name (required)
        if (!prompt.name) {
            errors.push(`${promptId}: Missing "name" field (required)`);
        } else if (typeof prompt.name !== 'string') {
            errors.push(`${promptId}: "name" must be a string`);
        }

        // Validate description (optional but recommended)
        if (!prompt.description) {
            warnings.push(`${promptId}: Missing "description" (recommended)`);
        }

        // Validate arguments (optional)
        if (prompt.arguments) {
            if (!Array.isArray(prompt.arguments)) {
                errors.push(`${promptId}: "arguments" must be an array`);
            } else {
                prompt.arguments.forEach((arg, argIndex) => {
                    const argValidation = this.validatePromptArgument(arg, promptId, argIndex);
                    errors.push(...argValidation.errors);
                    warnings.push(...argValidation.warnings);
                });
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate a prompt argument definition
     * @param {Object} arg - Argument definition
     * @param {string} promptId - Parent prompt identifier
     * @param {number} index - Argument index
     * @returns {Object} - Validation result
     */
    validatePromptArgument(arg, promptId, index) {
        const errors = [];
        const warnings = [];
        const argId = `${promptId}.arguments[${index}]`;

        // Validate name (required)
        if (!arg.name) {
            errors.push(`${argId}: Missing "name" field (required)`);
        } else if (typeof arg.name !== 'string') {
            errors.push(`${argId}: "name" must be a string`);
        }

        // Validate description (optional but recommended)
        if (!arg.description) {
            warnings.push(`${argId}: Missing "description" (recommended)`);
        }

        // Validate required (optional, boolean)
        if ('required' in arg && typeof arg.required !== 'boolean') {
            errors.push(`${argId}: "required" must be a boolean`);
        }

        return { errors, warnings };
    }

    /**
     * Validate MCP content array (used in tool results and resource contents)
     * @param {Array} contents - Content array
     * @returns {Object} - Validation result
     */
    validateContentArray(contents) {
        const errors = [];
        const warnings = [];

        if (!Array.isArray(contents)) {
            errors.push('Content must be an array');
            return { valid: false, errors, warnings };
        }

        contents.forEach((content, index) => {
            const contentValidation = this.validateContentItem(content, index);
            errors.push(...contentValidation.errors);
            warnings.push(...contentValidation.warnings);
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate a single content item
     * @param {Object} content - Content item
     * @param {number} index - Content index
     * @returns {Object} - Validation result
     */
    validateContentItem(content, index) {
        const errors = [];
        const warnings = [];
        const contentId = `content[${index}]`;

        if (!content.type) {
            errors.push(`${contentId}: Missing "type" field`);
            return { errors, warnings };
        }

        switch (content.type) {
            case 'text':
                if (!content.text && content.text !== '') {
                    errors.push(`${contentId}: Text content must have "text" field`);
                }
                break;
            case 'image':
                if (!content.data && !content.uri && !content.url) {
                    errors.push(`${contentId}: Image content must have "data", "uri", or "url" field`);
                }
                if (content.data && !content.mimeType) {
                    warnings.push(`${contentId}: Image with data should have "mimeType" field`);
                }
                break;
            case 'resource':
                if (!content.resource && !content.uri) {
                    errors.push(`${contentId}: Resource content must have "resource" or "uri" field`);
                }
                break;
            case 'ui':
            case 'embedded':
                if (!content.html && !content.data && !content.content) {
                    warnings.push(`${contentId}: UI content should have "html", "data", or "content" field`);
                }
                break;
            default:
                warnings.push(`${contentId}: Unknown content type "${content.type}"`);
        }

        return { errors, warnings };
    }

    /**
     * Validate JSON-RPC 2.0 message format
     * @param {Object} message - JSON-RPC message
     * @returns {Object} - Validation result
     */
    validateJSONRPC(message) {
        const errors = [];
        const warnings = [];

        // Validate jsonrpc version
        if (!message.jsonrpc) {
            errors.push('Missing "jsonrpc" field');
        } else if (message.jsonrpc !== '2.0') {
            errors.push(`Invalid jsonrpc version: expected "2.0", got "${message.jsonrpc}"`);
        }

        // Validate id (required for requests/responses, not for notifications)
        if ('id' in message) {
            if (typeof message.id !== 'string' && typeof message.id !== 'number' && message.id !== null) {
                errors.push('id must be a string, number, or null');
            }
        }

        // Response must have either result or error
        if ('id' in message && message.id !== null) {
            const hasResult = 'result' in message;
            const hasError = 'error' in message;

            if (!hasResult && !hasError) {
                errors.push('JSON-RPC response must have either "result" or "error" field');
            }

            if (hasResult && hasError) {
                errors.push('JSON-RPC response cannot have both "result" and "error" fields');
            }
        }

        // Validate error format
        if ('error' in message) {
            const errorValidation = this.validateError(message.error);
            errors.push(...errorValidation.errors);
        }

        return { errors, warnings };
    }

    /**
     * Validate JSON-RPC error object
     * @param {Object} error - Error object
     * @returns {Object} - Validation result
     */
    validateError(error) {
        const errors = [];

        if (typeof error !== 'object' || error === null) {
            errors.push('error must be an object');
            return { errors, warnings: [] };
        }

        if (!('code' in error)) {
            errors.push('error.code is required');
        } else if (typeof error.code !== 'number') {
            errors.push('error.code must be a number');
        }

        if (!('message' in error)) {
            errors.push('error.message is required');
        } else if (typeof error.message !== 'string') {
            errors.push('error.message must be a string');
        }

        return { errors, warnings: [] };
    }

    /**
     * Generate a detailed validation report
     * @param {Object} validation - Validation result
     * @param {string} context - Context description
     * @returns {string} - HTML formatted report
     */
    generateValidationReport(validation, context) {
        let html = `<div style="margin: 10px 0;">`;

        if (validation.valid) {
            html += `
                <div style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
                    <h4 style="margin: 0 0 10px 0; color: #155724;">✅ ${context} - Protocol Compliant</h4>
            `;
        } else {
            html += `
                <div style="background: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545;">
                    <h4 style="margin: 0 0 10px 0; color: #721c24;">❌ ${context} - Protocol Violations Found</h4>
            `;
        }

        // Show errors
        if (validation.errors && validation.errors.length > 0) {
            html += `
                <div style="margin: 10px 0;">
                    <strong style="color: #721c24;">Errors (${validation.errors.length}):</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${validation.errors.map(err => `<li style="margin: 5px 0; color: #721c24;">${this.escapeHtml(err)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Show warnings
        if (validation.warnings && validation.warnings.length > 0) {
            html += `
                <div style="margin: 10px 0;">
                    <strong style="color: #856404;">Warnings (${validation.warnings.length}):</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${validation.warnings.map(warn => `<li style="margin: 5px 0; color: #856404;">${this.escapeHtml(warn)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Show per-version mandatory checklist (only emitted for initialize validation)
        if (validation.mandatoryChecklist && validation.mandatoryChecklist.length > 0) {
            const negotiated = validation.negotiatedVersion || 'unknown';
            const icon = { pass: '✅', fail: '❌', info: '•' };
            const color = { pass: '#155724', fail: '#721c24', info: '#555' };
            html += `
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #4F46E5; font-weight: bold;">
                        Mandatory requirements for MCP ${this.escapeHtml(negotiated)} (${validation.mandatoryChecklist.length})
                    </summary>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; list-style: none;">
                        ${validation.mandatoryChecklist.map(r => `
                            <li style="margin: 4px 0; color: ${color[r.status]};">
                                ${icon[r.status]} <code style="font-size: 11px;">since ${this.escapeHtml(r.since)}</code> — ${this.escapeHtml(r.text)}
                            </li>
                        `).join('')}
                    </ul>
                </details>
            `;
        }

        html += `</div></div>`;
        return html;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Log validation result
     */
    logValidation(context, validation) {
        this.validationLog.push({
            timestamp: new Date(),
            context,
            validation
        });

        console.log(`[MCP Validator] ${context}:`, validation);
    }

    /**
     * Get validation log
     */
    getLog() {
        return this.validationLog;
    }

    /**
     * Clear validation log
     */
    clearLog() {
        this.validationLog = [];
    }
}
