# Vue Component Optimization Analyzer

**Trigger**: Use this skill when the user asks to optimize Vue components, analyze component performance, identify code reuse opportunities, or review component structure.

**Examples**: "optimize this component", "analyze component performance", "suggest Vue improvements", "check for reusable logic"

---

## Analysis Framework

When analyzing a Vue component, systematically check these areas:

### 1. Reactivity Efficiency

**Check for:**
- ❌ Methods used for derived data (should be computed)
- ❌ Computed properties with side effects
- ❌ Unnecessary reactive refs (could be plain variables)
- ❌ Deep object mutations without proper reactivity
- ❌ Array index as v-for keys

**Example - Method vs Computed:**
```vue
<!-- ❌ BAD: Runs on every render -->
<template>
  <div>{{ getFilteredItems() }}</div>
</template>
<script>
const getFilteredItems = () => {
  return items.value.filter(i => i.active)
}
</script>

<!-- ✅ GOOD: Cached until items changes -->
<script>
const filteredItems = computed(() => {
  return items.value.filter(i => i.active)
})
</script>
```

**Action**: Convert calculations to computed properties when:
- Result depends only on reactive data
- No side effects needed
- Value used in template or other computed properties

### 2. Component Size & Complexity

**Metrics to check:**
- Template lines: >150 lines → consider splitting
- Script lines: >200 lines → extract composables
- Number of refs: >10 → group related state
- Number of methods: >15 → extract utilities

**Splitting patterns:**

**Extract presentational components:**
```vue
<!-- Before: Monolithic component -->
<template>
  <div class="card">
    <div class="card-header">
      <h3>{{ title }}</h3>
      <button @click="close">×</button>
    </div>
    <div class="card-body">
      <!-- 100+ lines of content -->
    </div>
  </div>
</template>

<!-- After: Split into Card + CardHeader + CardBody -->
<template>
  <Card>
    <CardHeader :title="title" @close="handleClose" />
    <CardBody>
      <!-- Content -->
    </CardBody>
  </Card>
</template>
```

**Extract composables for logic:**
```javascript
// Before: All logic in component
export default {
  setup() {
    const data = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    const loadData = async () => {
      try {
        loading.value = true
        data.value = await api.getData()
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }
    
    onMounted(loadData)
    
    return { data, loading, error, loadData }
  }
}

// After: Extract to composable
// composables/useDataLoader.js
export function useDataLoader(fetchFn) {
  const data = ref([])
  const loading = ref(false)
  const error = ref(null)
  
  const load = async () => {
    try {
      loading.value = true
      error.value = null
      data.value = await fetchFn()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  
  onMounted(load)
  
  return { data, loading, error, reload: load }
}

// In component
const { data, loading, error, reload } = useDataLoader(() => api.getData())
```

### 3. Performance Anti-patterns

**Common issues to flag:**

**❌ Inline function creation in v-for:**
```vue
<div v-for="item in items" :key="item.id">
  <button @click="() => handleClick(item.id)">Click</button>
</div>
```
**✅ Extract to method:**
```vue
<div v-for="item in items" :key="item.id">
  <button @click="handleClick(item.id)">Click</button>
</div>
```

**❌ Heavy computation in template:**
```vue
<div>{{ items.filter(i => i.active).map(i => i.name).join(', ') }}</div>
```
**✅ Use computed property:**
```vue
<div>{{ activeItemNames }}</div>
<script>
const activeItemNames = computed(() => 
  items.value.filter(i => i.active).map(i => i.name).join(', ')
)
</script>
```

**❌ Unnecessary re-renders (using index as key):**
```vue
<div v-for="(item, index) in items" :key="index">
```
**✅ Use unique identifier:**
```vue
<div v-for="item in items" :key="item.id">
```

**❌ Watching for side effects when computed would work:**
```javascript
watch(price, (newPrice) => {
  total.value = newPrice * quantity.value
})
```
**✅ Use computed:**
```javascript
const total = computed(() => price.value * quantity.value)
```

### 4. Code Reuse Opportunities

**Look for patterns that appear in multiple components:**

**Shared state management:**
- Filter state across views → Create `useFilters()` composable
- Authentication state → Create `useAuth()` composable
- API loading patterns → Create `useApi()` or `useDataLoader()` composable

**Repeated UI patterns:**
- Similar cards/modals → Extract base component with slots
- Table variations → Extract `BaseTable` with props for columns
- Form patterns → Extract form field components

