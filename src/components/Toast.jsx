import { useState, useRef, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Monotonic id: Date.now() collides when two toasts fire in the same ms,
  // producing duplicate keys and dismissing both on the first timer.
  const seq = useRef(0);

  const showToast = useCallback((message, duration = 2500) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[600] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          // Wraps rather than nowrap: a long message used to run off the side of
          // a 375px screen with no way to read it. Short toasts still sit on one
          // line, so the pill shape is unchanged.
          <div
            key={t.id}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-3xl text-sm font-bold font-body text-center text-balance max-w-[min(90vw,26rem)] animate-[fadeIn_0.25s_ease]"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
