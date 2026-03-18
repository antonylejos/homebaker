"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ─── Types ────────────────────────────────────────────────────────────────────

type Ingredient = {
  id: string;
  name: string;
  cost: number;
  quantity: number;
  unit: string;
  unit_cost: number;
};

type Equipment = {
  id: string;
  name: string;
  cost: number;
  useful_life_months: number;
  monthly_cost: number;
};

type Overhead = {
  id: string;
  electricity: number;
  rent: number;
  misc: number;
};

type ProductionSettings = {
  cakes_per_month: number;
  electricity: number;
  rent: number;
  misc: number;
};

type Recipe = {
  id: string;
  name: string;
  description: string;
  ingredients: CalculatorIngredient[];
  labor_hours: number;
  labor_minutes: number;
  labor_rate: number;
  extras: Extra[];
  profit_margin: number;
};

type CalculatorIngredient = {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity_used: number;
  line_cost: number;
};

type Extra = {
  name: string;
  cost: number;
};

type CalcResult = {
  ingredient_cost: number;
  labor_cost: number;
  extras_cost: number;
  overhead_cost: number;
  total_cost: number;
  profit_amount: number;
  selling_price: number;
};

type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

type Tab = "calculator" | "ingredients" | "overheads" | "recipes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (!isFinite(amount)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const CakeIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
    <path d="M2 21h20" />
    <path d="M7 8v3" />
    <path d="M12 8v3" />
    <path d="M17 8v3" />
    <path d="M7 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2Z" fill="currentColor" />
    <path d="M12 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2Z" fill="currentColor" />
  </svg>
);

const ListIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const SettingsIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

const BookmarkIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const TrashIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const PlusIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
  </svg>
);

const InfoIcon = ({ size = 14, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const LoadIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        left: "16px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
        maxWidth: "380px",
        marginLeft: "auto",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-down"
          style={{
            pointerEvents: "all",
            background:
              t.type === "success"
                ? "linear-gradient(135deg, #059669, #047857)"
                : t.type === "error"
                ? "linear-gradient(135deg, #e11d48, #be123c)"
                : "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "#fff",
            borderRadius: "12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
          onClick={() => onDismiss(t.id)}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <XIcon size={14} />
        </div>
      ))}
    </div>
  );
}

