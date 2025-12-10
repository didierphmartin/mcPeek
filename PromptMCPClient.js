/**
 * Prompt-Based MCP Client
 * For services like InVideo that work through prompt injection rather than traditional MCP tools
 */
class PromptMCPClient {
    constructor(serverUrl, serverName) {
        this.serverUrl = serverUrl;
        this.serverName = serverName;
        this.connected = false;
        
        // Event callbacks
        this.onConnected = null;
        this.onResponse = null;
        this.onError = null;
    }

    /**
     * Detect if a server uses prompt-based interaction
     */
    static isPromptBasedServer(url) {
        return url.includes('invideo') || url.includes('/sse');
    }

    /**
     * Connect using simple HTTP POST for prompt injection
     */
    async connect() {
        console.log(`🎬 Connecting to prompt-based MCP server: ${this.serverName}`);
        
        try {
            // Test connection with a simple ping or health check
            const testResponse = await fetch(this.serverUrl, {
                method: 'OPTIONS',
                mode: 'cors'
            });
            
            console.log(`✅ Server accessible: ${this.serverName}`);
            this.connected = true;
            
            if (this.onConnected) {
                this.onConnected();
            }
            
            return true;
            
        } catch (error) {
            console.error(`❌ Connection failed: ${error.message}`);
            if (this.onError) {
                this.onError(error);
            }
            return false;
        }
    }

    /**
     * Generate video using prompt injection
     * @param {string} prompt - Video generation prompt
     * @returns {Promise} - Video generation response
     */
    async generateVideo(prompt) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        console.log(`🎬 Generating video with prompt: "${prompt}"`);
        
        try {
            // Try different prompt injection methods
            
            // Method 1: Direct POST with prompt
            const response = await this.sendPrompt(prompt);
            if (response) return response;
            
            // Method 2: MCP-style prompt injection
            const mcpResponse = await this.sendMCPPrompt(prompt);
            if (mcpResponse) return mcpResponse;
            
            // Method 3: Query parameter injection
            const queryResponse = await this.sendQueryPrompt(prompt);
            if (queryResponse) return queryResponse;
            
            throw new Error('All prompt injection methods failed');
            
        } catch (error) {
            console.error(`❌ Video generation failed: ${error.message}`);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * Method 1: Direct POST with prompt
     */
    async sendPrompt(prompt) {
        try {
            console.log(`📤 Trying direct prompt injection...`);
            
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    action: 'generate_video',
                    duration: 10
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Direct prompt successful:`, result);
                return result;
            }
            
        } catch (error) {
            console.log(`❌ Direct prompt failed: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Method 2: MCP-style prompt injection
     */
    async sendMCPPrompt(prompt) {
        try {
            console.log(`📤 Trying MCP-style prompt injection...`);
            
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "generate",
                    params: {
                        prompt: prompt,
                        type: "video",
                        duration: 10
                    }
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ MCP prompt successful:`, result);
                return result;
            }
            
        } catch (error) {
            console.log(`❌ MCP prompt failed: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Method 3: Query parameter injection
     */
    async sendQueryPrompt(prompt) {
        try {
            console.log(`📤 Trying query parameter injection...`);
            
            const url = new URL(this.serverUrl);
            url.searchParams.set('prompt', prompt);
            url.searchParams.set('action', 'generate');
            url.searchParams.set('format', 'json');
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Query prompt successful:`, result);
                return result;
            }
            
        } catch (error) {
            console.log(`❌ Query prompt failed: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Create a simple video generation interface
     */
    createVideoInterface() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div style="border: 2px solid #007bff; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3>🎬 Video Generation (Prompt-Based)</h3>
                <p>Enter a video description and let ${this.serverName} create it:</p>
                
                <textarea id="video-prompt" 
                         placeholder="Example: Create a 10-second video about a cat playing with a ball"
                         style="width: 100%; height: 100px; margin: 10px 0; padding: 10px; border-radius: 5px;"></textarea>
                
                <div style="margin: 10px 0;">
                    <label>Duration: </label>
                    <select id="video-duration" style="padding: 5px;">
                        <option value="5">5 seconds</option>
                        <option value="10" selected>10 seconds</option>
                        <option value="15">15 seconds</option>
                        <option value="30">30 seconds</option>
                    </select>
                </div>
                
                <button onclick="generateVideoFromUI()" 
                        style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    🎬 Generate Video
                </button>
                
                <div id="video-result" style="margin-top: 20px;"></div>
            </div>
        `;
        
        return container;
    }

    /**
     * Disconnect
     */
    disconnect() {
        console.log(`👋 Disconnecting from ${this.serverName}`);
        this.connected = false;
    }
}

// Global function for UI
window.generateVideoFromUI = async function() {
    const promptEl = document.getElementById('video-prompt');
    const durationEl = document.getElementById('video-duration');
    const resultEl = document.getElementById('video-result');
    
    if (!promptEl || !promptEl.value.trim()) {
        alert('Please enter a video prompt');
        return;
    }
    
    const prompt = promptEl.value.trim();
    const duration = durationEl.value;
    
    resultEl.innerHTML = `<p>🎬 Generating video: "${prompt}" (${duration}s)...</p>`;
    
    try {
        // This would use the prompt client if connected
        console.log(`🎬 Would generate video: "${prompt}" for ${duration} seconds`);
        
        // Simulate the expected flow
        resultEl.innerHTML = `
            <div style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
                <h4>✅ Video Generation Request</h4>
                <p><strong>Prompt:</strong> "${prompt}"</p>
                <p><strong>Duration:</strong> ${duration} seconds</p>
                <p><strong>Status:</strong> Would be sent to ${window.currentPromptClient?.serverName || 'InVideo MCP Server'}</p>
                <p><em>Note: Requires mcp-remote Node.js wrapper for actual generation</em></p>
            </div>
        `;
        
    } catch (error) {
        resultEl.innerHTML = `
            <div style="background: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545;">
                <h4>❌ Generation Failed</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
};