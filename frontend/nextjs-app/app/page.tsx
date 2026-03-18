import BakerDashboard from "./ui/baker-dashboard";

type Ingredient = {
  id: string;
  name: string;
  cost: number;
  quantity: number;
  unit: string;
  unit_cost: number;
};

type ProductionSettings = {
  cakes_per_month: number;
  electricity: number;
  rent: number;
  misc: number;
};

async function fetchInitialData(): Promise<{
  ingredients: Ingredient[];
  settings: ProductionSettings | null;
}> {
  const baseUrl = process.env.BAKER_SERVICE_URL || "http://localhost:4001";

  try {
    const [ingredientsRes, settingsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/ingredients`, {
        next: { revalidate: 60 },
        headers: { "Content-Type": "application/json" },
      }),
      fetch(`${baseUrl}/settings`, {
        next: { revalidate: 60 },
        headers: { "Content-Type": "application/json" },
      }),
    ]);

    const ingredients: Ingredient[] =
      ingredientsRes.status === "fulfilled" && ingredientsRes.value.ok
        ? await ingredientsRes.value.json()
        : [];

    const settings: ProductionSettings | null =
      settingsRes.status === "fulfilled" && settingsRes.value.ok
        ? await settingsRes.value.json()
        : null;

    return { ingredients, settings };
  } catch {
    return { ingredients: [], settings: null };
  }
}

export default async function HomePage() {
  const { ingredients, settings } = await fetchInitialData();

  return (
    <main className="min-h-screen">
      <BakerDashboard
        initialIngredients={ingredients}
        initialSettings={settings}
      />
    </main>
  );
}
