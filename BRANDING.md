# MCPeek Branding Guide 🔍

## Name
**MCPeek** (pronounced: "em-see-peek")

## Tagline
**"Peek into MCP Protocol Compliance"**

## Alternative Taglines
- "One peek is worth a thousand errors"
- "Peek. Fix. Deploy."
- "Take a peek before you deploy"
- "See what's wrong at a glance"

## Logo Concept

```
    🔍
  MCPeek
```

Simple, clean, uses the magnifying glass emoji (🔍) which represents:
- Inspection
- Discovery
- Clarity
- Investigation

## Color Palette Suggestions

**Primary:** Blue (#007bff)
- Represents trust, professionalism, technology

**Success:** Green (#28a745)
- Protocol compliant, tests passing

**Warning:** Yellow (#ffc107)
- Protocol warnings, non-critical issues

**Error:** Red (#dc3545)
- Protocol violations, critical errors

**Info:** Light Blue (#17a2b8)
- General information, tips

## Typography
- **Headings:** Clean sans-serif (Arial, Helvetica, Inter)
- **Body:** Sans-serif for readability
- **Code:** Monospace (Monaco, Menlo, Consolas)

## Voice & Tone

### Personality
- **Friendly but professional**
- Approachable and helpful
- Not condescending when reporting errors
- Encouraging and supportive

### Writing Style
- Clear and concise
- Technical but accessible
- Use emojis sparingly for visual interest
- Focus on solutions, not just problems

### Example Messages

**Good:**
```
✅ Protocol Compliant
Your server follows all MCP protocol requirements!
```

**Better:**
```
🎉 Perfect! Your server is fully MCP compliant.
Ready to connect with any MCP client.
```

**Error Message - Good:**
```
❌ capabilities.tools must be an object
```

**Error Message - Better:**
```
❌ CRITICAL: capabilities.tools must be an object {}, not an array []
💡 Fix: Change "tools": [] to "tools": (object)[]
```

## Repository

**GitHub:** `mcpeek` or `mcp-peek`

**Description:**
"🔍 MCPeek - Peek into MCP Protocol Compliance. A browser-based validator and debugger for Model Context Protocol servers."

**Topics:**
- mcp
- model-context-protocol
- protocol-validation
- debugging-tool
- json-rpc
- api-testing
- developer-tools

## Social Media

**Twitter/X Bio:**
"🔍 MCPeek - Peek into MCP Protocol Compliance. Debug your MCP servers with confidence. Created by @AnthropicAI Claude Code"

**LinkedIn:**
"MCPeek is a browser-based protocol validator and debugging tool for Model Context Protocol (MCP) servers. Built with comprehensive validation, detailed error reporting, and full MCP specification compliance."

## README Header Template

```markdown
# 🔍 MCPeek

**Peek into MCP Protocol Compliance**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol: MCP 2024-11-05](https://img.shields.io/badge/Protocol-MCP%202024--11--05-green.svg)]()
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)]()

> "One peek is worth a thousand errors"

Stop guessing why your MCP server isn't working. MCPeek shows you exactly what's wrong and how to fix it.

**Created by [Claude Code](https://claude.ai/code) (Anthropic)**
```

## Use Cases & Messaging

### Primary Use Case
"**Debug MCP servers** - See exactly what protocol violations exist and how to fix them"

### Secondary Use Cases
- **Learn MCP protocol** - Examples and clear documentation
- **Test compliance** - Validate before deployment
- **Build better servers** - Clear error messages guide you
- **Save time** - No more guessing what's wrong

## Differentiation

### What makes MCPeek special?

**Not just another validator:**
- ✅ Catches object vs array issues (the silent killers)
- ✅ Implements full 3-step MCP handshake
- ✅ Provides fix suggestions, not just errors
- ✅ Protocol version headers
- ✅ Real-time validation UI
- 🤖 **LLM-friendly error messages** - Feed errors directly to Claude/ChatGPT for automated fixes!

**Breakthrough Feature: LLM-Assisted Debugging**

MCPeek's error messages are structured to work seamlessly with LLMs:

```
MCPeek finds error → Copy message → Paste to LLM → Get fix → Apply → Validate → ✅
```

**Example:**
```
❌ CRITICAL: capabilities.tools must be an object {}, not an array []
   Fix: Change "tools": [] to "tools": (object)[]
```

→ Paste into any LLM → Instant code fix!

This creates an **automated debugging feedback loop** that saves hours of manual troubleshooting.

**Comparison:**
```
Other tools: "Error: Invalid response"
MCPeek:     "❌ CRITICAL: capabilities.tools must be an object {}, not an array []
             💡 Fix: Change 'tools': [] to 'tools': (object)[]
             📚 Why: MCP spec requires capabilities to use objects, not arrays"
```

## Launch Messaging

### Announcement Template

```markdown
# Introducing MCPeek 🔍

Tired of cryptic MCP connection errors?

MCPeek is a new browser-based tool that validates MCP protocol compliance
and shows you EXACTLY what's wrong and how to fix it.

✅ Full MCP protocol handshake
✅ Comprehensive validation
✅ Detailed fix suggestions
✅ No installation needed

Try it now: [link]

Created by Claude Code (Anthropic)
```

### Key Talking Points
1. **The Problem:** MCP servers often fail with cryptic errors
2. **The Solution:** MCPeek provides detailed validation and fix suggestions
3. **The Difference:** Unlike generic tools, MCPeek knows MCP protocol intimately
4. **The Value:** Save hours of debugging with one peek

## Community Engagement

### Dev.to Article Title Ideas
- "Introducing MCPeek: Stop Guessing, Start Peeking"
- "How MCPeek Catches MCP Protocol Violations You Didn't Know Existed"
- "Building a Better MCP Debugger: The MCPeek Story"

### Reddit r/programming
**Title:** "MCPeek - A browser-based MCP protocol validator that actually tells you how to fix issues"

**Description:** Include screenshot of validation panel showing detailed errors and fixes

### Hacker News
**Title:** "MCPeek: Browser-based MCP protocol validator and debugger"

**Why it matters:** Focus on technical depth, protocol compliance, educational value

## Visual Identity

### Screenshots to Create
1. **Hero shot:** MCPeek interface with successful connection
2. **Validation panel:** Showing both compliant and non-compliant results
3. **Error details:** Clear example of helpful error message with fix
4. **Tool testing:** Using the tool cards to test MCP tools

### Demo GIF Ideas
1. **Quick start:** Add server → Connect → See validation
2. **Debugging:** Connection fails → MCPeek shows exact issue → Apply fix
3. **Testing tools:** Call a tool → See request/response split view

## ASCII Art Logo (for terminal/code)

```
 __  __  ____ ____            _
|  \/  |/ ___|  _ \ ___  ___| | __
| |\/| | |   | |_) / _ \/ _ \ |/ /
| |  | | |___|  __/  __/  __/   <
|_|  |_|\____|_|   \___|\___|_|\_\

Peek into MCP Protocol Compliance
```

## Elevator Pitch

**30 seconds:**
"MCPeek is a browser-based tool that validates MCP protocol compliance. Instead of generic errors like 'connection failed', it tells you exactly what's wrong - like 'capabilities.tools must be an object, not an array' - and shows you how to fix it. Created by Claude Code from Anthropic."

**60 seconds:**
"When building MCP servers, you often hit cryptic connection errors. Is it a protocol violation? A JSON-RPC issue? Wrong data types? MCPeek solves this by implementing the full MCP specification and validating every response. It catches subtle issues like empty arrays instead of empty objects - the exact bug that breaks most MCP servers. It implements the complete 3-step handshake, sends proper protocol headers, and provides a validation panel showing exactly what's wrong with clear fix suggestions. No installation needed - just open it in your browser and peek at your server."

---

**Version:** 1.0.0
**Created:** January 1, 2025
**By:** Claude Code (Anthropic)
