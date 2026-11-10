import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

type Kind = 'success' | 'error';
interface Toast { id: number; message: string; kind: Kind }
const Ctx = createContext<{ toast: (message: string, kind?: Kind) => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const toast = useCallback((message: string, kind: Kind = 'success') => {
    const id = ++seq.current;
    setItems((s) => [...s.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
              className={`pointer-events-auto flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lift ${t.kind === 'error' ? 'bg-red-600' : 'bg-choco'}`}>
              {t.kind === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} className="text-primary-light" />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
