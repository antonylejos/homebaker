require('dotenv').config();

const express = require('express');
const cors = require('cors');
const client = require('prom-client');
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------------------------------------------------------------------
// Prometheus
// ---------------------------------------------------------------------------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Structured logging helpers
// ---------------------------------------------------------------------------
function log(severity, message, extra = {}) {
  process.stdout.write(
    JSON.stringify({ severity, message, timestamp: new Date().toISOString(), ...extra }) + '\n'
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// Prometheus middleware
app.use((req, _res, next) => {
  req._startTime = process.hrtime.bigint();
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - req._startTime);
    const durationSec = durationNs / 1e9;
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSec);
  });
  next();
});

// ---------------------------------------------------------------------------
// Health & Metrics
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'baker-service' });
});

app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------
app.get('/ingredients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    log('ERROR', 'GET /ingredients failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/ingredients', async (req, res) => {
  try {
    const { user_id, name, cost, quantity, unit = 'g' } = req.body;
    if (!name || cost === undefined || quantity === undefined) {
      return res.status(400).json({ error: 'name, cost, and quantity are required' });
    }
    const unit_cost = Number(cost) / Number(quantity);
    const { data, error } = await supabase
      .from('ingredients')
      .insert([{ user_id, name, cost: Number(cost), quantity: Number(quantity), unit, unit_cost }])
      .select()
      .single();
    if (error) throw error;
    log('INFO', 'Ingredient created', { id: data.id, name });
    res.status(201).json(data);
  } catch (err) {
    log('ERROR', 'POST /ingredients failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.put('/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, name, cost, quantity, unit } = req.body;
    const updates = {};
    if (user_id !== undefined) updates.user_id = user_id;
    if (name !== undefined) updates.name = name;
    if (unit !== undefined) updates.unit = unit;
    if (cost !== undefined) updates.cost = Number(cost);
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (updates.cost !== undefined && updates.quantity !== undefined) {
      updates.unit_cost = updates.cost / updates.quantity;
    } else if (updates.cost !== undefined || updates.quantity !== undefined) {
      // Fetch existing values to compute unit_cost correctly
      const { data: existing, error: fetchErr } = await supabase
        .from('ingredients')
        .select('cost, quantity')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      const finalCost = updates.cost !== undefined ? updates.cost : existing.cost;
      const finalQty = updates.quantity !== undefined ? updates.quantity : existing.quantity;
      updates.unit_cost = finalCost / finalQty;
    }
    const { data, error } = await supabase
      .from('ingredients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ingredient not found' });
    log('INFO', 'Ingredient updated', { id });
    res.json(data);
  } catch (err) {
    log('ERROR', `PUT /ingredients/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id);
    if (error) throw error;
    log('INFO', 'Ingredient deleted', { id });
    res.status(204).end();
  } catch (err) {
    log('ERROR', `DELETE /ingredients/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Monthly Overheads
// ---------------------------------------------------------------------------
app.get('/overheads', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('monthly_overheads')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json(data || { electricity: 0, rent: 0, misc: 0 });
  } catch (err) {
    log('ERROR', 'GET /overheads failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/overheads', async (req, res) => {
  try {
    const { user_id, electricity = 0, rent = 0, misc = 0 } = req.body;
    // Upsert: if a record exists for this user_id replace it, otherwise insert
    const { data, error } = await supabase
      .from('monthly_overheads')
      .upsert(
        [{ user_id, electricity: Number(electricity), rent: Number(rent), misc: Number(misc) }],
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) throw error;
    log('INFO', 'Overheads saved', { user_id });
    res.status(201).json(data);
  } catch (err) {
    log('ERROR', 'POST /overheads failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
app.get('/equipment', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    log('ERROR', 'GET /equipment failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/equipment', async (req, res) => {
  try {
    const { user_id, name, cost, useful_life_months } = req.body;
    if (!name || cost === undefined || useful_life_months === undefined) {
      return res.status(400).json({ error: 'name, cost, and useful_life_months are required' });
    }
    const monthly_cost = Number(cost) / Number(useful_life_months);
    const { data, error } = await supabase
      .from('equipment')
      .insert([{
        user_id,
        name,
        cost: Number(cost),
        useful_life_months: Number(useful_life_months),
        monthly_cost,
      }])
      .select()
      .single();
    if (error) throw error;
    log('INFO', 'Equipment created', { id: data.id, name });
    res.status(201).json(data);
  } catch (err) {
    log('ERROR', 'POST /equipment failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.put('/equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, name, cost, useful_life_months } = req.body;
    const updates = {};
    if (user_id !== undefined) updates.user_id = user_id;
    if (name !== undefined) updates.name = name;
    if (cost !== undefined) updates.cost = Number(cost);
    if (useful_life_months !== undefined) updates.useful_life_months = Number(useful_life_months);
    if (updates.cost !== undefined && updates.useful_life_months !== undefined) {
      updates.monthly_cost = updates.cost / updates.useful_life_months;
    } else if (updates.cost !== undefined || updates.useful_life_months !== undefined) {
      const { data: existing, error: fetchErr } = await supabase
        .from('equipment')
        .select('cost, useful_life_months')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      const finalCost = updates.cost !== undefined ? updates.cost : existing.cost;
      const finalLife = updates.useful_life_months !== undefined
        ? updates.useful_life_months
        : existing.useful_life_months;
      updates.monthly_cost = finalCost / finalLife;
    }
    const { data, error } = await supabase
      .from('equipment')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Equipment not found' });
    log('INFO', 'Equipment updated', { id });
    res.json(data);
  } catch (err) {
    log('ERROR', `PUT /equipment/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);
    if (error) throw error;
    log('INFO', 'Equipment deleted', { id });
    res.status(204).end();
  } catch (err) {
    log('ERROR', `DELETE /equipment/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Production Settings
// ---------------------------------------------------------------------------
app.get('/production-settings', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('production_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json(data || { cakes_per_month: 1 });
  } catch (err) {
    log('ERROR', 'GET /production-settings failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/production-settings', async (req, res) => {
  try {
    const { user_id, cakes_per_month } = req.body;
    if (cakes_per_month === undefined) {
      return res.status(400).json({ error: 'cakes_per_month is required' });
    }
    const { data, error } = await supabase
      .from('production_settings')
      .upsert(
        [{ user_id, cakes_per_month: Number(cakes_per_month) }],
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) throw error;
    log('INFO', 'Production settings saved', { user_id, cakes_per_month });
    res.status(201).json(data);
  } catch (err) {
    log('ERROR', 'POST /production-settings failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------
app.get('/recipes', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    log('ERROR', 'GET /recipes failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/recipes', async (req, res) => {
  try {
    const { user_id, name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const { data, error } = await supabase
      .from('recipes')
      .insert([{ user_id, name, description }])
      .select()
      .single();
    if (error) throw error;
    log('INFO', 'Recipe created', { id: data.id, name });
    res.status(201).json(data);
  } catch (err) {
    log('ERROR', 'POST /recipes failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.get('/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();
    if (recipeErr) throw recipeErr;
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const { data: recipeIngredients, error: riErr } = await supabase
      .from('recipe_ingredients')
      .select('*, ingredients(*)')
      .eq('recipe_id', id);
    if (riErr) throw riErr;

    res.json({ ...recipe, recipe_ingredients: recipeIngredients });
  } catch (err) {
    log('ERROR', `GET /recipes/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.put('/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    const { data, error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Recipe not found' });
    log('INFO', 'Recipe updated', { id });
    res.json(data);
  } catch (err) {
    log('ERROR', `PUT /recipes/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Delete recipe_ingredients first (FK constraint)
    const { error: riErr } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', id);
    if (riErr) throw riErr;
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);
    if (error) throw error;
    log('INFO', 'Recipe deleted', { id });
    res.status(204).end();
  } catch (err) {
    log('ERROR', `DELETE /recipes/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Recipe Ingredients
// ---------------------------------------------------------------------------
app.post('/recipes/:id/ingredients', async (req, res) => {
  try {
    const recipe_id = req.params.id;
    const { ingredient_id, quantity_used } = req.body;
    if (!ingredient_id || quantity_used === undefined) {
      return res.status(400).json({ error: 'ingredient_id and quantity_used are required' });
    }
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .upsert(
        [{ recipe_id, ingredient_id, quantity_used: Number(quantity_used) }],
        { onConflict: 'recipe_id,ingredient_id' }
      )
      .select()
      .single();
    if (error) throw error;
    log('INFO', 'Recipe ingredient added', { recipe_id, ingredient_id });
    res.status(201).json(data);
  } catch (err) {
    log('ERROR', `POST /recipes/${req.params.id}/ingredients failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/recipes/:id/ingredients/:ingredientId', async (req, res) => {
  try {
    const { id: recipe_id, ingredientId: ingredient_id } = req.params;
    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipe_id)
      .eq('ingredient_id', ingredient_id);
    if (error) throw error;
    log('INFO', 'Recipe ingredient removed', { recipe_id, ingredient_id });
    res.status(204).end();
  } catch (err) {
    log('ERROR', `DELETE /recipes/${req.params.id}/ingredients/${req.params.ingredientId} failed`, {
      error: err.message,
    });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Calculate
// ---------------------------------------------------------------------------
app.post('/calculate', async (req, res) => {
  try {
    const {
      recipe_id,
      ingredients: ingredientsList = [],
      labor_hours = 0,
      labor_rate = 0,
      extras = [],
      profit_margin = 0,
    } = req.body;

    // 1. Fetch overhead config
    const { data: overheadRow } = await supabase
      .from('monthly_overheads')
      .select('electricity, rent, misc')
      .limit(1)
      .maybeSingle();

    const overhead = overheadRow || { electricity: 0, rent: 0, misc: 0 };
    const fixedMonthlyOverhead = Number(overhead.electricity) + Number(overhead.rent) + Number(overhead.misc);

    // 2. Sum equipment monthly costs
    const { data: equipmentRows } = await supabase
      .from('equipment')
      .select('monthly_cost');
    const equipmentMonthly = (equipmentRows || []).reduce(
      (sum, e) => sum + Number(e.monthly_cost || 0),
      0
    );

    // 3. Fetch production settings
    const { data: prodSettings } = await supabase
      .from('production_settings')
      .select('cakes_per_month')
      .limit(1)
      .maybeSingle();
    const cakesPerMonth = Number((prodSettings || {}).cakes_per_month || 1);

    const overhead_cost = (fixedMonthlyOverhead + equipmentMonthly) / cakesPerMonth;

    // 4. Ingredient cost
    let ingredient_cost = 0;
    const ingredientBreakdown = [];

    for (const item of ingredientsList) {
      const { data: ing, error: ingErr } = await supabase
        .from('ingredients')
        .select('name, unit_cost, unit')
        .eq('id', item.ingredient_id)
        .single();
      if (ingErr || !ing) continue;
      const line_cost = Number(ing.unit_cost) * Number(item.quantity_used);
      ingredient_cost += line_cost;
      ingredientBreakdown.push({
        ingredient_id: item.ingredient_id,
        name: ing.name,
        quantity_used: Number(item.quantity_used),
        unit: ing.unit,
        unit_cost: Number(ing.unit_cost),
        line_cost,
      });
    }

    // 5. Labor cost
    const labor_cost = Number(labor_hours) * Number(labor_rate);

    // 6. Extras
    const extras_cost = (extras || []).reduce((sum, e) => sum + Number(e.cost || 0), 0);

    // 7. Totals
    const total_cost = ingredient_cost + labor_cost + extras_cost + overhead_cost;
    const profit_amount = total_cost * (Number(profit_margin) / 100);
    const selling_price = total_cost + profit_amount;

    const breakdown = {
      ingredient_cost: parseFloat(ingredient_cost.toFixed(4)),
      labor_cost: parseFloat(labor_cost.toFixed(4)),
      extras_cost: parseFloat(extras_cost.toFixed(4)),
      overhead_cost: parseFloat(overhead_cost.toFixed(4)),
      total_cost: parseFloat(total_cost.toFixed(4)),
      profit_margin: Number(profit_margin),
      profit_amount: parseFloat(profit_amount.toFixed(4)),
      selling_price: parseFloat(selling_price.toFixed(4)),
      ingredients: ingredientBreakdown,
      extras,
      labor_hours: Number(labor_hours),
      labor_rate: Number(labor_rate),
    };

    // 8. Optionally persist
    if (recipe_id) {
      const { error: saveErr } = await supabase.from('calculations').insert([
        {
          recipe_id,
          ingredient_cost: breakdown.ingredient_cost,
          labor_cost: breakdown.labor_cost,
          extras_cost: breakdown.extras_cost,
          overhead_cost: breakdown.overhead_cost,
          total_cost: breakdown.total_cost,
          profit_margin: breakdown.profit_margin,
          profit_amount: breakdown.profit_amount,
          selling_price: breakdown.selling_price,
        },
      ]);
      if (saveErr) {
        log('WARNING', 'Failed to save calculation', { error: saveErr.message });
      }
    }

    log('INFO', 'Calculation completed', { recipe_id, selling_price: breakdown.selling_price });
    res.json(breakdown);
  } catch (err) {
    log('ERROR', 'POST /calculate failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Calculations history
// ---------------------------------------------------------------------------
app.get('/calculations', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('calculations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    log('ERROR', 'GET /calculations failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.get('/calculations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('calculations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Calculation not found' });
    res.json(data);
  } catch (err) {
    log('ERROR', `GET /calculations/${req.params.id} failed`, { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  log('INFO', `baker-service started`, { port: PORT });
});

module.exports = app;