**Utility functions:**
- Date formatting → Move to `utils/date.js`
- Currency formatting → Move to `utils/currency.js`
- Validation logic → Move to `utils/validation.js`

### 5. Rendering Optimization

**Conditional rendering strategy:**

```vue
<!-- Use v-show for frequently toggled content -->
<div v-show="isVisible">Frequently toggled</div>

<!-- Use v-if for rarely shown content -->
<HeavyComponent v-if="shouldRender" />
```

**Lazy loading for heavy components:**
```javascript
import { defineAsyncComponent } from 'vue'

const HeavyChart = defineAsyncComponent(() =>
  import('./components/HeavyChart.vue')
)
```

**Debounced watchers for expensive operations:**
```javascript
import { watchDebounced } from '@vueuse/core'

watchDebounced(
  searchQuery,
  async (newQuery) => {
    // Expensive API call
    results.value = await api.search(newQuery)
  },
  { debounce: 500 }
)
```

### 6. Props & Events Optimization

**Avoid prop drilling:**
```javascript
// ❌ Bad: Passing props through multiple levels
<ComponentA :user="user">
  <ComponentB :user="user">
    <ComponentC :user="user" />
  </ComponentB>
</ComponentA>

// ✅ Good: Use provide/inject or composable
// In parent
provide('user', user)

// In deeply nested child
const user = inject('user')

// Or use composable for shared state
const { user } = useAuth()
```

**Optimize event handling:**
```vue
<!-- ❌ Creating new function on each render -->
<div v-for="item in items" :key="item.id">
  <button @click="$emit('delete', item.id)">Delete</button>
</div>

<!-- ✅ Better: Component emits are optimized -->
<script>
const emit = defineEmits(['delete'])

const handleDelete = (id) => {
  emit('delete', id)
}
</script>
```

## Analysis Process

When analyzing a component, follow these steps:

1. **Read the component file** - Get full context of template, script, and styles

2. **Identify the component's purpose** - What is its primary responsibility?

3. **Check reactivity patterns:**
   - List all refs and computed properties
   - Identify methods that should be computed
   - Check for proper key usage in v-for

4. **Measure complexity:**
   - Count template lines
   - Count script lines
   - Count number of refs/computed/methods
   - Flag if thresholds exceeded

5. **Look for reuse opportunities:**
   - Repeated code blocks
   - Similar patterns to other components
   - Logic that could be extracted

6. **Check for performance issues:**
   - Inline functions in loops
   - Heavy template expressions
   - Missing debouncing on expensive operations
   - Improper v-if/v-show usage

7. **Generate recommendations:**
   - List issues by priority (high/medium/low)
   - Provide before/after code examples
   - Estimate performance impact
   - Suggest which changes to make first

## Output Format

Present findings as:

### Summary
- Component: [Name]
- Purpose: [Brief description]
- Current size: [X template lines, Y script lines]
- Issues found: [Count by severity]

### High Priority Issues
1. **[Issue type]**: [Description]
   - **Why it matters**: [Performance/maintainability impact]
   - **Fix**: [Specific recommendation]
   - **Code example**: [Before → After]

### Medium Priority Issues
[Same format]

### Opportunities for Improvement
[Same format]

### Reuse Opportunities
- **[Pattern name]**: Could be extracted to [composable/component name]
  - Used in: [List other locations]
  - Benefit: [Reduced duplication, better maintainability, etc.]

### Estimated Impact
- Performance: [Low/Medium/High improvement expected]
- Maintainability: [Low/Medium/High improvement expected]
- Code reduction: [Estimated lines saved]

## Important Notes

- Always read the full component before making recommendations
- Consider the component's context within the application
- Don't over-optimize - premature optimization is wasteful
- Balance performance with readability
- Suggest incremental improvements, not complete rewrites
- Provide concrete code examples, not just descriptions
- Consider the team's Vue.js experience level
- Test suggestions don't break existing functionality

## When NOT to Optimize

Skip optimization if:
- Component is <100 lines and performs well
- Change would reduce readability significantly
- Performance impact is negligible (<10ms)
- Component is rarely used
- Complexity is inherent to business logic

## Testing Recommendations

After optimization, verify:
- Component still renders correctly
- All user interactions work
- Props and events function as expected
- Performance actually improved (measure with DevTools)
- No console errors or warnings
