/**
 * SSE MCP Client - JavaScript class for Server-Sent Events MCP protocol
 * Handles MCP servers that use SSE transport
 * 
 * Convention: Most legacy MCP servers using SSE have '/sse' in their URL
 */
class SSEMCPClient {
    constructor(serverUrl, serverName) {
        this.serverUrl = serverUrl;
        this.serverName = serverName;
        this.eventSource = null;
        this.connected = false;
        this.tools = [];
        this.messageId = 1;
        this.pendingRequests = new Map(); // Track request/response pairs
        
        // Event callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onToolsReceived = null;
        this.onError = null;
        this.onMessage = null;
    }

    /**
     * Detect if a server URL uses SSE transport
     * @param {string} url - Server URL to check
     * @returns {boolean} - True if URL suggests SSE transport
     */
    static isSSEServer(url) {
        return url.includes('/sse') || url.includes('sse');
    }


    /**
     * Connect to SSE MCP server using proper SSE protocol
     */
    async connect() {
        if (this.connected) {
            console.warn('Already connected to SSE MCP server');
            return;
        }

        console.log(`🔌 Connecting to MCP server: ${this.serverName}`);
        
        try {
            // Step 1: Initialize with proper MCP message endpoint
            await this.initializeSession();
            
            // Step 2: Establish SSE connection
            this.connectSSE();
            
        } catch (error) {
            console.error(`Failed to connect to MCP server: ${error.message}`);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * Initialize MCP session using proper SSE protocol
     */
    async initializeSession() {
        console.log(`🚀 Initializing MCP session...`);
        
        // SSE MCP servers commonly use /mcp endpoint for client requests  
        const messageEndpoint = this.serverUrl.replace('/sse', '/mcp');
        
        const response = await fetch(messageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: { tools: {} },
                    clientInfo: {
                        name: "Browser-MCP-Client",
                        version: "1.0.0"
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Initialize failed: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();
        console.log(`✅ Initialize response:`, responseText);

        // Generate a session ID since server doesn't expose it via CORS
        this.sessionId = 'browser-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        console.log(`🔑 Generated session ID: ${this.sessionId}`);

        // Extract server info from SSE response
        if (responseText.includes('event: message')) {
            const dataLine = responseText.split('\n').find(line => line.startsWith('data: '));
            if (dataLine) {
                const data = JSON.parse(dataLine.substring(6));
                console.log(`📋 Server info:`, data.result);
                this.serverInfo = data.result;
            }
        }
    }

    /**
     * Connect to SSE endpoint
     */
    connectSSE() {
        console.log(`🔗 Connecting to SSE endpoint: ${this.serverUrl}`);
        
        try {
            this.eventSource = new EventSource(this.serverUrl);
            
            this.eventSource.onopen = (event) => {
                console.log(`✅ SSE connection opened to ${this.serverName}`);
                console.log(`🔄 Waiting for server to send initialization messages...`);
                this.connected = true;
                
                // Note: Browser CORS restrictions prevent calling listTools
                // InVideo MCP is designed for Node.js mcp-remote wrapper, not direct browser access
                console.log(`⚠️ InVideo MCP server requires Node.js mcp-remote for full functionality`);
                console.log(`📱 Browser-based clients have CORS limitations with /mcp endpoint`);
                
                if (this.onConnected) {
                    this.onConnected(event);
                }
            };

            this.eventSource.onmessage = (event) => {
                console.log(`🟢 RAW SSE MESSAGE RECEIVED FROM INVIDEO:`);
                console.log(`📨 Event type:`, event.type);
                console.log(`📨 Event data:`, event.data);
                console.log(`📨 Event lastEventId:`, event.lastEventId);
                console.log(`📨 Event origin:`, event.origin);
                console.log(`📨 Full event object:`, event);
                
                try {
                    const mcpMessage = JSON.parse(event.data);
                    console.log(`✅ Parsed JSON message:`, mcpMessage);
                    this.handleMCPMessage(mcpMessage);
                } catch (error) {
                    console.log(`📝 Not JSON - Raw text response:`, event.data);
                    console.error('Parse error:', error);
                }
            };

            this.eventSource.onerror = (event) => {
                console.error(`❌ SSE connection error to ${this.serverName}:`, event);
                this.connected = false;
                
                if (this.onError) {
                    this.onError(event);
                }
            };

        } catch (error) {
            console.error(`Failed to connect to SSE MCP server: ${error.message}`);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * Send MCP initialize message using proper SSE protocol
     */
    async initialize() {
        const initMessage = {
            jsonrpc: "2.0",
            id: this.getNextId(),
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: "SSE-MCP-Client",
                    version: "1.0.0"
                }
            }
        };

        await this.sendMessage(initMessage);
    }

    /**
     * Handle incoming MCP messages
     * @param {Object} message - MCP JSON-RPC message
     */
    handleMCPMessage(message) {
        console.log(`📨 Received MCP message:`, message);

        if (this.onMessage) {
            this.onMessage(message);
        }

        // Handle initialize response
        if (message.id && message.result && message.result.capabilities) {
            console.log(`🎯 MCP server initialized: ${this.serverName}`);
            console.log('Server capabilities:', message.result.capabilities);
            
            // Request available tools
            this.listTools();
        }

        // Handle tools list response
        if (message.id && message.result && Array.isArray(message.result.tools)) {
            this.tools = message.result.tools;
            console.log(`🛠️ Received ${this.tools.length} tools from ${this.serverName}:`);
            this.tools.forEach(tool => {
                console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
            });
            
            if (this.onToolsReceived) {
                this.onToolsReceived(this.tools);
            }
        }

        // Handle tool execution response
        if (message.id && this.pendingRequests.has(message.id)) {
            const request = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            
            if (request.callback) {
                request.callback(message.result || message.error, message.error ? true : false);
            }
        }
    }

    /**
     * Send JSON-RPC message using proper MCP SSE protocol
     * @param {Object} message - JSON-RPC message to send
     */
    async sendMessage(message) {
        const messageEndpoint = this.serverUrl.replace('/sse', '/mcp');
        
        try {
            console.log(`📤 Sending message to ${messageEndpoint}:`, message);
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            };

            // Note: Can't send Mcp-Session-Id header due to browser CORS restrictions
            // The server may not require it for browser-based clients

            const response = await fetch(messageEndpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Check content type to handle both JSON and streaming responses
            const contentType = response.headers.get('content-type');
            console.log(`📋 Response content-type: ${contentType}`);
            
            if (contentType && contentType.includes('application/json')) {
                // Direct JSON response
                const jsonResponse = await response.json();
                console.log(`📦 Direct JSON response:`, jsonResponse);
                this.handleMCPMessage(jsonResponse);
            } else {
                // Response will come via SSE stream
                console.log(`✅ Message sent successfully, awaiting response via SSE...`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to send message:`, error);
            throw error;
        }
    }

    /**
     * Request list of available tools
     */
    async listTools() {
        if (!this.sessionId) {
            console.error('No session ID - must initialize first');
            return;
        }

        console.log(`🛠️ Requesting tools list from MCP server...`);
        
        const messageEndpoint = this.serverUrl.replace('/sse', '/mcp');
        
        try {
            const response = await fetch(messageEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream'
                    // Note: Can't send Mcp-Session-Id due to browser CORS restrictions
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: this.getNextId(),
                    method: "tools/list",
                    params: {}
                })
            });

            const responseText = await response.text();
            console.log(`🛠️ Tools response:`, responseText);

            // Parse tools from response
            if (responseText.includes('event: message')) {
                const dataLine = responseText.split('\n').find(line => line.startsWith('data: '));
                if (dataLine) {
                    const data = JSON.parse(dataLine.substring(6));
                    if (data.result && data.result.tools) {
                        this.tools = data.result.tools;
                        console.log(`✅ Received ${this.tools.length} tools from MCP server:`, this.tools);
                        
                        if (this.onToolsReceived) {
                            this.onToolsReceived(this.tools);
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`❌ Failed to get tools:`, error);
        }
    }

    /**
     * Execute a tool
     * @param {string} toolName - Name of the tool to execute
     * @param {Object} args - Tool arguments
     * @param {Function} callback - Callback for result
     */
    callTool(toolName, args = {}, callback = null) {
        const callMessage = {
            jsonrpc: "2.0",
            id: this.getNextId(),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        };

        if (callback) {
            this.pendingRequests.set(callMessage.id, { callback });
        }

        this.sendMessage(callMessage);
    }


    /**
     * Disconnect from SSE server
     */
    disconnect() {
        if (this.eventSource) {
            console.log(`🔌 Disconnecting from SSE MCP server: ${this.serverName}`);
            this.eventSource.close();
            this.eventSource = null;
        }
        
        this.connected = false;
        this.tools = [];
        this.pendingRequests.clear();
        
        if (this.onDisconnected) {
            this.onDisconnected();
        }
    }

    /**
     * Get next message ID
     * @returns {number} - Next message ID
     */
    getNextId() {
        return this.messageId++;
    }

    /**
     * Check if connected
     * @returns {boolean} - Connection status
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Get available tools
     * @returns {Array} - List of available tools
     */
    getTools() {
        return this.tools;
    }
}