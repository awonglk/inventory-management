# Runtime Error Debugger

**Trigger**: Use this skill when investigating runtime errors, debugging crashes, analyzing stack traces, or troubleshooting application failures.

**Examples**: "debug this error", "why is this crashing", "analyze this stack trace", "fix this runtime error", "investigate this failure"

---

## Debugging Framework

When investigating a runtime error, follow this systematic approach:

### 1. Gather Error Information

**First, collect all available error data:**

**If user provides error message:**
- Copy the exact error text
- Note the timestamp if available
- Identify error type (TypeError, ReferenceError, Network Error, etc.)

**If error is in logs:**
```bash
# Check recent logs
tail -n 100 /path/to/error.log

# Search for specific error patterns
grep -i "error\|exception\|fatal\|crash" /path/to/app.log | tail -n 50

# For systemd services
journalctl -u service-name -n 100 --no-pager
```

**If error is in browser console:**
- Full stack trace
- Console errors/warnings leading up to failure
- Network tab failures
- Any Redux/Vuex state errors

**If error is in backend:**
```bash
# Python/FastAPI logs
tail -f logs/app.log

# Check for uncaught exceptions
grep -r "Traceback" logs/

# Node.js errors
npm run dev 2>&1 | grep -i "error"
```

---

### 2. Analyze Stack Trace

**Stack traces tell you the path code took to reach the error:**

**Python stack trace analysis:**
```
Traceback (most recent call last):
  File "/app/main.py", line 45, in get_orders
    result = process_order(order_id)
  File "/app/services.py", line 120, in process_order
    item = inventory[sku]
KeyError: 'SKU-123'
```

**What to extract:**
1. **Error type**: `KeyError` - trying to access non-existent dict key
2. **Immediate cause**: Line 120 in services.py, `inventory[sku]`
3. **Call chain**: main.py → services.py
4. **Context**: SKU 'SKU-123' doesn't exist in inventory dict

**JavaScript/Vue stack trace analysis:**
```
TypeError: Cannot read property 'filter' of undefined
    at Proxy.topProducts (Dashboard.vue:490)
    at renderComponentRoot (runtime-core.esm-bundler.js:896)
    at ReactiveEffect.componentUpdateFn (runtime-core.esm-bundler.js:5649)
```

**What to extract:**
1. **Error type**: `TypeError` - accessing property of undefined
2. **Location**: Dashboard.vue line 490
3. **Context**: `topProducts` computed property, trying to call `.filter()` on undefined
4. **Likely cause**: Data hasn't loaded yet, or API returned unexpected structure

---

### 3. Locate Error in Code

**Use the stack trace to find the exact line:**

```bash
# Read the file at the error line with context
Read client/src/views/Dashboard.vue --offset 485 --limit 20

# Or grep for the function mentioned
grep -n "topProducts" client/src/views/Dashboard.vue

# Search for where the problematic variable is defined
grep -rn "inventoryItems" client/src/
```

**Look for:**
- Variable declarations
- Function definitions
- API calls that populate the data
- Conditional logic that might skip initialization

---

### 4. Identify Root Cause Categories

**Common error patterns:**

#### **A. Undefined/Null Reference Errors**

**Symptoms:**
- `Cannot read property 'X' of undefined`
- `TypeError: X is undefined`
- `null is not an object`

**Common causes:**
```javascript
// ❌ Accessing nested property without safety
const value = user.profile.name

// ❌ Array/object not initialized
const items = data.items.filter(...)

// ❌ Async data not loaded yet
const computed = computed(() => {
  return apiData.value.filter(...) // apiData is still null
})
```

**Investigation steps:**
1. Check if variable is initialized: `grep -n "const itemName" file.vue`
2. Check API response structure: Add `console.log(response)` before access
3. Check if async data is available: Look for loading states
4. Check component lifecycle: Is code running before `onMounted`?

**Fixes:**
```javascript
// ✅ Optional chaining
const value = user?.profile?.name

// ✅ Default values
const items = data.items || []

// ✅ Guard in computed
const computed = computed(() => {
  if (!apiData.value) return []
  return apiData.value.filter(...)
})

// ✅ Check loading state in template
<div v-if="!loading && data">
  {{ data.value }}
</div>
```

---

#### **B. Type Errors**

**Symptoms:**
- `X is not a function`
- `Cannot call method Y of undefined`
- `Expected string but got object`

**Common causes:**
```javascript
// ❌ Calling non-existent method
items.map() // items is not an array

// ❌ Wrong data type
const total = price + quantity // quantity is string "5"

// ❌ API returned different structure
data.results.forEach() // API changed, now returns { items: [] }
```

**Investigation steps:**
1. Log the variable type: `console.log(typeof variable, variable)`
2. Check API response: `curl http://localhost:8001/api/endpoint | jq`
3. Verify expected data structure in code comments or Pydantic models

