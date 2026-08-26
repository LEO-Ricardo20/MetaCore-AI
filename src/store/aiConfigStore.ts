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
  /**
   * Select the safest configured service for long, contract-based generation.
   * Ordinary chat keeps using getActive(); structured generation should not
   * inherit an unverified relay just because it is selected for chat.
   */
  getStructuredGenerationService: () => AIServiceConfig | null
}

function hasUsableCredential(service: AIServiceConfig) {
  return service.enabled
    && (service.provider === 'ollama' || service.provider === 'mock' || Boolean(service.apiKey.trim()))
}

function structuredServiceRank(service: AIServiceConfig) {
  if (service.provider === 'deepseek') {
    // deepseek-chat is the stable structured-task route. V4 Flash is also
    // supported because the server maps it to deepseek-chat for contracts.
    return /deepseek-chat/i.test(service.model) ? 0 : 1
  }
  if (service.provider === 'siliconflow' && /deepseek/i.test(service.model)) {
    // Prefer the verified V4 Flash route when it is present, then any other
    // DeepSeek model returned by SiliconFlow.
    return /v4[-_ ]?flash/i.test(service.model) ? 2 : 3
  }
  return 10
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
      },

      getStructuredGenerationService: () => {
        const { services } = get()
        const candidates = services
          .filter(hasUsableCredential)
          .filter((service) => service.provider === 'deepseek' || (service.provider === 'siliconflow' && /deepseek/i.test(service.model)))
          .sort((left, right) => structuredServiceRank(left) - structuredServiceRank(right))
        return candidates[0] ?? get().getActive()
      },
    }),
    // Keep the pre-Studio key so existing provider settings survive the product rename.
    { name: 'metacore-ai-config' }
  )
)
