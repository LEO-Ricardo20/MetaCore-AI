import JSZip from 'jszip'
import type { CodeFile } from '@/types/project'

export async function exportZip(projectName: string, files: CodeFile[], target?: string): Promise<void> {
  const zip = new JSZip()
  const folder = zip.folder(projectName)!
  for (const file of files) {
    folder.file(file.path, file.content)
  }
  
  // 当目标芯片是STM32F103时，包含模板文件
  if (target === 'STM32F103') {
    try {
      // 读取STM32F103C8T6_HAL_template.zip文件
      const response = await fetch(`${import.meta.env.BASE_URL}STM32F103C8T6_HAL_template.zip`)
      if (response.ok) {
        const templateBlob = await response.blob()
        // 将模板文件添加到zip中
        folder.file('STM32F103C8T6_HAL_template.zip', templateBlob)
      } else {
        throw new Error(`STM32 模板下载失败 (${response.status})`)
      }
    } catch (error) {
      throw new Error(`无法附加 STM32 工程模板：${error instanceof Error ? error.message : '未知错误'}`, { cause: error })
    }
  }
  
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