**Fixes:**
```javascript
// ✅ Validate type
if (Array.isArray(items)) {
  items.map(...)
}

// ✅ Convert types
const total = price + Number(quantity)

// ✅ Handle API changes
const results = data.results || data.items || []
```

---

#### **C. Async/Promise Errors**

**Symptoms:**
- `UnhandledPromiseRejectionWarning`
- `Error: Network request failed`
- `Cannot read property of undefined` in async context

**Common causes:**
```javascript
// ❌ Missing await
const data = api.getData() // Returns promise, not data
data.filter(...) // Crashes

// ❌ Missing error handling
async function load() {
  const data = await api.getData() // Crashes on 404
}

// ❌ Race condition
onMounted(() => {
  loadData()
  processData() // Runs before loadData() completes
})
```

**Investigation steps:**
1. Check if function is async: `grep -B5 "functionName" file.js`
2. Check for missing `await`: Search for API calls without await
3. Check network tab: Is request failing?
4. Check timing: Are dependent operations racing?

**Fixes:**
```javascript
// ✅ Add await
const data = await api.getData()
data.filter(...)

// ✅ Add try/catch
async function load() {
  try {
    const data = await api.getData()
  } catch (err) {
    error.value = err.message
  }
}

// ✅ Wait for completion
onMounted(async () => {
  await loadData()
  processData()
})
```

---

#### **D. State Management Errors**

**Symptoms:**
- `Maximum call stack size exceeded`
- `Cannot assign to read-only property`
- Components not updating when data changes

**Common causes:**
```javascript
// ❌ Infinite loop
watch(value, () => {
  value.value++ // Triggers watch again
})

// ❌ Mutating props
props.items.push(newItem)

// ❌ Not using .value with refs
const count = ref(0)
count++ // Wrong! Should be count.value++
```

**Investigation steps:**
1. Check watch/computed dependencies
2. Check for prop mutations: `grep -n "props\." file.vue`
3. Check ref usage: Look for missing `.value`

**Fixes:**
```javascript
// ✅ Break infinite loop
watch(value, (newVal, oldVal) => {
  if (newVal !== oldVal + 1) {
    value.value++
  }
})

// ✅ Emit event instead
const emit = defineEmits(['update'])
emit('update', [...props.items, newItem])

// ✅ Use .value
count.value++
```

---

#### **E. Import/Module Errors**

**Symptoms:**
- `Cannot find module 'X'`
- `X is not defined`
- `Unexpected token 'export'`

**Common causes:**
```javascript
// ❌ Wrong import path
import { api } from './api' // File is at ../api.js

// ❌ Named import vs default
import api from './api' // Should be: import { api }

// ❌ Circular dependencies
// A.js imports B.js, B.js imports A.js
```

**Investigation steps:**
```bash
# Find where module is defined
find . -name "api.js" -o -name "api.ts"

# Check if file exports what you're importing
grep -n "export" client/src/api.js

# Check for circular imports
# (Look at import statements in both files)
```

**Fixes:**
```javascript
// ✅ Correct path
import { api } from '../api.js'

// ✅ Match export type
// In api.js: export const api = {...}
import { api } from './api'

// Or: export default api
import api from './api'

// ✅ Break circular dependency
// Extract shared code to third file
```

---

### 5. Debug Workflow by Error Location

#### **Frontend (Vue) Errors**

**Step 1: Check browser console**
```bash
# Start dev server with error output
cd client && npm run dev
```

**Step 2: Open browser DevTools**
- Console tab: See error messages
- Network tab: Check failed API calls
- Vue DevTools: Inspect component state

**Step 3: Add debug logging**
```javascript
// In component setup()
console.log('Component mounted', { data: myData.value })

// In computed properties
const result = computed(() => {
  console.log('Computing result', { input: someData.value })
  return someData.value.filter(...)
})

// In watchers
watch(value, (newVal) => {
  console.log('Value changed', { old: value.value, new: newVal })
})
```

**Step 4: Check common Vue issues**
- Missing reactive wrapper: `ref()` or `reactive()`
- Accessing ref without `.value` in script
- Wrong v-for key (using index instead of unique id)
- Template using undefined variable
- Props not being passed correctly

---

#### **Backend (FastAPI) Errors**

**Step 1: Check server logs**
```bash
# Watch logs in real-time
cd server && uv run python main.py

# Check for Python tracebacks
grep -A 10 "Traceback" server.log
```

**Step 2: Test API endpoint directly**
```bash
# Test with curl
curl http://localhost:8001/api/orders

# Test with pretty output
curl http://localhost:8001/api/orders | jq

# Test with specific query params
curl "http://localhost:8001/api/orders?month=1&warehouse=Warehouse%20A"
```

**Step 3: Add debug logging**
```python
# In endpoint
@app.get("/api/orders")
async def get_orders(month: Optional[int] = None):
    print(f"DEBUG: month={month}, type={type(month)}")
    
    # Log data before processing
    print(f"DEBUG: Found {len(orders)} orders")
    
    return orders
```

