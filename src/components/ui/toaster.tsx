"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Kind = "success" | "error" | "info";
interface Toast { id: string; kind: Kind; message: string; }
interface Ctx { toast: (kind: Kind, message: string) => void; }
const ToastCtx = createContext<Ctx>({ toast: () => {} });

const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = (id: string) => setItems((p) => p.filter((t) => t.id !== id));

  const toast = useCallback((kind: Kind, message: string) => {
    const id = crypto.randomUUID();
    setItems((p) => [...p, { id, kind, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:left-6 md:bottom-6 z-[100] flex flex-col gap-2 md:w-96">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card animate-fade-in",
                t.kind === "success" && "border-success/30",
                t.kind === "error" && "border-danger/30"
              )}
            >
              <I className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                t.kind === "success" && "text-success",
                t.kind === "error" && "text-danger",
                t.kind === "info" && "text-brand"
              )} />
              <p className="text-sm flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
