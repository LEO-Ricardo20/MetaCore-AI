/** 全局设置 store — 持久化用户偏好 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  /** 一键式生成：开启后点「生成方案」自动串行完成 方案→代码→流程图 */
  autoPipeline: boolean
  setAutoPipeline: (val: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoPipeline: false,
      setAutoPipeline: (val) => set({ autoPipeline: val }),
    }),
    { name: 'metacore-settings' }
  )
)
