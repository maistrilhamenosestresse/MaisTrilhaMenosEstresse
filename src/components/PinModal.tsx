"use client";

import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionName?: string;
}

export function PinModal({ isOpen, onClose, onSuccess, actionName }: PinModalProps) {
  if (!isOpen) return null;

  const confirmAction = () => {
    onSuccess();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.94, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 16 }}
          className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        >
          <div className="p-8 text-center">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-2 bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Confirmar ação administrativa</h2>
            <p className="text-sm text-gray-500 mb-7">
              Você está prestes a executar: <strong>{actionName || "esta ação"}</strong>. Confirme para continuar com sua sessão administrativa validada.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">
                Cancelar
              </button>
              <button onClick={confirmAction} className="py-3 rounded-xl bg-[#F17B37] text-white font-bold hover:bg-[#df6d2f] flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Confirmar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