**Step 4: Check common FastAPI issues**
- Pydantic validation errors (wrong data type)
- Missing query parameter handling
- CORS errors (frontend can't reach backend)
- Data file not loading (check mock_data.py)
- Wrong filter logic

---

### 6. Systematic Debugging Checklist

When stuck, go through this checklist:

**[ ] Read the full error message**
- Don't skim - read every word
- Error type tells you category
- Message tells you what failed
- Stack trace tells you where

**[ ] Reproduce the error consistently**
- Can you trigger it on demand?
- What steps lead to the error?
- Does it happen every time or intermittently?

**[ ] Check recent changes**
```bash
# What changed recently?
git log --oneline -10
git diff HEAD~1

# What files changed?
git status
```

**[ ] Verify assumptions**
- Is the data structure what you think it is?
- Is the variable initialized?
- Is the API returning expected format?
- Log everything: `console.log()` / `print()`

**[ ] Isolate the problem**
- Comment out code until error goes away
- Add code back piece by piece
- Find exact line that causes error

**[ ] Check dependencies**
- Is data loaded before it's used?
- Are imports correct?
- Are props passed correctly?
- Is state initialized?

**[ ] Search for similar issues**
- Google the exact error message
- Check Stack Overflow
- Check GitHub issues for libraries used

---

### 7. Common Error Patterns and Solutions

#### **"Cannot read property 'X' of undefined"**
```javascript
// Problem
const value = data.items.filter(...)

// Investigation
console.log('data:', data)           // Is data defined?
console.log('data.items:', data.items) // Is items defined?

// Solution
const value = data?.items?.filter(...) || []
```

---

#### **"X is not a function"**
```javascript
// Problem
items.map(i => i.name)

// Investigation
console.log('items type:', typeof items)
console.log('items value:', items)

// Solution
if (Array.isArray(items)) {
  items.map(i => i.name)
}
```

---

#### **"Maximum call stack size exceeded"**
```javascript
// Problem - infinite recursion/loop
watch(count, () => {
  count.value++
})

// Solution - add condition
watch(count, (newVal) => {
  if (newVal < 100) {
    count.value++
  }
})
```

---

#### **Network errors (API calls failing)**
```bash
# Check if backend is running
curl http://localhost:8001/docs

# Check exact request frontend is making
# (Open browser DevTools > Network tab > Click failed request)

# Test API directly
curl http://localhost:8001/api/orders

# Check CORS settings in backend
# FastAPI main.py should have:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 8. Debugging Tools & Commands

**Browser DevTools:**
```javascript
// Pause on caught exceptions
// DevTools > Sources > Pause on exceptions (checkbox)

// Add breakpoint in code
debugger // Execution will pause here

// Inspect Vue component state
// Install Vue DevTools extension
// Inspect tab > Component tree > Click component > See state
```

**Backend debugging:**
```python
# Add breakpoint (with debugger like pdb)
import pdb; pdb.set_trace()

# Or use print debugging
print(f"DEBUG: variable={variable}, type={type(variable)}")

# Check what's in mock data
python -c "from mock_data import orders; print(len(orders))"
```

**Check file structure:**
```bash
# Find all Vue files
find client/src -name "*.vue"

# Find where a function is defined
grep -rn "functionName" client/src/

# Find where a variable is used
grep -rn "variableName" --include="*.vue" --include="*.js"
```

---

### 9. Output Format

Present debugging findings as:

### Error Summary
- **Type**: [Error type from stack trace]
- **Location**: [File:line from stack trace]
- **Context**: [What code was trying to do]
- **Root Cause**: [Why it failed]

### Investigation Steps Taken
1. [What I checked]
2. [What I found]
3. [What ruled out]

### Root Cause Analysis
[Detailed explanation of why the error occurred]

### Recommended Fix
```javascript
// Current code (problematic)
[Show problematic code]

// Fixed code
[Show solution]

// Why this works
[Explain the fix]
```

### Additional Recommendations
- [Prevent similar errors]
- [Add error handling]
- [Improve debugging experience]

### Testing the Fix
1. [Step to reproduce original error]
2. [Step to verify fix works]
3. [Step to test edge cases]

---

## Important Notes

- Always read the full error message - don't assume you know what's wrong
- Stack traces point to symptoms, not always root cause - trace backwards
- When stuck, add more logging - visibility is key
- Reproduce the error before attempting a fix
- Test the fix thoroughly - make sure it doesn't just hide the error
- Consider edge cases - what if data is empty? null? wrong type?

## When to Ask for Help

If after investigation:
- Root cause is unclear after 30 minutes
- Error only happens in production
- Error involves external dependencies/services
- Requires deep knowledge of library internals
- Suspecting a bug in framework/library itself

## Tools to Use

- **Read**: View files at error locations
- **Grep**: Search for function/variable definitions
- **Glob**: Find files matching patterns
- **Bash**: Run tests, check logs, test APIs
- Never hesitate to add `console.log()` / `print()` statements
