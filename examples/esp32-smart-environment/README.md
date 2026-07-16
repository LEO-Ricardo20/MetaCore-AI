# ESP32 智慧环境监测节点

该工程用于 MetaCore AI 本地工程诊断和毕业答辩演示。

功能：

- ESP32 Wi-Fi 联网
- MQTT 环境数据上报
- DHT22 温湿度采集
- SSD1306 OLED 本地显示
- PlatformIO 工程构建

演示时将 MetaCore AI 的本地工作区设置为本目录，然后点击“扫描”。系统应识别：

- PlatformIO / Arduino
- ESP32
- Wi-Fi / MQTT
- DHT / SSD1306 / I2C
- GPIO 2、4、21、22
- PlatformIO 依赖

实际连接设备前，将 `include/config.example.h` 中的网络和 MQTT 参数替换为实验环境配置。
