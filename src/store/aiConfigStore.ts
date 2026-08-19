import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIServiceConfig } from '@/types/ai'
import { DEFAULT_SERVICES } from '@/types/ai'

interface AIConfigState {
  services: AIServiceConfig[]
  activeServiceId: string | null
  addService: (svc: Omit<AIServiceConfig, 'id'>) => void
  updateService: (id: string, svc: Partial<AIServiceConfig>) => void
  removeService: (id: string) => void
  setActive: (id: string | null) => void
  getActive: () => AIServiceConfig | null
}

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      services: DEFAULT_SERVICES.map((s, i) => ({ ...s, id: `default-${i}`, apiKey: '' })),
      activeServiceId: null,

      addService: (svc) =>
        set((s) => ({
          services: [...s.services, { ...svc, id: Date.now().toString() }]
        })),

      updateService: (id, svc) =>
        set((s) => ({
          services: s.services.map((x) => (x.id === id ? { ...x, ...svc } : x))
        })),

      removeService: (id) =>
        set((s) => ({
          services: s.services.filter((x) => x.id !== id),
          activeServiceId: s.activeServiceId === id ? null : s.activeServiceId
        })),

      setActive: (id) => set({ activeServiceId: id }),

      getActive: () => {
        const { services, activeServiceId } = get()
        return services.find((s) => (
          s.id === activeServiceId
          && s.enabled
          && (s.provider === 'ollama' || s.provider === 'mock' || Boolean(s.apiKey.trim()))
        )) ?? null
      }
    }),
    // Keep the pre-Studio key so existing provider settings survive the product rename.
    { name: 'metacore-ai-config' }
  )
)
