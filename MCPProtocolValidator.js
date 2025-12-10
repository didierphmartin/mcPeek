/**
 * MCP Protocol Validator
 * Validates MCP JSON-RPC 2.0 messages for protocol compliance
 *
 * Created by Claude Code (Anthropic)
 * Protocol Specification: MCP 2024-11-05
 */

class MCPProtocolValidator {
    constructor() {
        this.protocolVersion = '2024-11-05';
        this.validationLog = [];
    }

    /**
     * Validate initialize response
     * @param {Object} response - JSON-RPC response
     * @returns {Object} - Validation result {valid: boolean, errors: array, warnings: array}
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

        // Validate protocolVersion
        if (!result.protocolVersion) {
            errors.push('Missing "protocolVersion" in initialize result');
        } else if (result.protocolVersion !== this.protocolVersion) {
            warnings.push(`Protocol version mismatch: expected "${this.protocolVersion}", got "${result.protocolVersion}"`);
        }

        // Validate capabilities
        if (!result.capabilities) {
            errors.push('Missing "capabilities" in initialize result');
        } else {
            const capValidation = this.validateCapabilities(result.capabilities);
            errors.push(...capValidation.errors);
            warnings.push(...capValidation.warnings);
        }

        // Validate serverInfo
        if (!result.serverInfo) {
            warnings.push('Missing "serverInfo" in initialize result (recommended but not required)');
        } else {
            if (!result.serverInfo.name) {
                warnings.push('Missing "serverInfo.name" (recommended)');
            }
            if (!result.serverInfo.version) {
                warnings.push('Missing "serverInfo.version" (recommended)');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
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
