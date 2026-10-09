<template>
  <div class="restocking">
    <div class="page-header">
      <h2>Restocking Planner</h2>
      <p>Plan and submit restocking orders based on demand forecasts and available budget</p>
    </div>

    <div v-if="successMessage" class="success-banner">
      {{ successMessage }}
    </div>

    <div v-if="loading" class="loading">Loading demand forecasts...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Budget Selection Card -->
      <div class="card budget-card">
        <div class="card-header">
          <h3 class="card-title">Set Your Budget</h3>
        </div>
        <div class="budget-controls">
          <div class="budget-slider-container">
            <input
              v-model.number="budget"
              type="range"
              min="10000"
              max="500000"
              step="10000"
              class="budget-slider"
              @input="calculateRecommendations"
            />
            <div class="budget-markers">
              <span>$10K</span>
              <span>$500K</span>
            </div>
          </div>
          <div class="budget-display">
            <div class="budget-label">Available Budget</div>
            <div class="budget-value">${{ (budget / 1000).toFixed(0) }}K</div>
          </div>
        </div>
      </div>

      <!-- Recommendations Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recommended Orders ({{ recommendations.length }} items)</h3>
          <div class="total-cost">
            Total: <strong>${{ totalCost.toLocaleString() }}</strong>
          </div>
        </div>

        <div v-if="recommendations.length === 0" class="empty-state">
          <p>No items to restock with current budget. Try increasing the budget amount.</p>
        </div>

        <div v-else>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item Name</th>
                  <th>Forecasted Demand</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in recommendations" :key="item.sku">
                  <td><strong>{{ item.sku }}</strong></td>
                  <td>{{ item.name }}</td>
                  <td><strong>{{ item.quantity }}</strong></td>
                  <td>${{ item.unit_cost.toFixed(2) }}</td>
                  <td><strong>${{ item.total_cost.toLocaleString() }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="action-footer">
            <button
              @click="placeOrder"
              class="btn-place-order"
              :disabled="recommendations.length === 0"
            >
              Place Restocking Order
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

export default {
  name: 'Restocking',
  setup() {
    const loading = ref(true)
    const error = ref(null)
    const budget = ref(100000) // Default $100K
    const demandForecasts = ref([])
    const inventoryItems = ref([])
    const recommendations = ref([])
    const successMessage = ref('')

    // Create a map for quick inventory lookup by SKU
    const inventoryMap = computed(() => {
      const map = {}
      inventoryItems.value.forEach(item => {
        map[item.sku] = item
      })
      return map
    })

    // Calculate total cost of recommendations
    const totalCost = computed(() => {
      return recommendations.value.reduce((sum, item) => sum + item.total_cost, 0)
    })

    const loadData = async () => {
      try {
        loading.value = true
        error.value = null

        const [forecasts, inventory] = await Promise.all([
          api.getDemandForecasts(),
          api.getInventory({ warehouse: 'all', category: 'all' })
        ])

        demandForecasts.value = forecasts
        inventoryItems.value = inventory

        calculateRecommendations()
      } catch (err) {
        error.value = 'Failed to load data: ' + err.message
        console.error(err)
      } finally {
        loading.value = false
      }
    }

    const calculateRecommendations = () => {
      const recs = []
      let remainingBudget = budget.value

      // Sort forecasts by forecasted_demand (highest first)
      const sortedForecasts = [...demandForecasts.value].sort(
        (a, b) => b.forecasted_demand - a.forecasted_demand
      )

      // Fill recommendations until budget is exhausted
      for (const forecast of sortedForecasts) {
        const inventoryItem = inventoryMap.value[forecast.item_sku]

        if (!inventoryItem) continue

        const quantity = forecast.forecasted_demand
        const unitCost = inventoryItem.unit_cost
        const totalCost = quantity * unitCost

        if (totalCost <= remainingBudget) {
          recs.push({
            sku: forecast.item_sku,
            name: forecast.item_name,
            quantity: quantity,
            unit_cost: unitCost,
            total_cost: totalCost
          })
          remainingBudget -= totalCost
        }
      }

      recommendations.value = recs
    }

    const placeOrder = () => {
      if (recommendations.value.length === 0) {
        return
      }

      // Generate order
      const orderDate = new Date().toISOString().split('T')[0]
      const daysToAdd = Math.floor(Math.random() * 4) + 7 // Random 7-10 days
      const deliveryDate = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const order = {
        id: `rst-${Date.now()}`,
        order_number: `RST-${Date.now()}`,
        order_date: orderDate,
        expected_delivery: deliveryDate,
        status: 'Restocking',
        customer: 'Internal Restocking',
        items: recommendations.value.map(rec => ({
          name: rec.name,
          sku: rec.sku,
          quantity: rec.quantity,
          unit_price: rec.unit_cost
        })),
        total_value: totalCost.value
      }

      // Get existing orders from localStorage
      const existingOrders = JSON.parse(localStorage.getItem('submitted_orders') || '[]')
      existingOrders.push(order)
      localStorage.setItem('submitted_orders', JSON.stringify(existingOrders))

      // Show success message
      successMessage.value = `Order ${order.order_number} placed successfully! Expected delivery: ${deliveryDate}`

      // Clear success message after 5 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 5000)

      // Reset recommendations but keep budget
      calculateRecommendations()
    }

    onMounted(() => loadData())

    return {
      loading,
      error,
      budget,
      recommendations,
      totalCost,
      successMessage,
      calculateRecommendations,
      placeOrder
    }
  }
}
</script>

<style scoped>
.restocking {
  max-width: 1400px;
}

.success-banner {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-weight: 500;
}

.budget-card {
  margin-bottom: 1.5rem;
}

.budget-controls {
  display: flex;
  gap: 2rem;
  align-items: center;
  padding: 1rem 0;
}

.budget-slider-container {
  flex: 1;
  max-width: 600px;
}

.budget-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #e2e8f0;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.budget-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  transition: all 0.2s;
}

.budget-slider::-webkit-slider-thumb:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.budget-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.budget-slider::-moz-range-thumb:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.budget-markers {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.813rem;
  color: #64748b;
}

.budget-display {
  text-align: right;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-width: 180px;
}

.budget-label {
  font-size: 0.813rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.budget-value {
  font-size: 2rem;
  font-weight: 700;
  color: #3b82f6;
  letter-spacing: -0.025em;
}

.total-cost {
  font-size: 0.938rem;
  color: #64748b;
}

.total-cost strong {
  color: #0f172a;
  font-size: 1.125rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #64748b;
}

.action-footer {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.btn-place-order {
  padding: 0.75rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.938rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-place-order:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-place-order:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
</style>
