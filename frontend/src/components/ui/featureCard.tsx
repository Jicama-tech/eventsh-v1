import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  iconClassName?: string;
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
}: FeatureCardProps) => {
  return (
    <div
      className={cn(
        "bg-card p-6 rounded-2xl shadow-card hover:shadow-hover transition-all duration-300 hover:-translate-y-1 group",
        className
      )}
    >
      <div
        className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110",
          "gradient-primary",
          iconClassName
        )}
      >
        <Icon className="w-7 h-7 text-primary-foreground" />
      </div>
      <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
};

export default FeatureCard;
