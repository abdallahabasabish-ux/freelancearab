import { Label } from "./label";
import { cn } from "@/lib/utils/cn";

export function FormField({
  label, error, hint, children, className,
}: {
  label: string; error?: string; hint?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
