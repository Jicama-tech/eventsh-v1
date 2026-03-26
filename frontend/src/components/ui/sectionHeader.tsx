import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  light?: boolean;
}

const SectionHeader = ({
  title,
  subtitle,
  className,
  light = false,
}: SectionHeaderProps) => {
  return (
    <div className={cn("text-center mb-12", className)}>
      <h2
        className={cn(
          "text-3xl md:text-4xl font-bold mb-4",
          light ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "text-lg max-w-2xl mx-auto",
            light ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeader;
