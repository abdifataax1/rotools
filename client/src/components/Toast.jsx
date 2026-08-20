import React, { createContext, useContext, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (message, tone = 'success') => {
    const id = crypto.randomUUID();
    setToasts((old) => [...old, { id, message, tone }]);
    setTimeout(() => setToasts((old) => old.filter((toast) => toast.id !== id)), 3600);
  };
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="glass flex items-center gap-3 rounded-lg p-3 text-sm">
            <CheckCircle2 className={toast.tone === 'error' ? 'text-rose' : 'text-mint'} size={18} />
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToasts((old) => old.filter((item) => item.id !== toast.id))}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
