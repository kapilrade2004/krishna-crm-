'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DateTimeStoreState {
  isCustom: boolean;
  customDate: string; // 'YYYY-MM-DD'
  customTime: string; // 'HH:mm' or 'HH:mm:ss'
  setCustomDateTime: (date: string, time: string) => void;
  resetToLive: () => void;
}

export const useDateTimeStore = create<DateTimeStoreState>()(
  persist(
    (set) => ({
      isCustom: false,
      customDate: '',
      customTime: '',
      setCustomDateTime: (date: string, time: string) =>
        set({ isCustom: true, customDate: date, customTime: time }),
      resetToLive: () =>
        set({ isCustom: false, customDate: '', customTime: '' }),
    }),
    {
      name: 'krishna-crm-datetime-override',
    }
  )
);
