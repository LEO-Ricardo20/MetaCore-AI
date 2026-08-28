/** 自定义芯片状态管理 — 存储用户添加的芯片规格，与预置芯片合并使用 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChipSpec } from '@/types/hardware'
import { getLocalChipNames, getLocalChipSpec } from '@/knowledge/localKnowledge'

interface ChipStoreState {
  /** 用户自定义的芯片列表 */
  customChips: ChipSpec[]

  /** 添加自定义芯片 */
  addChip: (chip: ChipSpec) => void
  /** 更新自定义芯片 */
  updateChip: (name: string, chip: ChipSpec) => void
  /** 删除自定义芯片 */
  removeChip: (name: string) => void

  /** 获取芯片规格（优先自定义，其次预置） */
  getSpec: (name: string) => ChipSpec | null
  /** 获取所有芯片名称列表（预置 + 自定义） */
  getAllChipNames: () => string[]
}

export const useChipStore = create<ChipStoreState>()(
  persist(
    (set, get) => ({
      customChips: [],

      addChip: (chip) =>
        set((s) => ({
          customChips: [...s.customChips, chip],
        })),

      updateChip: (name, chip) =>
        set((s) => ({
          customChips: s.customChips.map((c) => (c.name === name ? chip : c)),
        })),

      removeChip: (name) =>
        set((s) => ({
          customChips: s.customChips.filter((c) => c.name !== name),
        })),

      getSpec: (name) => {
        // 优先查自定义芯片
        const custom = get().customChips.find((c) => c.name === name)
        if (custom) return custom
        // 再查预置芯片
        return getLocalChipSpec(name)
      },

      getAllChipNames: () => {
        const presetNames = getLocalChipNames()
        const customNames = get().customChips.map((c) => c.name)
        return [...presetNames, ...customNames]
      },
    }),
    { name: 'metacore-chips' }
  )
)
