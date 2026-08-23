# ESP32 专精配置与产品能力

本文记录 MetaCore Studio v2.4.0 第一轮 ESP32 专精范围。数据以 Espressif 官方入门文档、开发板资料和当前安装的 PlatformIO `espressif32` board manifest 为依据。

## 先分清四个层级

ESP32 项目里常被混用的名称其实属于不同层级：

```text
SoC 系列       ESP32-S3
模组           ESP32-S3-WROOM-1-N8
开发板         ESP32-S3-DevKitC-1 N8
构建标识       esp32-s3-devkitc-1（PlatformIO board ID）
```

Flash、PSRAM、USB 引脚和可用 GPIO 经常由具体模组/开发板变体决定。仅选择“ESP32-S3”不足以生成可靠工程，N8、N8R8 和 N16R8 也不能互相替代。

## 第一批五个常用系列

| 系列 | 默认开发板 / 模组 | CPU | 无线 | Flash / PSRAM | USB | PlatformIO board | ESP-IDF target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ESP32 | ESP32 Dev Module / ESP32-WROOM-32 | Xtensa LX6 双核 240 MHz | Wi-Fi 4、BT Classic、BLE 4.2 | 4MB / 无 | USB-UART | `esp32dev` | `esp32` |
| ESP32-S3 | DevKitC-1 N8 / WROOM-1-N8 | Xtensa LX7 双核 240 MHz | Wi-Fi 4、BLE 5 | 8MB / 无（N8） | USB OTG、USB Serial/JTAG | `esp32-s3-devkitc-1` | `esp32s3` |
| ESP32-C3 | DevKitM-1 / C3-MINI-1 | RISC-V 单核 160 MHz | Wi-Fi 4、BLE 5 | 4MB / 无 | USB Serial/JTAG | `esp32-c3-devkitm-1` | `esp32c3` |
| ESP32-C6 | DevKitC-1 / C6-WROOM-1-N8 | RISC-V 单核 160 MHz | Wi-Fi 6、BLE 5、Thread、Zigbee、802.15.4 | 8MB / 无 | USB Serial/JTAG | `esp32-c6-devkitc-1` | `esp32c6` |
| ESP32-S2 | Saola-1 / S2 WROOM/WROVER family | Xtensa LX7 单核 240 MHz | Wi-Fi 4，无 Bluetooth | 4MB / 依模组变体 | USB OTG | `esp32-s2-saola-1` | `esp32s2` |

当前机器上的 PlatformIO manifest 对 ESP32-C6-DevKitC-1 只声明 `espidf`。因此 MetaCore Studio 不会把 C6 Arduino 标为已验证，也不会允许该 profile 生成 PlatformIO Arduino 配置。

## 普通用户如何配置 ESP32

### Arduino IDE

1. 在 Board Manager 安装 `esp32 by Espressif Systems`。
2. 选择与实体开发板对应的 Board，而不是只看芯片系列。
3. 插入 USB 并选择串口。
4. 核对 Flash Size、Partition Scheme 和 Upload Speed。
5. 编译、Upload，然后打开 Serial Monitor。
6. 出错时依次检查端口、驱动、BOOT 下载模式、供电、Flash/PSRAM 变体和目标芯片。

### PlatformIO

核心配置通常只有：

```ini
[env:esp32-c3-devkitm-1]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
upload_speed = 460800
monitor_speed = 115200
```

然后依次运行：

```text
pio run
pio run -t upload
pio device monitor
```

`board` 必须与实体开发板匹配。把 S3/C3/C6/S2 都写成 `esp32dev` 会导致编译宏、存储、USB 和引脚能力错误。

### ESP-IDF

```text
idf.py set-target esp32c3
idf.py menuconfig
idf.py build
idf.py -p COMx flash monitor
```

S3、C3、C6、S2 必须分别使用 `esp32s3`、`esp32c3`、`esp32c6`、`esp32s2` target。普通用户无需先理解寄存器，只需确认开发板、串口、Flash/PSRAM、分区和外设需求。

## MetaCore Studio v2.4.0 已实现

- 项目创建和需求页都提供 ESP32 开发板向导。
- 独立保存 SoC family、模组、开发板、PlatformIO board、ESP-IDF target、Flash、PSRAM、USB、分区和串口速度。
- 旧的 `ESP32` / `ESP32-S3` 项目自动迁移到兼容默认 profile。
- PlatformIO 模板按开发板动态生成，不再写死 `esp32dev`。
- ESP-IDF prompt 与骨架注入正确的 `idf.py set-target`。
- AI 生成前注入完整 board profile，阻止不同系列能力混用。
- 方案生成后检查重复引脚、保留引脚、不可用引脚、仅输入引脚、strapping 和 USB 共用引脚。
- 修正 ESP32-S3 N8 被误写成 N16R8、8MB PSRAM和 DAC 的问题。
- ESP32-C6 不会显示为已验证的 Arduino/PlatformIO Arduino 配置。
- 项目导入导出保留 board profile；ZIP 报告包含开发板、模组和构建标识。

## 下一阶段

- 增加同一系列的多个真实模组变体，如 S3 N8R8/N16R8，并为每个变体提供独立存储策略。
- 通过本地服务探测串口、芯片 ID、Flash 容量与 PSRAM，并与项目 profile 对比。
- 增加构建、烧录、串口监视的连续工作区和稳定错误诊断。
- 增加可交互 pinout，并按 USB/JTAG/Flash/PSRAM/strapping 显示占用原因。
- 为 C6 增加 Matter、Thread 与 Zigbee 的 ESP-IDF 模板和组件检查。

## 官方资料

- [ESP32 Get Started](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/index.html)
- [ESP32-S3 Get Started](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/get-started/index.html)
- [ESP32-C3 Get Started](https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/get-started/index.html)
- [ESP32-C6 Get Started](https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/get-started/index.html)
- [ESP32-S2 Get Started](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s2/get-started/index.html)
- [Arduino ESP32 Installation](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html)
- [PlatformIO Espressif 32 Boards](https://docs.platformio.org/en/latest/platforms/espressif32.html#boards)
