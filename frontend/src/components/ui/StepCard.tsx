import { cn } from "@/lib/utils";

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  className?: string;
}

const StepCard = ({ number, title, description, className }: StepCardProps) => {
  return (
    <div className={cn("flex items-start gap-4", className)}>
      <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center flex-shrink-0 shadow-card">
        <span className="text-primary-foreground font-bold text-lg">
          {number}
        </span>
      </div>
      <div className="bg-card p-5 rounded-xl shadow-card flex-1 hover:shadow-hover transition-all duration-300">
        <h4 className="font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
};

export default StepCard;
