import { useEffect, useState } from "react";
import { Award, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MembershipPurchaseDialog } from "./MembershipPurchaseDialog";

interface MembershipPlan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  perks: string[];
  color: string;
}

interface Props {
  slug: string;
  organizerId: string;
  // Design hook so we match the storefront's primary color for the section
  // heading and CTAs.
  primaryColor?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  GBP: "£",
  EUR: "€",
  SGD: "SG$",
  AED: "AED ",
  AUD: "A$",
};

function durationLabel(days: number): string {
  if (days % 365 === 0) {
    const y = days / 365;
    return `${y} ${y === 1 ? "year" : "years"}`;
  }
  if (days % 30 === 0) {
    const m = days / 30;
    return `${m} ${m === 1 ? "month" : "months"}`;
  }
  return `${days} days`;
}

export function StorefrontMembershipSection({
  slug,
  organizerId,
  primaryColor = "#6366f1",
}: Props) {
  const apiURL = __API_URL__;
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiURL}/storefront/${encodeURIComponent(slug)}/membership-plans`,
        );
        if (!res.ok) {
          if (!cancelled) setPlans([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPlans([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiURL, slug]);

  // Section hides entirely if the organizer has no published plans, so the
  // storefront stays clean before any tier exists.
  if (!plans || plans.length === 0) return null;

  return (
    <section id="memberships" className="py-10 sm:py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-12 flex items-end gap-4">
          <div>
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
              style={{ color: primaryColor }}
            >
              For exhibitors
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold flex items-center gap-2">
              <Award className="h-7 w-7" style={{ color: primaryColor }} />
              Memberships
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Become a member and unlock priority access, discounted booth
              pricing, and more.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {plans.map((plan) => {
            const symbol = CURRENCY_SYMBOLS[plan.currency] || plan.currency;
            return (
              <div
                key={plan._id}
                className="relative rounded-2xl border-2 bg-white p-6 shadow-sm hover:shadow-lg transition flex flex-col"
                style={{ borderColor: plan.color + "55" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: plan.color }}
                  />
                  <h3
                    className="text-xl font-bold"
                    style={{ color: plan.color }}
                  >
                    {plan.name}
                  </h3>
                </div>
                {plan.description && (
                  <p className="text-sm text-slate-600 mb-3">
                    {plan.description}
                  </p>
                )}
                <div className="mb-4">
                  <div className="text-3xl font-extrabold">
                    {symbol}
                    {plan.price.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    for {durationLabel(plan.durationDays)}
                  </div>
                </div>
                {plan.perks.length > 0 && (
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {plan.perks.map((perk, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <Check
                          className="h-4 w-4 mt-0.5 shrink-0"
                          style={{ color: plan.color }}
                        />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  onClick={() => setSelectedPlan(plan)}
                  className="w-full mt-auto"
                  style={{ backgroundColor: plan.color }}
                >
                  Become a {plan.name} member
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {selectedPlan && (
        <MembershipPurchaseDialog
          open={!!selectedPlan}
          onOpenChange={(o) => !o && setSelectedPlan(null)}
          plan={selectedPlan}
          slug={slug}
          organizerId={organizerId}
        />
      )}
    </section>
  );
}