function Skeleton({ width = "100%", height = "20px", style = {} }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "13px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-secondary)",
        marginBottom: "12px",
      }}
    >
      {children}
    </h2>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  min,
  max,
  step,
  suffix,
  required,
}: {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label && (
        <label
          style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          required={required}
          style={{
            width: "100%",
            minHeight: "44px",
            padding: suffix ? "10px 36px 10px 12px" : "10px 12px",
            background: "rgba(255,252,248,0.8)",
            border: "1.5px solid var(--border-color)",
            borderRadius: "10px",
            fontSize: "15px",
            color: "var(--text-primary)",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-rose)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: "10px",
              fontSize: "13px",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth,
  disabled,
  type = "button",
  style = {},
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "amber";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    borderRadius: "10px",
    fontWeight: 600,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : undefined,
  };

  const sizes = {
    sm: { padding: "6px 12px", fontSize: "13px", minHeight: "32px" },
    md: { padding: "10px 18px", fontSize: "15px", minHeight: "44px" },
    lg: { padding: "14px 24px", fontSize: "17px", minHeight: "52px" },
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "linear-gradient(135deg, #e11d48, #be123c)", color: "#fff", boxShadow: "0 2px 10px rgba(225,29,72,0.3)" },
    secondary: { background: "rgba(255,252,248,0.9)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)" },
    danger: { background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", boxShadow: "0 2px 8px rgba(239,68,68,0.3)" },
    ghost: { background: "transparent", color: "var(--text-secondary)", padding: "6px 10px" },
    amber: { background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", boxShadow: "0 2px 10px rgba(245,158,11,0.3)" },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  initialIngredients: Ingredient[];
  initialSettings: ProductionSettings | null;
};

export default function BakerDashboard({ initialIngredients, initialSettings }: Props) {
  const [tab, setTab] = useState<Tab>("calculator");
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Ingredients state ──
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingForm, setIngForm] = useState({ name: "", cost: "", quantity: "", unit: "g" });
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  // ── Overhead/Settings state ──
  const [settings, setSettings] = useState<ProductionSettings>(
    initialSettings ?? { cakes_per_month: 10, electricity: 0, rent: 0, misc: 0 }
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipForm, setEquipForm] = useState({ name: "", cost: "", useful_life_months: "" });

  // ── Calculator state ──
  const [selectedIngId, setSelectedIngId] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [calcIngredients, setCalcIngredients] = useState<CalculatorIngredient[]>([]);
  const [laborHours, setLaborHours] = useState("0");
  const [laborMinutes, setLaborMinutes] = useState("0");
  const [laborRate, setLaborRate] = useState("50");
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraCost, setExtraCost] = useState("");
  const [profitMargin, setProfitMargin] = useState(30);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // ── Recipes state ──
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDesc, setRecipeDesc] = useState("");

  // ─── Toast helpers ─────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchIngredients = useCallback(async () => {
    setIngredientsLoading(true);
    try {
      const res = await fetch(`${API_URL}/ingredients`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIngredients(data);
    } catch {
      addToast("Could not load ingredients", "error");
    } finally {
      setIngredientsLoading(false);
    }
  }, [addToast]);

  const fetchEquipment = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/equipment`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEquipment(data);
    } catch {
      // silent
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSettings(data);
    } catch {
      // silent
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const res = await fetch(`${API_URL}/recipes`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRecipes(data);
    } catch {
      addToast("Could not load recipes", "error");
    } finally {
      setRecipesLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchEquipment();
    fetchSettings();
    fetchRecipes();
  }, [fetchEquipment, fetchSettings, fetchRecipes]);

  // ─── Overhead per cake calculation ────────────────────────────────────────

  const totalMonthlyOverhead =
    settings.electricity +
    settings.rent +
    settings.misc +
    equipment.reduce((s, e) => s + e.monthly_cost, 0);

  const overheadPerCake =
    settings.cakes_per_month > 0
      ? totalMonthlyOverhead / settings.cakes_per_month
      : 0;

  // ─── Calculator: Add ingredient ───────────────────────────────────────────

  const handleAddIngredient = () => {
    const ing = ingredients.find((i) => i.id === selectedIngId);
    if (!ing) { addToast("Select an ingredient", "error"); return; }
    const qty = parseFloat(selectedQty);
    if (isNaN(qty) || qty <= 0) { addToast("Enter a valid quantity", "error"); return; }
    const lineCost = ing.unit_cost * qty;
    setCalcIngredients((prev) => [
      ...prev,
      {
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        unit: ing.unit,
        quantity_used: qty,
        line_cost: lineCost,
      },
    ]);
    setSelectedQty("");
    setCalcResult(null);
  };

  const removeCalcIngredient = (idx: number) => {
    setCalcIngredients((prev) => prev.filter((_, i) => i !== idx));
    setCalcResult(null);
  };

  // ─── Calculator: Add extra ────────────────────────────────────────────────

  const handleAddExtra = () => {
    if (!extraName.trim()) { addToast("Enter extra name", "error"); return; }
    const cost = parseFloat(extraCost);
    if (isNaN(cost) || cost < 0) { addToast("Enter valid cost", "error"); return; }
    setExtras((prev) => [...prev, { name: extraName.trim(), cost }]);
    setExtraName("");
    setExtraCost("");
    setCalcResult(null);
  };

  const removeExtra = (idx: number) => {
    setExtras((prev) => prev.filter((_, i) => i !== idx));
    setCalcResult(null);
  };

  // ─── Calculate ────────────────────────────────────────────────────────────

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const payload = {
        ingredients: calcIngredients,
        labor_hours: parseFloat(laborHours) || 0,
        labor_minutes: parseFloat(laborMinutes) || 0,
        labor_rate: parseFloat(laborRate) || 0,
        extras,
        profit_margin: profitMargin,
        overhead_per_cake: overheadPerCake,
      };
      const res = await fetch(`${API_URL}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Calculation failed");
      const data: CalcResult = await res.json();
      setCalcResult(data);
    } catch {
      // Fallback: calculate locally
      const ingredientCost = calcIngredients.reduce((s, i) => s + i.line_cost, 0);
      const hours = (parseFloat(laborHours) || 0) + (parseFloat(laborMinutes) || 0) / 60;
      const laborCost = hours * (parseFloat(laborRate) || 0);
      const extrasCost = extras.reduce((s, e) => s + e.cost, 0);
      const totalCost = ingredientCost + laborCost + extrasCost + overheadPerCake;
      const profitAmount = totalCost * (profitMargin / 100);
      setCalcResult({
        ingredient_cost: ingredientCost,
        labor_cost: laborCost,
        extras_cost: extrasCost,
        overhead_cost: overheadPerCake,
        total_cost: totalCost,
        profit_amount: profitAmount,
        selling_price: totalCost + profitAmount,
      });
    } finally {
      setCalculating(false);
    }
  };

  // ─── Save Recipe ──────────────────────────────────────────────────────────

  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) { addToast("Enter a recipe name", "error"); return; }
    try {
      const payload = {
        name: recipeName.trim(),
        description: recipeDesc.trim(),
        ingredients: calcIngredients,
        labor_hours: parseFloat(laborHours) || 0,
        labor_minutes: parseFloat(laborMinutes) || 0,
        labor_rate: parseFloat(laborRate) || 0,
        extras,
        profit_margin: profitMargin,
      };
      const res = await fetch(`${API_URL}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      addToast(`Recipe "${recipeName}" saved!`, "success");
      setShowSaveModal(false);
      setRecipeName("");
      setRecipeDesc("");
      fetchRecipes();
    } catch {
      addToast("Could not save recipe", "error");
    }
  };

  // ─── Load Recipe ──────────────────────────────────────────────────────────

  const handleLoadRecipe = (recipe: Recipe) => {
    setCalcIngredients(recipe.ingredients || []);
    setLaborHours(String(recipe.labor_hours ?? 0));
    setLaborMinutes(String(recipe.labor_minutes ?? 0));
    setLaborRate(String(recipe.labor_rate ?? 50));
    setExtras(recipe.extras || []);
    setProfitMargin(recipe.profit_margin ?? 30);
    setCalcResult(null);
    setTab("calculator");
    addToast(`Loaded recipe: ${recipe.name}`, "info");
  };

  // ─── Delete Recipe ────────────────────────────────────────────────────────

  const handleDeleteRecipe = async (id: string, name: string) => {
    try {
      await fetch(`${API_URL}/recipes/${id}`, { method: "DELETE" });
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      addToast(`Deleted "${name}"`, "success");
    } catch {
      addToast("Could not delete recipe", "error");
    }
  };

  // ─── Ingredients CRUD ─────────────────────────────────────────────────────

  const handleAddIngredientForm = async () => {
    if (!ingForm.name.trim()) { addToast("Enter ingredient name", "error"); return; }
    const cost = parseFloat(ingForm.cost);
    const quantity = parseFloat(ingForm.quantity);
    if (isNaN(cost) || cost <= 0) { addToast("Enter valid cost", "error"); return; }
    if (isNaN(quantity) || quantity <= 0) { addToast("Enter valid quantity", "error"); return; }

    try {
      const res = await fetch(`${API_URL}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ingForm, cost, quantity }),
      });
      if (!res.ok) throw new Error("Save failed");
      addToast(`Added "${ingForm.name}"`, "success");
      setIngForm({ name: "", cost: "", quantity: "", unit: "g" });
      fetchIngredients();
    } catch {
      // Fallback: local add
      const unitCost = cost / quantity;
      const newIng: Ingredient = {
        id: uid(),
        name: ingForm.name.trim(),
        cost,
        quantity,
        unit: ingForm.unit,
        unit_cost: unitCost,
      };
      setIngredients((prev) => [...prev, newIng]);
      setIngForm({ name: "", cost: "", quantity: "", unit: "g" });
      addToast(`Added "${newIng.name}"`, "success");
    }
  };

  const handleDeleteIngredient = async (id: string, name: string) => {
    try {
      await fetch(`${API_URL}/ingredients/${id}`, { method: "DELETE" });
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      addToast(`Deleted "${name}"`, "success");
    } catch {
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      addToast(`Deleted "${name}"`, "success");
    }
  };

  const handleEditIngredient = async () => {
    if (!editingIng) return;
    try {
      const res = await fetch(`${API_URL}/ingredients/${editingIng.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingIng),
      });
      if (!res.ok) throw new Error("Update failed");
      setIngredients((prev) => prev.map((i) => (i.id === editingIng.id ? { ...editingIng, unit_cost: editingIng.cost / editingIng.quantity } : i)));
      addToast("Updated!", "success");
      setEditingIng(null);
    } catch {
      setIngredients((prev) => prev.map((i) => (i.id === editingIng.id ? { ...editingIng, unit_cost: editingIng.cost / editingIng.quantity } : i)));
      addToast("Updated!", "success");
      setEditingIng(null);
    }
  };

  // ─── Equipment CRUD ───────────────────────────────────────────────────────

  const handleAddEquipment = async () => {
    if (!equipForm.name.trim()) { addToast("Enter equipment name", "error"); return; }
    const cost = parseFloat(equipForm.cost);
    const months = parseInt(equipForm.useful_life_months);
    if (isNaN(cost) || cost <= 0) { addToast("Enter valid cost", "error"); return; }
    if (isNaN(months) || months <= 0) { addToast("Enter valid useful life", "error"); return; }

    const monthly_cost = cost / months;
    try {
      const res = await fetch(`${API_URL}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...equipForm, cost, useful_life_months: months }),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      setEquipment((prev) => [...prev, saved]);
    } catch {
      setEquipment((prev) => [
        ...prev,
        { id: uid(), name: equipForm.name.trim(), cost, useful_life_months: months, monthly_cost },
      ]);
    }
    setEquipForm({ name: "", cost: "", useful_life_months: "" });
    addToast("Equipment added", "success");
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      await fetch(`${API_URL}/equipment/${id}`, { method: "DELETE" });
    } catch { /* silent */ }
    setEquipment((prev) => prev.filter((e) => e.id !== id));
    addToast("Equipment removed", "success");
  };

  // ─── Save Settings ────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      addToast("Settings saved!", "success");
    } catch {
      addToast("Settings saved locally", "info");
    } finally {
      setSettingsSaving(false);
    }
  };

  // ─── Labour cost preview ──────────────────────────────────────────────────

  const laborCostPreview =
    ((parseFloat(laborHours) || 0) + (parseFloat(laborMinutes) || 0) / 60) *
    (parseFloat(laborRate) || 0);

  // ─── Ingredient form unit cost preview ────────────────────────────────────

  const ingUnitCostPreview =
    ingForm.cost && ingForm.quantity && parseFloat(ingForm.quantity) > 0
      ? parseFloat(ingForm.cost) / parseFloat(ingForm.quantity)
      : null;

  // ─── Panel styles ─────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    background: "var(--panel-bg)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid var(--border-color)",
    borderRadius: "16px",
    boxShadow: "var(--shadow-panel)",
    padding: "20px",
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: CALCULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  const renderCalculator = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "16px",
      }}
      className="md-two-col"
    >
      {/* Left panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Add Ingredients */}
        <div style={panelStyle}>
          <SectionHeader>Add Ingredients</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
              <select
                value={selectedIngId}
                onChange={(e) => setSelectedIngId(e.target.value)}
                style={{
                  minHeight: "44px",
                  padding: "10px 12px",
                  background: "rgba(255,252,248,0.8)",
                  border: "1.5px solid var(--border-color)",
                  borderRadius: "10px",
                  fontSize: "15px",
                  color: selectedIngId ? "var(--text-primary)" : "var(--text-muted)",
                  width: "100%",
                }}
              >
                <option value="">Select ingredient…</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit}) — {formatINR(ing.unit_cost)}/{ing.unit}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "flex-end" }}>
              <InputField
                label={
                  selectedIngId
                    ? `Quantity (${ingredients.find((i) => i.id === selectedIngId)?.unit ?? "unit"})`
                    : "Quantity"
                }
                type="number"
                value={selectedQty}
                onChange={setSelectedQty}
                placeholder="0"
                min={0}
                step={0.1}
              />
              <Btn onClick={handleAddIngredient} variant="primary" style={{ alignSelf: "flex-end" }}>
                <PlusIcon size={16} /> Add
              </Btn>
            </div>
          </div>

          {calcIngredients.length > 0 && (
            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {calcIngredients.map((ci, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: "rgba(225,29,72,0.04)",
                    border: "1px solid rgba(225,29,72,0.12)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ci.ingredient_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {ci.quantity_used} {ci.unit} — {formatINR(ci.line_cost)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCalcIngredient(idx)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", flexShrink: 0 }}
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {ingredients.length === 0 && (
            <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
              No ingredients yet. Add some in the Ingredients tab.
            </p>
          )}
        </div>

        {/* Labor */}
        <div style={panelStyle}>
          <SectionHeader>Labor</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <InputField label="Hours" type="number" value={laborHours} onChange={setLaborHours} placeholder="0" min={0} />
              <InputField label="Minutes" type="number" value={laborMinutes} onChange={setLaborMinutes} placeholder="0" min={0} max={59} />
            </div>
            <InputField label="Rate per hour (₹)" type="number" value={laborRate} onChange={setLaborRate} placeholder="50" min={0} suffix="₹/hr" />
            {laborCostPreview > 0 && (
              <div style={{ fontSize: "13px", color: "var(--accent-emerald)", fontWeight: 600 }}>
                Labor cost: {formatINR(laborCostPreview)}
              </div>
            )}
          </div>
        </div>

        {/* Extras */}
        <div style={panelStyle}>
          <SectionHeader>Extras (Packaging, Delivery, etc.)</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px auto", gap: "8px", alignItems: "flex-end" }}>
              <InputField label="Item name" type="text" value={extraName} onChange={setExtraName} placeholder="Box, ribbon…" />
              <InputField label="Cost (₹)" type="number" value={extraCost} onChange={setExtraCost} placeholder="0" min={0} />
              <Btn onClick={handleAddExtra} variant="primary" style={{ alignSelf: "flex-end" }}>
                <PlusIcon size={16} />
              </Btn>
            </div>
          </div>

          {extras.length > 0 && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {extras.map((ex, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "rgba(245,158,11,0.06)",
                    border: "1px solid rgba(245,158,11,0.15)",
                    borderRadius: "8px",
                    gap: "8px",
                  }}
                >
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: 500 }}>{ex.name}</span>
                  <span style={{ fontSize: "14px", color: "var(--accent-amber)", fontWeight: 600 }}>{formatINR(ex.cost)}</span>
                  <button onClick={() => removeExtra(idx)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}>
                    <XIcon size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profit Margin */}
        <div style={panelStyle}>
          <SectionHeader>Profit Margin</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <input
                type="range"
                min={0}
                max={80}
                value={profitMargin}
                onChange={(e) => { setProfitMargin(parseInt(e.target.value)); setCalcResult(null); }}
                style={{ flex: 1 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  type="number"
                  value={profitMargin}
                  min={0}
                  max={80}
                  onChange={(e) => { setProfitMargin(Math.min(80, Math.max(0, parseInt(e.target.value) || 0))); setCalcResult(null); }}
                  style={{
                    width: "60px",
                    minHeight: "44px",
                    padding: "8px",
                    textAlign: "center",
                    background: "rgba(255,252,248,0.8)",
                    border: "1.5px solid var(--border-color)",
                    borderRadius: "10px",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--accent-rose)",
                  }}
                />
                <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-rose)" }}>%</span>
              </div>
            </div>
          </div>
        </div>

        <Btn
          onClick={handleCalculate}
          variant="primary"
          size="lg"
          fullWidth
          disabled={calculating}
        >
          {calculating ? (
            <span className="animate-pulse-soft">Calculating…</span>
          ) : (
            <><CakeIcon size={20} /> Calculate Price</>
          )}
        </Btn>
      </div>

      {/* Right panel — Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ ...panelStyle, position: "sticky", top: "16px" }}>
          <SectionHeader>Cost Breakdown</SectionHeader>

          {!calcResult && !calculating && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
              <CakeIcon size={48} className="" />
              <p style={{ marginTop: "12px", fontSize: "14px" }}>
                Add ingredients and click<br />
                <strong style={{ color: "var(--accent-rose)" }}>Calculate Price</strong> to see results
              </p>
            </div>
          )}

          {calculating && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Skeleton height="20px" />
              <Skeleton height="20px" />
              <Skeleton height="20px" />
              <Skeleton height="20px" />
              <Skeleton height="2px" />
              <Skeleton height="28px" />
              <Skeleton height="32px" />
              <Skeleton height="48px" />
            </div>
          )}

          {calcResult && !calculating && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {/* Line items */}
              {[
                { label: "Ingredients", value: calcResult.ingredient_cost, color: "var(--text-primary)" },
                { label: "Labor", value: calcResult.labor_cost, color: "var(--text-primary)" },
                { label: "Extras", value: calcResult.extras_cost, color: "var(--text-primary)" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-color)" }}
                >
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: item.color }}>{formatINR(item.value)}</span>
                </div>
              ))}

              {/* Overhead */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Overheads</span>
                  <div style={{ position: "relative", display: "inline-block" }} title="Automatically calculated from your overhead settings">
                    <InfoIcon size={13} className="" />
                  </div>
                </div>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{formatINR(calcResult.overhead_cost)}</span>
              </div>

              {/* Total cost */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "2px solid var(--border-color)" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Total Cost</span>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{formatINR(calcResult.total_cost)}</span>
              </div>

              {/* Profit */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
                <span style={{ fontSize: "14px", color: "var(--accent-amber-dark)", fontWeight: 600 }}>Profit ({profitMargin}%)</span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-amber)" }}>+{formatINR(calcResult.profit_amount)}</span>
              </div>

              {/* Selling price */}
              <div
                style={{
                  margin: "16px 0 0",
                  padding: "18px",
                  background: "linear-gradient(135deg, rgba(225,29,72,0.08), rgba(225,29,72,0.04))",
                  border: "2px solid rgba(225,29,72,0.2)",
                  borderRadius: "12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-rose)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Suggested Selling Price
                </div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "var(--accent-rose)", lineHeight: 1.1 }}>
                  {formatINR(calcResult.selling_price)}
                </div>
              </div>

              {/* Insight */}
              {calcResult.overhead_cost > 0 && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "var(--accent-amber-dark)",
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                  }}
                >
                  <InfoIcon size={14} />
                  <span>
                    You might be underpricing by{" "}
                    <strong>{formatINR(calcResult.overhead_cost)}</strong> if you were ignoring overheads.
                  </span>
                </div>
              )}

              {/* Save as Recipe */}
              <Btn
                onClick={() => setShowSaveModal(true)}
                variant="secondary"
                fullWidth
                style={{ marginTop: "14px" }}
              >
                <BookmarkIcon size={16} /> Save as Recipe
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: INGREDIENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderIngredients = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Add Form */}
      <div style={panelStyle}>
        <SectionHeader>Add Ingredient</SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <InputField label="Name" value={ingForm.name} onChange={(v) => setIngForm((f) => ({ ...f, name: v }))} placeholder="e.g. All-purpose flour" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <InputField label="Purchase Cost (₹)" type="number" value={ingForm.cost} onChange={(v) => setIngForm((f) => ({ ...f, cost: v }))} placeholder="0" min={0} step={0.01} />
            <InputField label="Quantity" type="number" value={ingForm.quantity} onChange={(v) => setIngForm((f) => ({ ...f, quantity: v }))} placeholder="0" min={0} step={0.01} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Unit</label>
            <select
              value={ingForm.unit}
              onChange={(e) => setIngForm((f) => ({ ...f, unit: e.target.value }))}
              style={{ minHeight: "44px", padding: "10px 12px", background: "rgba(255,252,248,0.8)", border: "1.5px solid var(--border-color)", borderRadius: "10px", fontSize: "15px", color: "var(--text-primary)" }}
            >
              {["g", "kg", "ml", "l", "pieces", "tsp", "tbsp", "cup"].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {ingUnitCostPreview !== null && (
            <div style={{ fontSize: "13px", color: "var(--accent-emerald)", fontWeight: 600, padding: "8px 12px", background: "rgba(5,150,105,0.06)", borderRadius: "8px" }}>
              Unit cost: {formatINR(ingUnitCostPreview)} / {ingForm.unit || "unit"}
            </div>
          )}

          <Btn onClick={handleAddIngredientForm} variant="primary" fullWidth>
            <PlusIcon size={16} /> Add Ingredient
          </Btn>
        </div>
      </div>

      {/* List */}
      <div style={panelStyle}>
        <SectionHeader>Your Ingredients ({ingredients.length})</SectionHeader>

        {ingredientsLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height="60px" />)}
          </div>
        )}

        {!ingredientsLoading && ingredients.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "14px" }}>
            No ingredients yet. Add your first one above!
          </div>
        )}

        {!ingredientsLoading && ingredients.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ingredients.map((ing) => (
              <div key={ing.id}>
                {editingIng?.id === ing.id ? (
                  <div
                    style={{
                      padding: "14px",
                      background: "rgba(225,29,72,0.04)",
                      border: "1.5px solid rgba(225,29,72,0.2)",
                      borderRadius: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <InputField label="Name" value={editingIng.name} onChange={(v) => setEditingIng((e) => e ? { ...e, name: v } : e)} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <InputField label="Cost (₹)" type="number" value={editingIng.cost} onChange={(v) => setEditingIng((e) => e ? { ...e, cost: parseFloat(v) || 0 } : e)} />
                      <InputField label="Quantity" type="number" value={editingIng.quantity} onChange={(v) => setEditingIng((e) => e ? { ...e, quantity: parseFloat(v) || 0 } : e)} />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Btn onClick={handleEditIngredient} variant="primary" size="sm"><CheckIcon size={14} /> Save</Btn>
                      <Btn onClick={() => setEditingIng(null)} variant="secondary" size="sm"><XIcon size={14} /> Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      background: "rgba(255,252,248,0.6)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      transition: "box-shadow 0.15s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ing.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {formatINR(ing.unit_cost)}/{ing.unit} · {ing.quantity}{ing.unit} for {formatINR(ing.cost)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                      <button
                        onClick={() => setEditingIng(ing)}
                        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "6px 8px", cursor: "pointer", color: "var(--accent-amber-dark)", minHeight: "36px" }}
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                        style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.15)", borderRadius: "8px", padding: "6px 8px", cursor: "pointer", color: "var(--accent-rose)", minHeight: "36px" }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: OVERHEADS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderOverheads = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Overhead per cake summary */}
      <div
        style={{
          ...panelStyle,
          background: "linear-gradient(135deg, rgba(225,29,72,0.06), rgba(245,158,11,0.06))",
          border: "1.5px solid rgba(225,29,72,0.15)",
          textAlign: "center",
          padding: "24px 20px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Overhead per Cake
        </div>
        <div style={{ fontSize: "44px", fontWeight: 800, color: "var(--accent-rose)", lineHeight: 1.1, margin: "8px 0" }}>
          {formatINR(overheadPerCake)}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Based on {formatINR(totalMonthlyOverhead)}/month ÷ {settings.cakes_per_month} cakes
        </div>
      </div>

      {/* Monthly overheads */}
      <div style={panelStyle}>
        <SectionHeader>Monthly Overheads</SectionHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <InputField
            label="Electricity Bill (₹)"
            type="number"
            value={settings.electricity}
            onChange={(v) => setSettings((s) => ({ ...s, electricity: parseFloat(v) || 0 }))}
            placeholder="0"
            min={0}
            suffix="₹/mo"
          />
          <InputField
            label="Rent (₹, optional)"
            type="number"
            value={settings.rent}
            onChange={(v) => setSettings((s) => ({ ...s, rent: parseFloat(v) || 0 }))}
            placeholder="0"
            min={0}
            suffix="₹/mo"
          />
          <InputField
            label="Miscellaneous (₹)"
            type="number"
            value={settings.misc}
            onChange={(v) => setSettings((s) => ({ ...s, misc: parseFloat(v) || 0 }))}
            placeholder="0"
            min={0}
            suffix="₹/mo"
          />
          <InputField
            label="Cakes per Month"
            type="number"
            value={settings.cakes_per_month}
            onChange={(v) => setSettings((s) => ({ ...s, cakes_per_month: parseInt(v) || 1 }))}
            placeholder="10"
            min={1}
            suffix="cakes"
          />
          <Btn onClick={handleSaveSettings} variant="primary" fullWidth disabled={settingsSaving}>
            {settingsSaving ? <span className="animate-pulse-soft">Saving…</span> : <><CheckIcon size={16} /> Save Settings</>}
          </Btn>
        </div>
      </div>

      {/* Equipment */}
      <div style={panelStyle}>
        <SectionHeader>Equipment & Depreciation</SectionHeader>

        {/* Add equipment form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          <InputField label="Equipment Name" value={equipForm.name} onChange={(v) => setEquipForm((f) => ({ ...f, name: v }))} placeholder="e.g. Stand mixer" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <InputField label="Cost (₹)" type="number" value={equipForm.cost} onChange={(v) => setEquipForm((f) => ({ ...f, cost: v }))} placeholder="0" min={0} />
            <InputField label="Useful Life (months)" type="number" value={equipForm.useful_life_months} onChange={(v) => setEquipForm((f) => ({ ...f, useful_life_months: v }))} placeholder="36" min={1} />
          </div>
          {equipForm.cost && equipForm.useful_life_months && parseFloat(equipForm.useful_life_months) > 0 && (
            <div style={{ fontSize: "13px", color: "var(--accent-amber-dark)", fontWeight: 600, padding: "8px 12px", background: "rgba(245,158,11,0.06)", borderRadius: "8px" }}>
              Monthly depreciation: {formatINR(parseFloat(equipForm.cost) / parseFloat(equipForm.useful_life_months))}/month
            </div>
          )}
          <Btn onClick={handleAddEquipment} variant="amber" fullWidth>
            <PlusIcon size={16} /> Add Equipment
          </Btn>
        </div>

        {equipment.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
            No equipment added yet. Equipment costs are spread over their useful life.
          </div>
        )}

        {equipment.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {equipment.map((eq) => (
              <div
                key={eq.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  background: "rgba(245,158,11,0.04)",
                  border: "1px solid rgba(245,158,11,0.15)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eq.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {formatINR(eq.cost)} over {eq.useful_life_months} months · {formatINR(eq.monthly_cost)}/mo
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteEquipment(eq.id)}
                  style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.12)", borderRadius: "8px", padding: "6px 8px", cursor: "pointer", color: "var(--accent-rose)", minHeight: "36px" }}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            ))}

            <div style={{ paddingTop: "8px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 700 }}>
              <span>Total equipment/month</span>
              <span style={{ color: "var(--accent-amber)" }}>{formatINR(equipment.reduce((s, e) => s + e.monthly_cost, 0))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: RECIPES
  // ═══════════════════════════════════════════════════════════════════════════

  const renderRecipes = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
          Saved Recipes ({recipes.length})
        </h2>
        <Btn onClick={fetchRecipes} variant="ghost" size="sm">Refresh</Btn>
      </div>

      {recipesLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height="100px" />)}
        </div>
      )}

      {!recipesLoading && recipes.length === 0 && (
        <div
          style={{
            ...panelStyle,
            textAlign: "center",
            padding: "40px 24px",
            color: "var(--text-muted)",
          }}
        >
          <BookmarkIcon size={48} />
          <p style={{ marginTop: "14px", fontSize: "15px", lineHeight: 1.5 }}>
            No saved recipes yet.<br />
            <span style={{ color: "var(--text-secondary)" }}>
              Calculate a cake price and save it as a recipe!
            </span>
          </p>
          <Btn onClick={() => setTab("calculator")} variant="primary" style={{ marginTop: "16px" }}>
            <CakeIcon size={18} /> Go to Calculator
          </Btn>
        </div>
      )}

      {!recipesLoading && recipes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              style={{
                ...panelStyle,
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {recipe.name}
                  </h3>
                  {recipe.description && (
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {recipe.description}
                    </p>
                  )}
                  <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(recipe.ingredients || []).slice(0, 3).map((ci, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          background: "rgba(225,29,72,0.08)",
                          color: "var(--accent-rose)",
                          borderRadius: "20px",
                          border: "1px solid rgba(225,29,72,0.12)",
                        }}
                      >
                        {ci.ingredient_name}
                      </span>
                    ))}
                    {(recipe.ingredients || []).length > 3 && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", padding: "2px 4px" }}>
                        +{recipe.ingredients.length - 3} more
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        background: "rgba(245,158,11,0.1)",
                        color: "var(--accent-amber-dark)",
                        borderRadius: "20px",
                        border: "1px solid rgba(245,158,11,0.15)",
                      }}
                    >
                      {recipe.profit_margin ?? 30}% margin
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <Btn onClick={() => handleLoadRecipe(recipe)} variant="primary" size="sm" style={{ flex: 1 }}>
                  <LoadIcon size={14} /> Load Recipe
                </Btn>
                <button
                  onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                  style={{ background: "rgba(225,29,72,0.08)", border: "1px solid rgba(225,29,72,0.15)", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", color: "var(--accent-rose)", minHeight: "36px", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600 }}
                >
                  <TrashIcon size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Save Recipe Modal ────────────────────────────────────────────────────

  const renderSaveModal = () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,25,23,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}
    >
      <div
        className="animate-slide-up"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          padding: "24px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "var(--text-primary)" }}>
          Save as Recipe
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <InputField label="Recipe Name" value={recipeName} onChange={setRecipeName} placeholder="e.g. Chocolate Fudge Cake" required />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Description (optional)</label>
            <textarea
              value={recipeDesc}
              onChange={(e) => setRecipeDesc(e.target.value)}
              placeholder="Any notes about this cake…"
              rows={3}
              style={{
                padding: "10px 12px",
                background: "rgba(255,252,248,0.8)",
                border: "1.5px solid var(--border-color)",
                borderRadius: "10px",
                fontSize: "15px",
                color: "var(--text-primary)",
                resize: "vertical",
                minHeight: "80px",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <Btn onClick={() => setShowSaveModal(false)} variant="secondary" fullWidth>Cancel</Btn>
            <Btn onClick={handleSaveRecipe} variant="primary" fullWidth><BookmarkIcon size={16} /> Save</Btn>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Tab config ───────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "calculator",  label: "Calculator",  icon: <CakeIcon size={22} /> },
    { id: "ingredients", label: "Ingredients", icon: <ListIcon size={22} /> },
    { id: "overheads",   label: "Overheads",   icon: <SettingsIcon size={22} /> },
    { id: "recipes",     label: "Recipes",     icon: <BookmarkIcon size={22} /> },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {showSaveModal && renderSaveModal()}

      <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <header
          style={{
            background: "var(--panel-bg)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border-color)",
            padding: "0 16px",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #e11d48, #f59e0b)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CakeIcon size={20} className="" />
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>HomeBaker</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.1 }}>Cake Pricing</div>
              </div>
            </div>

            {/* Desktop tab nav */}
            <nav style={{ display: "none" }} className="desktop-nav">
              <div style={{ display: "flex", gap: "4px" }}>
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: tab === t.id ? "rgba(225,29,72,0.1)" : "transparent",
                      color: tab === t.id ? "var(--accent-rose)" : "var(--text-secondary)",
                      fontWeight: tab === t.id ? 700 : 500,
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      minHeight: "40px",
                    }}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: "16px", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
          <div className="animate-fade-in" key={tab}>
            {tab === "calculator"  && renderCalculator()}
            {tab === "ingredients" && renderIngredients()}
            {tab === "overheads"   && renderOverheads()}
            {tab === "recipes"     && renderRecipes()}
          </div>
        </main>

        {/* Bottom spacer for mobile nav */}
        <div className="bottom-nav-spacer" />
      </div>

      {/* Mobile bottom navigation */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--panel-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid var(--border-color)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 200,
          display: "flex",
        }}
        className="mobile-bottom-nav"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              padding: "10px 4px",
              border: "none",
              background: "transparent",
              color: tab === t.id ? "var(--accent-rose)" : "var(--text-muted)",
              cursor: "pointer",
              transition: "color 0.15s",
              minHeight: "56px",
              position: "relative",
            }}
          >
            {tab === t.id && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "32px",
                  height: "3px",
                  background: "var(--accent-rose)",
                  borderRadius: "0 0 4px 4px",
                }}
              />
            )}
            {t.icon}
            <span style={{ fontSize: "10px", fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Responsive styles via style tag */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-bottom-nav { display: none !important; }
          .md-two-col { grid-template-columns: 1fr 1fr !important; }
          .bottom-nav-spacer { display: none !important; }
          main { padding: 24px 16px !important; }
        }
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
