import JSZip from 'jszip'
import type { CodeFile, Project } from '@/types/project'
import { createPortableProject } from '@/services/projects/portableProject'
import { getEsp32Profile } from '@/services/esp32/esp32Config'

export async function exportZip(projectName: string, files: CodeFile[], target?: string, project?: Project): Promise<void> {
  const zip = new JSZip()
  const folder = zip.folder(projectName)!
  for (const file of files) {
    folder.file(file.path, file.content)
  }
  if (project) {
    const profile = project.esp32 ? getEsp32Profile(project.esp32.boardId) : undefined
    folder.file('metacore/project.json', JSON.stringify(createPortableProject(project), null, 2))
    folder.file('metacore/README.md', `# ${project.name}\n\n目标芯片：${project.target}\n${profile ? `开发板：${profile.label}\n模组：${profile.module}\nPlatformIO board：${profile.platformioId}\nESP-IDF target：${profile.idfTarget}\nFlash：${profile.flashSize} ${profile.flashMode.toUpperCase()}\nPSRAM：${profile.psramSize}\n` : ''}工程格式：${project.format}\n\n${project.scheme?.description ?? '尚未生成硬件方案'}\n`)
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
