"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, X, ShieldCheck, AlertCircle } from "lucide-react";

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionName?: string;
}

export function PinModal({ isOpen, onClose, onSuccess, actionName }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  
  // A senha "hardcoded" temporária no env ou banco. 
  // Por enquanto, o sistema lerá do env NEXT_PUBLIC_ADMIN_PIN ou usará '1234' como fallback
  // caso o cliente não tenha rodado o SQL ainda. O ideal é o cliente ter a tabela.
  const CORRECT_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1234";

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(false);
    }
  }, [isOpen]);

  const handleInput = (val: string) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const verifyPin = (currentPin: string) => {
    if (currentPin === CORRECT_PIN) {
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 300);
    } else {
      setError(true);
      setTimeout(() => {
        setPin("");
      }, 500);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-2 bg-gray-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 text-center flex flex-col items-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${error ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-[#F17B37]'}`}>
              {error ? <AlertCircle className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
            </div>
            
            <h2 className="text-xl font-black text-gray-900 mb-1">Cadeado de Segurança</h2>
            <p className="text-sm text-gray-500 mb-6 h-10">
              {error ? <span className="text-red-500 font-bold">PIN Incorreto. Tente novamente.</span> : `Digite sua senha de 4 dígitos para: ${actionName || 'Continuar'}`}
            </p>

            {/* Display de Bolinhas */}
            <div className="flex gap-4 mb-8">
              {[0, 1, 2, 3].map((index) => (
                <div 
                  key={index} 
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    pin.length > index 
                      ? (error ? 'bg-red-500 scale-110' : 'bg-[#F17B37] scale-110') 
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {/* Teclado Numérico */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleInput(num.toString())}
                  className="bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-900 font-bold text-2xl py-4 rounded-xl transition"
                >
                  {num}
                </button>
              ))}
              <div /> {/* Espaço vazio */}
              <button
                onClick={() => handleInput("0")}
                className="bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-900 font-bold text-2xl py-4 rounded-xl transition"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="bg-gray-50 hover:bg-red-50 active:bg-red-100 text-red-500 font-bold text-lg py-4 rounded-xl transition flex items-center justify-center"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
