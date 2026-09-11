"use client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleButton({
  onClick, loading, label,
}: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={onClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.77 3.3 14.6 2.4 12 2.4 6.98 2.4 2.9 6.48 2.9 11.5S6.98 20.6 12 20.6c6.93 0 9.4-4.87 9.4-9.32 0-.63-.07-1.1-.15-1.57H12z" />
        </svg>
      )}
      {label}
    </Button>
  );
}
