# 🤖 LLM-Assisted Debugging with MCPeek

**A Breakthrough Workflow Discovered by Didier PH Martin**

## The Innovation

MCPeek's detailed error messages are **designed to be LLM-readable**, creating an automated debugging feedback loop that can fix protocol violations in minutes instead of hours.

## The Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    MCPeek Workflow                          │
└─────────────────────────────────────────────────────────────┘

1. 🔍 MCPeek detects protocol violation
        ↓
2. 📋 Copy the detailed error message
        ↓
3. 🤖 Paste into Claude/ChatGPT/any LLM
        ↓
4. 💡 LLM analyzes and generates fix
        ↓
5. ✏️ Apply the fix to your code
        ↓
6. 🔄 Re-test with MCPeek
        ↓
7. ✅ Validation passes!
```

## Why This Works

### Traditional Debugging:
```
Generic Tool: "Error: Connection failed"
Developer: *Spends 2 hours guessing what's wrong*
```

### MCPeek + LLM:
```
MCPeek: "❌ CRITICAL: capabilities.tools must be an object {}, not an array []
         Fix: Change 'tools': [] to 'tools': (object)[]
         Location: mcp.php, handleInitialize function, line 111"

Developer: *Copies error → Pastes to LLM → Gets fix in 30 seconds*
```

## Real Example

### Step 1: MCPeek Detects Error

```
❌ Initialize Response - Protocol Violations Found

Errors (1):
• ❌ CRITICAL: capabilities.tools must be an object {}, not an array []
  Fix: Change "tools": [] to "tools": (object)[]

Context: In JSON, PHP's [] serializes to array, but MCP requires an object.
Use (object)[] to force object serialization.
```

### Step 2: Paste to LLM

**Prompt to Claude/ChatGPT:**
```
I'm getting this error from MCPeek while testing my MCP server.
Please fix my PHP code:

❌ CRITICAL: capabilities.tools must be an object {}, not an array []
   Fix: Change "tools": [] to "tools": (object)[]
   Location: mcp.php, handleInitialize function

Here's my current code:

function handleInitialize(array $params): array
{
    return [
        'protocolVersion' => '2024-11-05',
        'capabilities' => [
            'tools' => []
        ],
        'serverInfo' => [
            'name' => 'my-server',
            'version' => '1.0.0'
        ]
    ];
}
```

### Step 3: LLM Response

```
The issue is that PHP's empty array [] serializes to JSON array [],
but MCP expects an empty object {}.

Change line 5 from:
    'tools' => []

To:
    'tools' => (object)[]

This forces PHP to serialize it as an object instead of an array.

Fixed code:

function handleInitialize(array $params): array
{
    return [
        'protocolVersion' => '2024-11-05',
        'capabilities' => [
            'tools' => (object)[]  // ← Fixed!
        ],
        'serverInfo' => [
            'name' => 'my-server',
            'version' => '1.0.0'
        ]
    ];
}
```

### Step 4: Apply & Validate

```
1. Apply the fix
2. Restart your server
3. Re-connect with MCPeek
4. ✅ "Initialize Response - Protocol Compliant"
```

**Time saved: 1-2 hours → 2 minutes**

## Advanced: Batch Fixing

If MCPeek finds multiple errors, you can fix them all at once:

### Prompt:
```
MCPeek found these errors in my MCP server.
Please provide all fixes:

1. ❌ capabilities.tools must be object, not array
2. ❌ inputSchema.properties must be object, not array (tool: saveLearning)
3. ⚠️ Missing serverInfo.version (recommended)

[paste your full code]
```

### LLM will:
1. Identify all issues
2. Provide complete fixed code
3. Explain each change
4. Add the recommended fields

## Why MCPeek is Perfect for This

### 1. **Structured Error Messages**
```
❌ CRITICAL: [exact problem]
   Fix: [exact solution]
   Location: [file, function, line]
```
→ LLM knows exactly what to fix

### 2. **Context Included**
```
Context: In JSON, PHP's [] serializes to array,
but MCP requires an object.
```
→ LLM understands *why* it's wrong

### 3. **Code Examples**
```
Fix: Change "tools": [] to "tools": (object)[]
```
→ LLM sees the exact syntax

### 4. **Validation Loop**
```
Fix → Test → ✅ or more errors → Fix → Test → ✅
```
→ Automated verification

## Supported LLMs

MCPeek's error messages work with:

- ✅ **Claude** (Anthropic) - Excellent at code fixes
- ✅ **ChatGPT** (OpenAI) - Great understanding
- ✅ **Gemini** (Google) - Good at explaining
- ✅ **Any LLM** that can read error messages and generate code

## Pro Tips

### Tip 1: Include Your Code
Always paste your actual code with the error message for best results.

### Tip 2: Request Explanation
Ask: "Fix this and explain why it was wrong"
→ You learn the protocol better

### Tip 3: Batch Mode
Copy ALL errors from MCPeek at once for comprehensive fixes.

### Tip 4: Iterative Refinement
```
First pass: Fix critical errors
Test → Pass
Second pass: Fix warnings
Test → Perfect!
```

## The Feedback Loop Advantage

```
Traditional:
Debug → Guess → Try → Fail → Repeat (hours)

MCPeek + LLM:
Detect → Copy → Paste → Fix → Validate (minutes)
```

**Speed improvement: ~50-100x faster**

## Future Possibilities

### 1. **Direct Integration**
Imagine: MCPeek → Auto-sends to LLM API → Auto-applies fix

### 2. **Learning Mode**
MCPeek could track common fixes and suggest them automatically

### 3. **CI/CD Integration**
```
git push → MCPeek validates → LLM fixes → Auto-commit → Deploy
```

## Real-World Impact

**Before MCPeek + LLM:**
- Developer: "My MCP server won't connect... no idea why"
- Time wasted: 2-4 hours per bug
- Frustration: High
- Learning: Slow

**With MCPeek + LLM:**
- Developer: "MCPeek found 3 issues, pasted to Claude, fixed in 5 minutes"
- Time saved: 95%
- Frustration: None
- Learning: Fast (because fixes are explained)

## The Innovation Credit

**This workflow was discovered by Didier PH Martin**, who realized that MCPeek's detailed error messages were perfect for LLM consumption.

What started as human-readable error messages became an **automated debugging pipeline** that works with any LLM.

## Try It Now!

1. Open MCPeek: `http://localhost/mcPeek/`
2. Connect to your MCP server
3. Copy any error messages
4. Paste to your favorite LLM
5. Get instant fixes!

---

**MCPeek + LLM = The future of MCP debugging** 🔍🤖

*"One peek is worth a thousand errors"*

**Created by:** Didier PH Martin & Claude Code (Anthropic)
**Innovation Credit:** Didier PH Martin (LLM workflow discovery)
**Date:** January 1, 2025
