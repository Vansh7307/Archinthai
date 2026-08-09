import React, { createContext, useCallback, useContext, useState, useRef } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, type, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const toast = {
    success: (msg) => push("success", msg),
    error: (msg) => push("error", msg),
    info: (msg) => push("info", msg)
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />,
    error: <XCircle className="h-5 w-5 shrink-0 text-rose-400" />,
    info: <Info className="h-5 w-5 shrink-0 text-sky-400" />
  };

  const styles = {
    success: "border-emerald-400/30 bg-emerald-950/90",
    error: "border-rose-400/30 bg-rose-950/90",
    info: "border-sky-400/30 bg-sky-950/90"
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-3"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex animate-scale-in items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium text-white shadow-card backdrop-blur ${styles[t.type]}`}
            role="status"
          >
            {icons[t.type]}
            <span className="flex-1">{t.message}</span>
            <button
              className="rounded p-0.5 text-white/60 transition hover:text-white"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
