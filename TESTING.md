# MCPeek Testing Checklist 🔍

**Testing Stage - Before Open Source Release**

## ✅ Migration Complete

MCPeek has been successfully moved to its dedicated testing location:

**Location:** `http://localhost/mcPeek/`

**Files Deployed:**
- ✅ index.html (55KB)
- ✅ MCPProtocolValidator.js (14KB)
- ✅ SSEMCPClient.js (13KB)
- ✅ PromptMCPClient.js (9.2KB)
- ✅ README.md (5.6KB)
- ✅ IMPROVEMENTS.md (10KB)
- ✅ BRANDING.md (7KB)
- ✅ LICENSE (MIT - 1.1KB)
- ✅ .htaccess (CORS enabled)

---

## 🧪 Testing Checklist

### Phase 1: Basic Functionality
- [ ] **Open MCPeek**: Visit `http://localhost/mcPeek/`
- [ ] **Page loads correctly**: Title shows "MCPeek - Peek into MCP Protocol Compliance"
- [ ] **UI renders**: Header shows "🔍 MCPeek" with tagline
- [ ] **No console errors**: Open browser DevTools, check for errors

### Phase 2: Test with Memo Server
- [ ] **Add memo server**:
  - Name: `Memo Server`
  - URL: `http://localhost/memo/mcp.php`
  - Description: `Episodic memory server`

- [ ] **Connect to memo server**:
  - Click "Connect" button
  - Check Activity Log for:
    - ✅ Step 1: Initializing connection
    - ✅ Step 2: Sending notifications/initialized
    - ✅ Step 3: Requesting tools

- [ ] **Protocol validation**:
  - Check "🔍 Protocol Validation" section appears
  - Should show: "✅ Initialize Response - Protocol Compliant"
  - Should show: "✅ Tools List Response - Protocol Compliant"

- [ ] **Tools display**:
  - Should show 6 tools:
    1. saveLearning
    2. getLearningsByTheme
    3. retrieveRelevantLearnings
    4. getAllLearnings
    5. generateEmbeddings
    6. getEmbeddingStats

### Phase 3: Test Tool Execution
- [ ] **Test saveLearning**:
  - Enter theme: `test`
  - Enter content: `This is a test learning`
  - Click "Call Tool"
  - Check for success response

- [ ] **Test getAllLearnings**:
  - Leave limit at default (10)
  - Click "Call Tool"
  - Check response shows data

- [ ] **Check Request/Response viewer**:
  - Expand "🔧 Technical Details"
  - Verify split-panel view works
  - Test draggable divider
  - Check JSON is properly formatted

### Phase 4: Test Custom Server
- [ ] **Add a non-compliant test server** (simulate old memo):
  - Create a test endpoint that returns array instead of object
  - MCPeek should catch the error:
    - "❌ CRITICAL: capabilities.tools must be an object {}, not an array []"

- [ ] **Verify error messages are helpful**:
  - Should show "Fix: Change 'tools': [] to 'tools': (object)[]"

### Phase 5: Cross-Browser Testing
- [ ] **Chrome**: Full functionality works
- [ ] **Firefox**: Full functionality works
- [ ] **Safari**: Full functionality works
- [ ] **Edge**: Full functionality works

### Phase 6: CORS & Headers
- [ ] **Check network tab**:
  - Requests include `mcp-protocol-version: 2024-11-05` header
  - CORS headers present in responses
  - No CORS errors in console

### Phase 7: Documentation
- [ ] **README.md**: Read through, verify accuracy
- [ ] **IMPROVEMENTS.md**: Review technical details
- [ ] **BRANDING.md**: Check brand guidelines
- [ ] **Code comments**: Verify inline documentation is clear

---

## 🐛 Known Issues to Watch For

### Issue #1: CORS Errors
**Symptom:** "Access to fetch at '...' has been blocked by CORS policy"
**Fix:** Verify .htaccess is present and mod_headers is enabled

### Issue #2: 404 on JavaScript Files
**Symptom:** "Failed to load resource: 404 Not Found" for .js files
**Fix:** Check file paths are correct, verify .htaccess allows static files

### Issue #3: Empty Validation Panel
**Symptom:** Protocol validation section doesn't appear
**Fix:** Check browser console for errors in MCPProtocolValidator.js

### Issue #4: Protocol Violations Not Detected
**Symptom:** Server returns arrays but no error shown
**Fix:** Verify MCPProtocolValidator is loaded before main script

---

## 📊 Success Criteria

MCPeek is ready for open source release when:

- ✅ All Phase 1-7 tests pass
- ✅ No console errors
- ✅ Works in all major browsers
- ✅ Documentation is accurate
- ✅ Protocol validation catches known issues
- ✅ User experience is smooth and intuitive

---

## 🚀 Pre-Release Checklist

Before making MCPeek open source:

- [ ] All tests passed
- [ ] Screenshots taken for README
- [ ] Demo GIF/video created (optional)
- [ ] Social media announcement drafted
- [ ] GitHub repository created
- [ ] First commit ready
- [ ] License confirmed (MIT)
- [ ] Attribution clear (Created by Claude Code)

---

## 📝 Test Log

### Test Session 1: [Date]
**Tester:** [Name]
**Browser:** [Browser & Version]
**Results:**
- [ ] Phase 1: Pass / Fail
- [ ] Phase 2: Pass / Fail
- [ ] Phase 3: Pass / Fail
- [ ] Phase 4: Pass / Fail
- [ ] Phase 5: Pass / Fail
- [ ] Phase 6: Pass / Fail
- [ ] Phase 7: Pass / Fail

**Notes:**
[Add any observations, bugs found, suggestions]

---

### Test Session 2: [Date]
**Tester:** [Name]
**Browser:** [Browser & Version]
**Results:**
[Same format as above]

---

## 🎯 Quick Start for Testing

1. **Open MCPeek:**
   ```
   http://localhost/mcPeek/
   ```

2. **Add Memo Server:**
   - Click "➕ Add Custom Server"
   - Name: `Memo Server`
   - URL: `http://localhost/memo/mcp.php`
   - Click "Add Server"

3. **Connect:**
   - Select "Memo Server" from dropdown
   - Click "Connect"
   - Watch the magic happen! 🔍✨

4. **Test a Tool:**
   - Scroll to "🛠️ Available Tools"
   - Try "getAllLearnings"
   - Click "Call Tool"
   - Expand "Technical Details" to see request/response

---

## 💡 Tips for Testing

1. **Keep DevTools open**: Watch for console errors
2. **Check Network tab**: Verify requests are being sent
3. **Test edge cases**: Empty inputs, invalid URLs, etc.
4. **Compare with MCP Inspector**: How does MCPeek compare?
5. **Think like a new user**: Is everything intuitive?

---

## 📞 Support During Testing

If you encounter issues:
1. Check browser console for errors
2. Verify XAMPP is running
3. Test memo server directly: `curl http://localhost/memo/mcp.php`
4. Check .htaccess is properly loaded
5. Review Activity Log in MCPeek for clues

---

**Status:** 🧪 Testing Stage
**Version:** 1.0.0
**Created:** January 1, 2025
**By:** Claude Code (Anthropic)

---

**When all tests pass, MCPeek is ready to change the world! 🚀**
