import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Dependent {
  name: string;
  cpf: string;
  phone?: string;
}

export interface CartItem {
  agendaId: string;
  title: string;
  price: number;
  date: string;
  quantity: number;
  dependents: Dependent[];
  availableSpots: number;
  acceptedPaymentMethods?: string[];
  taxa_gratis?: boolean;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (agendaId: string) => void;
  updateQuantity: (agendaId: string, quantity: number) => void;
  updateDependent: (agendaId: string, dependentIndex: number, field: 'name' | 'cpf' | 'phone', value: string) => void;
  clearCart: () => void;
  getTotalQuantity: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        set((state) => {
          const existingItem = state.items.find((i) => i.agendaId === item.agendaId);
          if (existingItem) {
            const newQuantity = Math.min(existingItem.quantity + item.quantity, existingItem.availableSpots);
            // Pad dependents array with empty objects if quantity increases
            const currentDependents = [...(existingItem.dependents || [])];
            while (currentDependents.length < newQuantity - 1) {
              currentDependents.push({ name: '', cpf: '', phone: '' });
            }
            return {
              items: state.items.map((i) =>
                i.agendaId === item.agendaId
                  ? { ...i, quantity: newQuantity, dependents: currentDependents }
                  : i
              ),
            };
          }
          
          // Ensure new item has correct number of dependents
          const initialDependents = item.dependents || [];
          while (initialDependents.length < item.quantity - 1) {
            initialDependents.push({ name: '', cpf: '', phone: '' });
          }
          
          return { items: [...state.items, { ...item, dependents: initialDependents }] };
        });
      },
      removeItem: (agendaId) => {
        set((state) => ({
          items: state.items.filter((i) => i.agendaId !== agendaId),
        }));
      },
      updateQuantity: (agendaId, requestedQuantity) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (i.agendaId === agendaId) {
              const quantity = Math.min(requestedQuantity, i.availableSpots);
              const currentDependents = [...(i.dependents || [])];
              // Adjust dependents array to match new quantity
              if (quantity > i.quantity) {
                while (currentDependents.length < quantity - 1) {
                  currentDependents.push({ name: '', cpf: '', phone: '' });
                }
              } else if (quantity < i.quantity) {
                currentDependents.splice(Math.max(0, quantity - 1));
              }
              return { ...i, quantity, dependents: currentDependents };
            }
            return i;
          }),
        }));
      },
      updateDependent: (agendaId, dependentIndex, field, value) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (i.agendaId === agendaId) {
              const updatedDependents = [...(i.dependents || [])];
              if (updatedDependents[dependentIndex]) {
                updatedDependents[dependentIndex] = {
                  ...updatedDependents[dependentIndex],
                  [field]: value
                };
              }
              return { ...i, dependents: updatedDependents };
            }
            return i;
          }),
        }));
      },
      clearCart: () => set({ items: [] }),
      getTotalQuantity: () => get().items.reduce((total, item) => total + item.quantity, 0),
      getTotalPrice: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    }),
    {
      name: 'carrinho-storage',
    }
  )
);
