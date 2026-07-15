import { create } from 'zustand';

const TOAST_DURATION_MS = 2600;

type ToastState = {
  message: string | null;
  token: number;
  show: (message: string) => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set, get) => ({
  message: null,
  token: 0,
  show: (message) => {
    clearTimeout(timer);
    const token = get().token + 1;
    set({ message, token });
    timer = setTimeout(() => {
      if (get().token === token) set({ message: null });
    }, TOAST_DURATION_MS);
  },
}));

export function showToast(message: string) {
  useToastStore.getState().show(message);
}
