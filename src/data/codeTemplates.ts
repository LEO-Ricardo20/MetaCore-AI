/** 各框架代码骨架和最佳实践 — 为 AI 代码生成提供规范参考 */

import type { ProjectFormat } from '@/types/hardware'

/** 代码模板定义 */
export interface CodeTemplate {
  /** 框架描述 */
  description: string
  /** 文件骨架 */
  skeleton: { path: string; template: string }[]
  /** 最佳实践列表 */
  bestPractices: string[]
}

export const CODE_TEMPLATES: Record<ProjectFormat, CodeTemplate> = {
  espidf: {
    description: 'ESP-IDF v5.x CMake 工程',
    skeleton: [
      { path: 'CMakeLists.txt', template: `cmake_minimum_required(VERSION 3.16)\ninclude($ENV{IDF_PATH}/tools/cmake/project.cmake)\nproject(my_project)` },
      { path: 'main/CMakeLists.txt', template: `idf_component_register(\n    SRCS "main.c"\n    INCLUDE_DIRS "."\n)` },
      { path: 'main/main.c', template: `#include <stdio.h>\n#include "freertos/FreeRTOS.h"\n#include "freertos/task.h"\n#include "esp_log.h"\n\nstatic const char *TAG = "main";\n\nvoid app_main(void) {\n    ESP_LOGI(TAG, "系统启动");\n}` },
    ],
    bestPractices: [
      '使用 ESP_LOGI/ESP_LOGE/ESP_LOGW 进行日志输出，不使用 printf',
      '每个外设驱动封装为独立的 .c/.h 模块',
      '使用 esp_err_t 返回值，检查 ESP_ERROR_CHECK',
      'I2C 初始化使用 i2c_param_config + i2c_driver_install',
      'GPIO 使用 gpio_config_t 结构体批量配置',
      'FreeRTOS 任务栈大小建议 4096 字节起',
      '传感器读取放在独立任务中，用 vTaskDelay 控制采样间隔',
      '使用 CONFIG_ 宏定义在 Kconfig 中管理配置',
    ],
  },
  arduino: {
    description: 'Arduino 框架（.ino + 模块文件）',
    skeleton: [
      { path: 'sketch.ino', template: `#include <Arduino.h>\n// #include "模块.h"\n\nvoid setup() {\n    Serial.begin(115200);\n    Serial.println("系统启动");\n    // 初始化各模块\n}\n\nvoid loop() {\n    // 主循环逻辑\n    delay(100);\n}` },
    ],
    bestPractices: [
      '使用 Serial.println 进行调试输出',
      '每个外设独立为 .cpp + .h 文件',
      'I2C 使用 Wire.h 库，SPI 使用 SPI.h 库',
      'OLED 显示推荐使用 Adafruit_SSD1306 或 U8g2 库',
      'DHT 温湿度传感器使用 DHT.h 库',
      'WiFi 使用 WiFi.h（ESP32）或 ESP8266WiFi.h',
      'MQTT 推荐使用 PubSubClient 库',
      '避免在 loop() 中使用 delay()，改用 millis() 进行非阻塞定时',
    ],
  },
  platformio: {
    description: 'PlatformIO 框架（platformio.ini + src/）',
    skeleton: [
      { path: 'platformio.ini', template: `[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\nmonitor_speed = 115200\nlib_deps =\n    ; 在此添加库依赖` },
      { path: 'src/main.cpp', template: `#include <Arduino.h>\n// #include "模块.h"\n\nvoid setup() {\n    Serial.begin(115200);\n    Serial.println("系统启动");\n}\n\nvoid loop() {\n    // 主循环\n}` },
    ],
    bestPractices: [
      'lib_deps 中声明所有第三方库依赖',
      '使用 src/ 目录存放源码，lib/ 存放自定义库',
      'include/ 目录放公共头文件',
      '使用 build_flags 传递编译选项',
      '多环境配置用 [env:xxx] 区分不同开发板',
      '监视器波特率与 Serial.begin 保持一致',
    ],
  },
  cubeide: {
    description: 'STM32CubeIDE 工程（HAL 库 + .ioc 配置）',
    skeleton: [
      { path: 'Core/Src/main.c', template: `#include "main.h"\n#include "gpio.h"\n// #include "i2c.h"\n// #include "usart.h"\n\nvoid SystemClock_Config(void);\n\nint main(void) {\n    HAL_Init();\n    SystemClock_Config();\n    MX_GPIO_Init();\n    // MX_I2C1_Init();\n    // MX_USART1_UART_Init();\n\n    while (1) {\n        // 主循环\n        HAL_Delay(100);\n    }\n}` },
      { path: 'Core/Inc/main.h', template: `#ifndef __MAIN_H\n#define __MAIN_H\n\n#include "stm32f1xx_hal.h"\n\n// 用户引脚定义（与 .ioc 保持一致）\n// #define LED_PIN GPIO_PIN_13\n// #define LED_PORT GPIOC\n\n#endif` },
    ],
    bestPractices: [
      '使用 STM32CubeMX .ioc 文件管理引脚和外设配置，不要手动修改 MX_xxx_Init 函数',
      '用户代码写在 /* USER CODE BEGIN */ 和 /* USER CODE END */ 注释块内，防止重新生成代码时被覆盖',
      '使用 HAL_GPIO_WritePin / HAL_GPIO_ReadPin 操作 GPIO',
      'I2C 使用 HAL_I2C_Master_Transmit / HAL_I2C_Mem_Read',
      'UART 调试推荐重定向 printf 到 USART（重写 fputc）',
      'PWM 使用 HAL_TIM_PWM_Start + __HAL_TIM_SET_COMPARE 设置占空比',
      '中断回调在 HAL_xxx_Callback 弱函数中实现',
      'SWD 调试接口（PA13/PA14）不可复用为普通 GPIO',
    ],
  },
}

/** 将代码模板格式化为可注入 AI prompt 的文本 */
export function codeTemplateToPromptText(format: ProjectFormat): string {
  const tmpl = CODE_TEMPLATES[format]
  if (!tmpl) return ''
  let text = `## 代码规范参考 (${tmpl.description})\n\n`
  text += `### 文件骨架\n`
  for (const s of tmpl.skeleton) {
    text += `--- ${s.path} ---\n${s.template}\n\n`
  }
  text += `### 最佳实践\n`
  for (const bp of tmpl.bestPractices) {
    text += `- ${bp}\n`
  }
  return text
}
