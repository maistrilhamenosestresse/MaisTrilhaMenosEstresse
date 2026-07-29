"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionName?: string;
}

export function PinModal({
  isOpen,
  onClose,
  onSuccess,
  actionName,
}: PinModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setShowPassword(false);
      setError("");
      setIsVerifying(false);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || isVerifying) return;
    setError("");
    setIsVerifying(true);

    try {
      const response = await fetch("/api/admin/security/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Muitas tentativas. Aguarde 15 minutos."
            : result.error || "Não foi possível validar a credencial.",
        );
        return;
      }
      setPassword("");
      onSuccess();
      onClose();
    } catch {
      setError("Falha de conexão ao validar a credencial.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.94, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 16 }}
          className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          <form className="relative p-8 text-center" onSubmit={confirmAction}>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-400 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-xl font-black text-gray-900">
              Validar ação administrativa
            </h2>
            <p className="mb-7 text-sm text-gray-500">
              Você está prestes a executar:{" "}
              <strong>{actionName || "esta ação"}</strong>. Informe a senha
              geral do sistema para continuar.
            </p>
            <label className="mb-5 block text-left">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-500">
                Senha administrativa
              </span>
              <span className="relative block">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value.slice(0, 128));
                    setError("");
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-base font-bold tracking-[0.2em] text-gray-900 outline-none transition focus:border-[#F17B37] focus:ring-4 focus:ring-[#F17B37]/10"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "admin-password-error" : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-gray-700"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword
                    ? <EyeOff className="h-5 w-5" />
                    : <Eye className="h-5 w-5" />}
                </button>
              </span>
              {error && (
                <span
                  id="admin-password-error"
                  role="alert"
                  className="mt-2 block text-sm font-bold text-red-600"
                >
                  {error}
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isVerifying}
                className="rounded-xl bg-gray-100 py-3 font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isVerifying || !password}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#F17B37] py-3 font-bold text-white hover:bg-[#df6d2f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {isVerifying ? "Validando..." : "Desbloquear"}
              </button>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
              A senha é validada no servidor e não fica salva no navegador.
            </p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
