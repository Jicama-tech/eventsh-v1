import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Gift, Rocket } from "lucide-react";

interface PricingCardProps {
  plan: "free" | "pro";
  title: string;
  subtitle: string;
  features: string[];
  highlighted?: boolean;
}

const PricingCard = ({
  plan,
  title,
  subtitle,
  features,
  highlighted = false,
}: PricingCardProps) => {
  const Icon = plan === "free" ? Gift : Rocket;

  return (
    <div
      className={cn(
        "rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2",
        highlighted
          ? "gradient-primary text-primary-foreground shadow-glow"
          : "bg-card shadow-card border border-border"
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon
          className={cn(
            "w-8 h-8",
            highlighted ? "text-primary-foreground" : "text-primary"
          )}
        />
        <h3 className="font-bold text-2xl">{title}</h3>
      </div>
      <p
        className={cn(
          "mb-6",
          highlighted ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {subtitle}
      </p>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3">
            <Check
              className={cn(
                "w-5 h-5 flex-shrink-0",
                highlighted ? "text-primary-foreground" : "text-primary"
              )}
            />
            <span
              className={cn(
                "text-sm",
                highlighted ? "text-primary-foreground/90" : "text-foreground"
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Button
        variant={highlighted ? "heroOutline" : "hero"}
        size="lg"
        className="w-full"
      >
        {plan === "free" ? "Start Free" : "Upgrade Now"}
      </Button>
    </div>
  );
};

export default PricingCard;
