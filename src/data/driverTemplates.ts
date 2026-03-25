/**
 * 经过验证的外设驱动模板库
 *
 * 当硬件方案中检测到特定外设（SSD1306 OLED、DHT 温湿度传感器）时，
 * 将对应的驱动模板注入 AI 代码生成 prompt，确保生成代码可直接编译运行。
 */

import type { ProjectFormat } from '@/types/hardware'
import type { HardwareScheme } from '@/types/project'

/** 单框架下的驱动代码 */
interface DriverCode {
  /** 库依赖（platformio lib_deps 条目 或 ESP-IDF idf_component.yml 组件名） */
  dependencies: string[]
  /** 驱动头文件完整内容 */
  header: string
  /** 驱动实现文件完整内容 */
  source: string
  /** 在 main 中的典型调用示例 */
  usage: string
}

/** 驱动模板定义 */
export interface DriverTemplate {
  /** 唯一标识，如 'ssd1306' | 'dht' */
  id: string
  /** 显示名称 */
  name: string
  /** 通信接口类型 */
  interface: 'I2C' | 'SPI' | 'GPIO' | 'UART'
  /** 用于从 BOM/方案描述中匹配的关键词（小写） */
  matchKeywords: string[]
  /** 各框架对应的驱动代码 */
  templates: Partial<Record<ProjectFormat, DriverCode>>
  /** 关键 API 文档摘要，帮助 AI 理解如何调用 */
  apiDoc: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SSD1306 OLED 显示屏驱动
// ─────────────────────────────────────────────────────────────────────────────

const SSD1306_ESPIDF_HEADER = `\
#pragma once
#include "esp_err.h"

/**
 * @brief 初始化 SSD1306 OLED 显示屏（I2C 接口）
 * @param sda_pin  I2C SDA 引脚号
 * @param scl_pin  I2C SCL 引脚号
 * @param i2c_addr I2C 地址，通常为 0x3C 或 0x3D
 * @return ESP_OK 成功，其他值失败
 */
esp_err_t oled_init(int sda_pin, int scl_pin, uint8_t i2c_addr);

/** @brief 清屏（填充黑色） */
void oled_clear(void);

/**
 * @brief 在指定位置显示字符串（ASCII，每字符 6x8 像素）
 * @param col  列（0-127）
 * @param row  行（0-7，每行 8 像素高）
 * @param text 要显示的字符串
 */
void oled_show_text(uint8_t col, uint8_t row, const char *text);

/** @brief 刷新显示缓冲区到屏幕 */
void oled_flush(void);
`

const SSD1306_ESPIDF_SOURCE = `\
#include "oled.h"
#include <string.h>
#include "driver/i2c.h"
#include "esp_log.h"

static const char *TAG = "oled";
#define I2C_PORT        I2C_NUM_0
#define I2C_FREQ_HZ     400000
#define OLED_WIDTH      128
#define OLED_HEIGHT     64
#define OLED_PAGES      (OLED_HEIGHT / 8)

static uint8_t s_buf[OLED_PAGES][OLED_WIDTH];
static uint8_t s_addr;

/* SSD1306 基础命令 */
static esp_err_t oled_write_cmd(uint8_t cmd) {
    i2c_cmd_handle_t h = i2c_cmd_link_create();
    i2c_master_start(h);
    i2c_master_write_byte(h, (s_addr << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(h, 0x00, true);   /* Co=0, D/C#=0 命令模式 */
    i2c_master_write_byte(h, cmd, true);
    i2c_master_stop(h);
    esp_err_t ret = i2c_master_cmd_begin(I2C_PORT, h, pdMS_TO_TICKS(100));
    i2c_cmd_link_delete(h);
    return ret;
}

static const uint8_t INIT_CMDS[] = {
    0xAE,       /* 关闭显示 */
    0xD5, 0x80, /* 时钟分频 */
    0xA8, 0x3F, /* 复用率 64 */
    0xD3, 0x00, /* 显示偏移 */
    0x40,       /* 起始行 0 */
    0x8D, 0x14, /* 开启电荷泵 */
    0x20, 0x00, /* 水平寻址模式 */
    0xA1,       /* 段映射翻转 */
    0xC8,       /* COM 输出方向翻转 */
    0xDA, 0x12, /* COM 引脚配置 */
    0x81, 0xCF, /* 对比度 */
    0xD9, 0xF1, /* 预充电周期 */
    0xDB, 0x40, /* VCOMH 电压 */
    0xA4,       /* 全局显示开启 */
    0xA6,       /* 正常显示（非反转） */
    0xAF,       /* 开启显示 */
};

/* 6x8 ASCII 字模（空格到 '~'，仅包含可打印字符） */
static const uint8_t FONT6x8[][6] = {
    {0x00,0x00,0x00,0x00,0x00,0x00}, /* ' ' */
    {0x00,0x00,0x5F,0x00,0x00,0x00}, /* '!' */
    {0x00,0x07,0x00,0x07,0x00,0x00}, /* '"' */
    {0x14,0x7F,0x14,0x7F,0x14,0x00}, /* '#' */
    {0x24,0x2A,0x7F,0x2A,0x12,0x00}, /* '$' */
    {0x23,0x13,0x08,0x64,0x62,0x00}, /* '%' */
    {0x36,0x49,0x55,0x22,0x50,0x00}, /* '&' */
    {0x00,0x05,0x03,0x00,0x00,0x00}, /* ''' */
    {0x00,0x1C,0x22,0x41,0x00,0x00}, /* '(' */
    {0x00,0x41,0x22,0x1C,0x00,0x00}, /* ')' */
    {0x08,0x2A,0x1C,0x2A,0x08,0x00}, /* '*' */
    {0x08,0x08,0x3E,0x08,0x08,0x00}, /* '+' */
    {0x00,0x50,0x30,0x00,0x00,0x00}, /* ',' */
    {0x08,0x08,0x08,0x08,0x08,0x00}, /* '-' */
    {0x00,0x30,0x30,0x00,0x00,0x00}, /* '.' */
    {0x20,0x10,0x08,0x04,0x02,0x00}, /* '/' */
    {0x3E,0x51,0x49,0x45,0x3E,0x00}, /* '0' */
    {0x00,0x42,0x7F,0x40,0x00,0x00}, /* '1' */
    {0x42,0x61,0x51,0x49,0x46,0x00}, /* '2' */
    {0x21,0x41,0x45,0x4B,0x31,0x00}, /* '3' */
    {0x18,0x14,0x12,0x7F,0x10,0x00}, /* '4' */
    {0x27,0x45,0x45,0x45,0x39,0x00}, /* '5' */
    {0x3C,0x4A,0x49,0x49,0x30,0x00}, /* '6' */
    {0x01,0x71,0x09,0x05,0x03,0x00}, /* '7' */
    {0x36,0x49,0x49,0x49,0x36,0x00}, /* '8' */
    {0x06,0x49,0x49,0x29,0x1E,0x00}, /* '9' */
    {0x00,0x36,0x36,0x00,0x00,0x00}, /* ':' */
    {0x00,0x56,0x36,0x00,0x00,0x00}, /* ';' */
    {0x00,0x08,0x14,0x22,0x41,0x00}, /* '<' */
    {0x14,0x14,0x14,0x14,0x14,0x00}, /* '=' */
    {0x41,0x22,0x14,0x08,0x00,0x00}, /* '>' */
    {0x02,0x01,0x51,0x09,0x06,0x00}, /* '?' */
    {0x32,0x49,0x79,0x41,0x3E,0x00}, /* '@' */
    {0x7E,0x11,0x11,0x11,0x7E,0x00}, /* 'A' */
    {0x7F,0x49,0x49,0x49,0x36,0x00}, /* 'B' */
    {0x3E,0x41,0x41,0x41,0x22,0x00}, /* 'C' */
    {0x7F,0x41,0x41,0x22,0x1C,0x00}, /* 'D' */
    {0x7F,0x49,0x49,0x49,0x41,0x00}, /* 'E' */
    {0x7F,0x09,0x09,0x09,0x01,0x00}, /* 'F' */
    {0x3E,0x41,0x49,0x49,0x7A,0x00}, /* 'G' */
    {0x7F,0x08,0x08,0x08,0x7F,0x00}, /* 'H' */
    {0x00,0x41,0x7F,0x41,0x00,0x00}, /* 'I' */
    {0x20,0x40,0x41,0x3F,0x01,0x00}, /* 'J' */
    {0x7F,0x08,0x14,0x22,0x41,0x00}, /* 'K' */
    {0x7F,0x40,0x40,0x40,0x40,0x00}, /* 'L' */
    {0x7F,0x02,0x04,0x02,0x7F,0x00}, /* 'M' */
    {0x7F,0x04,0x08,0x10,0x7F,0x00}, /* 'N' */
    {0x3E,0x41,0x41,0x41,0x3E,0x00}, /* 'O' */
    {0x7F,0x09,0x09,0x09,0x06,0x00}, /* 'P' */
    {0x3E,0x41,0x51,0x21,0x5E,0x00}, /* 'Q' */
    {0x7F,0x09,0x19,0x29,0x46,0x00}, /* 'R' */
    {0x46,0x49,0x49,0x49,0x31,0x00}, /* 'S' */
    {0x01,0x01,0x7F,0x01,0x01,0x00}, /* 'T' */
    {0x3F,0x40,0x40,0x40,0x3F,0x00}, /* 'U' */
    {0x1F,0x20,0x40,0x20,0x1F,0x00}, /* 'V' */
    {0x3F,0x40,0x38,0x40,0x3F,0x00}, /* 'W' */
    {0x63,0x14,0x08,0x14,0x63,0x00}, /* 'X' */
    {0x03,0x04,0x78,0x04,0x03,0x00}, /* 'Y' */
    {0x61,0x51,0x49,0x45,0x43,0x00}, /* 'Z' */
    {0x00,0x00,0x7F,0x41,0x41,0x00}, /* '[' */
    {0x02,0x04,0x08,0x10,0x20,0x00}, /* '\\' */
    {0x41,0x41,0x7F,0x00,0x00,0x00}, /* ']' */
    {0x04,0x02,0x01,0x02,0x04,0x00}, /* '^' */
    {0x40,0x40,0x40,0x40,0x40,0x00}, /* '_' */
    {0x00,0x01,0x02,0x04,0x00,0x00}, /* '\`' */
    {0x20,0x54,0x54,0x54,0x78,0x00}, /* 'a' */
    {0x7F,0x48,0x44,0x44,0x38,0x00}, /* 'b' */
    {0x38,0x44,0x44,0x44,0x20,0x00}, /* 'c' */
    {0x38,0x44,0x44,0x48,0x7F,0x00}, /* 'd' */
    {0x38,0x54,0x54,0x54,0x18,0x00}, /* 'e' */
    {0x08,0x7E,0x09,0x01,0x02,0x00}, /* 'f' */
    {0x08,0x54,0x54,0x54,0x3C,0x00}, /* 'g' */
    {0x7F,0x08,0x04,0x04,0x78,0x00}, /* 'h' */
    {0x00,0x44,0x7D,0x40,0x00,0x00}, /* 'i' */
    {0x20,0x40,0x44,0x3D,0x00,0x00}, /* 'j' */
    {0x7F,0x10,0x28,0x44,0x00,0x00}, /* 'k' */
    {0x00,0x41,0x7F,0x40,0x00,0x00}, /* 'l' */
    {0x7C,0x04,0x18,0x04,0x78,0x00}, /* 'm' */
    {0x7C,0x08,0x04,0x04,0x78,0x00}, /* 'n' */
    {0x38,0x44,0x44,0x44,0x38,0x00}, /* 'o' */
    {0x7C,0x14,0x14,0x14,0x08,0x00}, /* 'p' */
    {0x08,0x14,0x14,0x18,0x7C,0x00}, /* 'q' */
    {0x7C,0x08,0x04,0x04,0x08,0x00}, /* 'r' */
    {0x48,0x54,0x54,0x54,0x20,0x00}, /* 's' */
    {0x04,0x3F,0x44,0x40,0x20,0x00}, /* 't' */
    {0x3C,0x40,0x40,0x20,0x7C,0x00}, /* 'u' */
    {0x1C,0x20,0x40,0x20,0x1C,0x00}, /* 'v' */
    {0x3C,0x40,0x30,0x40,0x3C,0x00}, /* 'w' */
    {0x44,0x28,0x10,0x28,0x44,0x00}, /* 'x' */
    {0x0C,0x50,0x50,0x50,0x3C,0x00}, /* 'y' */
    {0x44,0x64,0x54,0x4C,0x44,0x00}, /* 'z' */
    {0x00,0x08,0x36,0x41,0x00,0x00}, /* '{' */
    {0x00,0x00,0x7F,0x00,0x00,0x00}, /* '|' */
    {0x00,0x41,0x36,0x08,0x00,0x00}, /* '}' */
    {0x08,0x08,0x2A,0x1C,0x08,0x00}, /* '~' */
};

esp_err_t oled_init(int sda_pin, int scl_pin, uint8_t i2c_addr) {
    s_addr = i2c_addr;
    /* 配置 I2C 主机 */
    i2c_config_t cfg = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = sda_pin,
        .scl_io_num = scl_pin,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_FREQ_HZ,
    };
    ESP_ERROR_CHECK(i2c_param_config(I2C_PORT, &cfg));
    ESP_ERROR_CHECK(i2c_driver_install(I2C_PORT, I2C_MODE_MASTER, 0, 0, 0));
    /* 发送初始化命令序列 */
    for (size_t i = 0; i < sizeof(INIT_CMDS); i++) {
        esp_err_t ret = oled_write_cmd(INIT_CMDS[i]);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "初始化命令 0x%02X 失败: %s", INIT_CMDS[i], esp_err_to_name(ret));
            return ret;
        }
    }
    oled_clear();
    oled_flush();
    ESP_LOGI(TAG, "SSD1306 初始化成功，地址 0x%02X", i2c_addr);
    return ESP_OK;
}

void oled_clear(void) {
    memset(s_buf, 0, sizeof(s_buf));
}

void oled_show_text(uint8_t col, uint8_t row, const char *text) {
    if (row >= OLED_PAGES || !text) return;
    while (*text && col < OLED_WIDTH) {
        uint8_t ch = (uint8_t)*text++;
        if (ch < 0x20 || ch > 0x7E) ch = 0x20;
        const uint8_t *glyph = FONT6x8[ch - 0x20];
        for (int i = 0; i < 6 && col < OLED_WIDTH; i++, col++) {
            s_buf[row][col] = glyph[i];
        }
    }
}

void oled_flush(void) {
    /* 设置列地址范围 0~127 */
    oled_write_cmd(0x21); oled_write_cmd(0); oled_write_cmd(127);
    /* 设置页地址范围 0~7 */
    oled_write_cmd(0x22); oled_write_cmd(0); oled_write_cmd(7);
    /* 按页批量写入显存 */
    for (int page = 0; page < OLED_PAGES; page++) {
        i2c_cmd_handle_t h = i2c_cmd_link_create();
        i2c_master_start(h);
        i2c_master_write_byte(h, (s_addr << 1) | I2C_MASTER_WRITE, true);
        i2c_master_write_byte(h, 0x40, true);  /* D/C#=1 数据模式 */
        i2c_master_write(h, s_buf[page], OLED_WIDTH, true);
        i2c_master_stop(h);
        i2c_master_cmd_begin(I2C_PORT, h, pdMS_TO_TICKS(100));
        i2c_cmd_link_delete(h);
    }
}
`

const SSD1306_ESPIDF_USAGE = `\
/* main.c 中调用示例 */
#include "oled.h"
#include <stdio.h>

void app_main(void) {
    /* 使用方案中分配的 I2C 引脚，SSD1306 默认 I2C 地址 0x3C */
    ESP_ERROR_CHECK(oled_init(GPIO_SDA, GPIO_SCL, 0x3C));
    oled_clear();
    oled_show_text(0, 0, "MetaCore AI");
    oled_show_text(0, 2, "Temp: 25.6C");
    oled_show_text(0, 3, "Humi: 65%");
    oled_flush();
}
`

const SSD1306_ARDUINO_HEADER = `\
#pragma once
#include <Adafruit_SSD1306.h>

/** 初始化 SSD1306 OLED（I2C，默认地址 0x3C） */
bool oled_init(uint8_t sda_pin, uint8_t scl_pin, uint8_t i2c_addr = 0x3C);

/** 清屏 */
void oled_clear();

/**
 * 在指定行显示字符串
 * @param row  行号（0 开始）
 * @param text 要显示的内容
 * @param size 字体大小（1=6x8, 2=12x16）
 */
void oled_show_text(uint8_t row, const String &text, uint8_t size = 1);

/** 立即刷新到屏幕 */
void oled_flush();

/** 获取全局 display 对象（供高级操作使用） */
Adafruit_SSD1306 &oled_display();
`

const SSD1306_ARDUINO_SOURCE = `\
#include "oled.h"
#include <Wire.h>

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1  /* 复位引脚（-1 表示共用 Arduino 复位引脚） */

static Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

bool oled_init(uint8_t sda_pin, uint8_t scl_pin, uint8_t i2c_addr) {
    Wire.begin(sda_pin, scl_pin);
    if (!display.begin(SSD1306_SWITCHCAPVCC, i2c_addr)) {
        Serial.println("[OLED] 初始化失败，检查接线和地址");
        return false;
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.display();
    Serial.println("[OLED] 初始化成功");
    return true;
}

void oled_clear() {
    display.clearDisplay();
}

void oled_show_text(uint8_t row, const String &text, uint8_t size) {
    display.setTextSize(size);
    display.setCursor(0, row * 8 * size);
    display.println(text);
}

void oled_flush() {
    display.display();
}

Adafruit_SSD1306 &oled_display() {
    return display;
}
`

const SSD1306_ARDUINO_USAGE = `\
/* sketch.ino 中调用示例 */
#include "oled.h"

void setup() {
    Serial.begin(115200);
    /* 使用方案中分配的 SDA/SCL 引脚 */
    oled_init(SDA_PIN, SCL_PIN);
    oled_clear();
    oled_show_text(0, "MetaCore AI");
    oled_show_text(2, "Temp: --.-C");
    oled_show_text(3, "Humi: --%");
    oled_flush();
}
`

// ─────────────────────────────────────────────────────────────────────────────
// DHT 温湿度传感器驱动
// ─────────────────────────────────────────────────────────────────────────────

const DHT_ESPIDF_HEADER = `\
#pragma once
#include "esp_err.h"
#include <stdint.h>

/** DHT 传感器型号 */
typedef enum {
    DHT_TYPE_DHT11 = 11,  /**< DHT11：精度 ±2°C / ±5%RH，范围 0-50°C */
    DHT_TYPE_DHT22 = 22,  /**< DHT22：精度 ±0.5°C / ±2%RH，范围 -40-80°C */
} dht_type_t;

/**
 * @brief 初始化 DHT 传感器
 * @param gpio_pin 连接 DATA 引脚的 GPIO 编号
 * @param type     传感器型号（DHT_TYPE_DHT11 或 DHT_TYPE_DHT22）
 */
void dht_init(int gpio_pin, dht_type_t type);

/**
 * @brief 读取温湿度数据
 * @param temperature 输出：温度（摄氏度）
 * @param humidity    输出：相对湿度（%）
 * @return ESP_OK 成功；ESP_ERR_TIMEOUT 总线超时；ESP_ERR_INVALID_CRC 校验失败
 */
esp_err_t dht_read(float *temperature, float *humidity);
`

const DHT_ESPIDF_SOURCE = `\
#include "dht.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "rom/ets_sys.h"

static const char *TAG = "dht";
static int     s_pin;
static dht_type_t s_type;

void dht_init(int gpio_pin, dht_type_t type) {
    s_pin  = gpio_pin;
    s_type = type;
    gpio_set_direction((gpio_num_t)s_pin, GPIO_MODE_INPUT_OUTPUT_OD);
    gpio_set_level((gpio_num_t)s_pin, 1);
    /* DHT 传感器上电后需要至少 1 秒稳定时间 */
    vTaskDelay(pdMS_TO_TICKS(1200));
    ESP_LOGI(TAG, "DHT%d 初始化完成，GPIO%d", s_type, s_pin);
}

/** 等待引脚变为指定电平，超时返回 -1，否则返回等待时间（μs） */
static int wait_level(int level, int timeout_us) {
    int us = 0;
    while (gpio_get_level((gpio_num_t)s_pin) != level) {
        if (us++ >= timeout_us) return -1;
        ets_delay_us(1);
    }
    return us;
}

esp_err_t dht_read(float *temperature, float *humidity) {
    uint8_t data[5] = {0};

    /* 起始信号：主机拉低 18ms（DHT11）/ 1ms（DHT22），然后拉高 20-40μs */
    gpio_set_direction((gpio_num_t)s_pin, GPIO_MODE_OUTPUT);
    gpio_set_level((gpio_num_t)s_pin, 0);
    ets_delay_us((s_type == DHT_TYPE_DHT11) ? 18000 : 1100);
    gpio_set_level((gpio_num_t)s_pin, 1);
    ets_delay_us(30);
    gpio_set_direction((gpio_num_t)s_pin, GPIO_MODE_INPUT);

    /* 等待 DHT 响应：拉低 80μs → 拉高 80μs */
    if (wait_level(0, 100) < 0) { ESP_LOGE(TAG, "响应超时(低)"); return ESP_ERR_TIMEOUT; }
    if (wait_level(1, 100) < 0) { ESP_LOGE(TAG, "响应超时(高)"); return ESP_ERR_TIMEOUT; }

    /* 读取 40 bit 数据 */
    for (int i = 0; i < 40; i++) {
        /* 每 bit 开始：低电平约 50μs */
        if (wait_level(0, 60) < 0) { ESP_LOGE(TAG, "bit%d 低电平超时", i); return ESP_ERR_TIMEOUT; }
        /* 高电平持续时间：26-28μs → 0，70μs → 1 */
        int high_us = wait_level(1, 80);
        if (high_us < 0) { ESP_LOGE(TAG, "bit%d 高电平超时", i); return ESP_ERR_TIMEOUT; }
        if (high_us > 35) {
            data[i / 8] |= (1 << (7 - (i % 8)));
        }
    }

    /* 校验和验证 */
    uint8_t checksum = data[0] + data[1] + data[2] + data[3];
    if (checksum != data[4]) {
        ESP_LOGE(TAG, "校验失败: 计算 0x%02X，接收 0x%02X", checksum, data[4]);
        return ESP_ERR_INVALID_CRC;
    }

    /* 解析数据 */
    if (s_type == DHT_TYPE_DHT11) {
        *humidity    = (float)data[0];
        *temperature = (float)data[2];
    } else {
        /* DHT22：16 bit 有符号，分辨率 0.1 */
        *humidity    = ((data[0] << 8) | data[1]) / 10.0f;
        int16_t raw  = ((data[2] & 0x7F) << 8) | data[3];
        *temperature = raw / 10.0f;
        if (data[2] & 0x80) *temperature = -*temperature;
    }
    return ESP_OK;
}
`

const DHT_ESPIDF_USAGE = `\
/* main.c 中调用示例 */
#include "dht.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "main";

void sensor_task(void *arg) {
    /* 使用方案中分配的 GPIO 引脚；根据实际传感器选择型号 */
    dht_init(GPIO_DHT_DATA, DHT_TYPE_DHT11);
    float temp, humi;
    while (1) {
        if (dht_read(&temp, &humi) == ESP_OK) {
            ESP_LOGI(TAG, "温度: %.1f°C  湿度: %.1f%%", temp, humi);
        } else {
            ESP_LOGW(TAG, "传感器读取失败，稍后重试");
        }
        vTaskDelay(pdMS_TO_TICKS(2000));  /* DHT11 最小采样间隔 1s，建议 2s */
    }
}
`

const DHT_ARDUINO_HEADER = `\
#pragma once
#include <DHT.h>

/**
 * 初始化 DHT 传感器
 * @param pin      DATA 引脚号
 * @param dht_type DHT11 或 DHT22
 */
void dht_sensor_init(uint8_t pin, uint8_t dht_type = DHT11);

/**
 * 读取温湿度（同步阻塞）
 * @param temperature 输出温度（°C）
 * @param humidity    输出湿度（%）
 * @return true 成功；false 读取失败（NaN 保护）
 */
bool dht_sensor_read(float &temperature, float &humidity);
`

const DHT_ARDUINO_SOURCE = `\
#include "dht_sensor.h"

static DHT *s_dht = nullptr;

void dht_sensor_init(uint8_t pin, uint8_t dht_type) {
    static DHT dht_instance(pin, dht_type);
    s_dht = &dht_instance;
    s_dht->begin();
    delay(1000);  /* 等待传感器稳定 */
    Serial.println("[DHT] 传感器初始化完成");
}

bool dht_sensor_read(float &temperature, float &humidity) {
    if (!s_dht) { Serial.println("[DHT] 未初始化"); return false; }
    float t = s_dht->readTemperature();
    float h = s_dht->readHumidity();
    if (isnan(t) || isnan(h)) {
        Serial.println("[DHT] 读取失败，返回 NaN");
        return false;
    }
    temperature = t;
    humidity    = h;
    return true;
}
`

const DHT_ARDUINO_USAGE = `\
/* sketch.ino 中调用示例 */
#include "dht_sensor.h"

#define DHT_PIN  4  /* 使用方案中分配的 GPIO 引脚 */

void setup() {
    Serial.begin(115200);
    dht_sensor_init(DHT_PIN, DHT11);  /* DHT22 则改为 DHT22 */
}

void loop() {
    float temp, humi;
    if (dht_sensor_read(temp, humi)) {
        Serial.printf("温度: %.1f°C  湿度: %.1f%%\\n", temp, humi);
    }
    delay(2000);
}
`

// ─────────────────────────────────────────────────────────────────────────────
// 驱动模板数据库
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_TEMPLATES: DriverTemplate[] = [
  {
    id: 'ssd1306',
    name: 'SSD1306 OLED 显示屏',
    interface: 'I2C',
    matchKeywords: ['ssd1306', 'oled', '0.96寸', '1.3寸', '0.91寸', 'oled显示', '显示屏'],
    apiDoc: `SSD1306 I2C 驱动 API：
- oled_init(sda, scl, addr)：初始化 I2C 和显示屏，addr 通常为 0x3C
- oled_clear()：清除显示缓冲区（不立即刷新到屏幕）
- oled_show_text(col, row, text)：在指定位置写入 ASCII 文本（ESP-IDF）
- oled_show_text(row, text, size)：在指定行写入文本（Arduino/PlatformIO）
- oled_flush()：将缓冲区内容刷新到屏幕，调用后才可见
- 每次修改内容后必须调用 oled_flush() 才能更新显示
- I2C 地址：0x3C（SA0=GND）或 0x3D（SA0=VCC）`,
    templates: {
      espidf: {
        dependencies: ['driver/i2c（ESP-IDF 内置，无需额外安装）'],
        header: SSD1306_ESPIDF_HEADER,
        source: SSD1306_ESPIDF_SOURCE,
        usage: SSD1306_ESPIDF_USAGE,
      },
      arduino: {
        dependencies: [
          'Adafruit SSD1306（Arduino Library Manager 搜索安装）',
          'Adafruit GFX Library（Arduino Library Manager 搜索安装）',
        ],
        header: SSD1306_ARDUINO_HEADER,
        source: SSD1306_ARDUINO_SOURCE,
        usage: SSD1306_ARDUINO_USAGE,
      },
      platformio: {
        dependencies: [
          'adafruit/Adafruit SSD1306@^2.5.7',
          'adafruit/Adafruit GFX Library@^1.11.5',
        ],
        header: SSD1306_ARDUINO_HEADER,
        source: SSD1306_ARDUINO_SOURCE,
        usage: SSD1306_ARDUINO_USAGE,
      },
    },
  },
  {
    id: 'dht',
    name: 'DHT 温湿度传感器',
    interface: 'GPIO',
    matchKeywords: ['dht11', 'dht22', 'dht', '温湿度', '温度传感器', '湿度传感器', '温湿度传感器'],
    apiDoc: `DHT 温湿度传感器驱动 API：
- dht_init(gpio, type)：初始化 GPIO 和传感器类型（DHT11/DHT22）
- dht_read(&temp, &humi)：读取温湿度，成功返回 ESP_OK（ESP-IDF）或 true（Arduino）
- DHT11 采样间隔 ≥1s，建议 2s；DHT22 采样间隔 ≥2s
- 读取失败时保留上次有效值或等待后重试，不要立即再次读取
- DHT22 精度更高（±0.5°C），DHT11 更便宜（±2°C）
- DATA 引脚需要 4.7kΩ 上拉电阻到 VCC（3.3V 或 5V）`,
    templates: {
      espidf: {
        dependencies: ['driver/gpio（ESP-IDF 内置，无需额外安装）'],
        header: DHT_ESPIDF_HEADER,
        source: DHT_ESPIDF_SOURCE,
        usage: DHT_ESPIDF_USAGE,
      },
      arduino: {
        dependencies: [
          'DHT sensor library（Arduino Library Manager 搜索安装）',
          'Adafruit Unified Sensor（Arduino Library Manager 搜索安装）',
        ],
        header: DHT_ARDUINO_HEADER,
        source: DHT_ARDUINO_SOURCE,
        usage: DHT_ARDUINO_USAGE,
      },
      platformio: {
        dependencies: [
          'adafruit/DHT sensor library@^1.4.4',
          'adafruit/Adafruit Unified Sensor@^1.1.14',
        ],
        header: DHT_ARDUINO_HEADER,
        source: DHT_ARDUINO_SOURCE,
        usage: DHT_ARDUINO_USAGE,
      },
    },
  },

  // ── AHT20 / AHT21 温湿度传感器（I2C）────────────────────────────────────────
  {
    id: 'aht20',
    name: 'AHT20/AHT21 温湿度传感器',
    interface: 'I2C',
    matchKeywords: ['aht20', 'aht21', 'aht10', '温湿度传感器', '温湿度'],
    apiDoc: `AHT20 I2C 驱动 API（Arduino/STM32）：
- AHT20 aht; aht.begin();：初始化（I2C地址固定 0x38，调用前需 Wire.begin(SDA, SCL)）
- aht.readSensor()：触发一次采集，返回 true 表示成功
- aht.getTemperature()：返回温度（°C，float）
- aht.getHumidity()：返回湿度（%RH，float）
- 采样间隔建议 ≥ 100ms；上电后需等待 ≥ 20ms 再初始化
- I2C 地址：0x38（固定，无法更改）`,
    templates: {
      arduino: {
        dependencies: [
          'Adafruit AHTX0（Arduino Library Manager 搜索安装）',
        ],
        header: `\
#pragma once
#include <Wire.h>
#include <Adafruit_AHTX0.h>

// AHT20/AHT21 温湿度传感器封装
// I2C 地址固定 0x38，调用前需先 Wire.begin(SDA_PIN, SCL_PIN)
class AHT20Sensor {
public:
  bool begin();
  bool read(float &temp, float &humi);
private:
  Adafruit_AHTX0 _aht;
};`,
        source: `\
#include "aht20.h"

bool AHT20Sensor::begin() {
  return _aht.begin();
}

bool AHT20Sensor::read(float &temp, float &humi) {
  sensors_event_t humidity_event, temp_event;
  if (!_aht.getEvent(&humidity_event, &temp_event)) return false;
  temp = temp_event.temperature;
  humi = humidity_event.relative_humidity;
  return true;
}`,
        usage: `\
// --- 在 setup() 中 ---
Wire.begin(SDA_PIN, SCL_PIN);   // STM32F103-KIT: Wire.begin(PB7, PB6)
AHT20Sensor ahtSensor;
if (!ahtSensor.begin()) {
  Serial.println("AHT20 init failed!");
  while (1);
}

// --- 在 loop() 中 ---
float temp, humi;
if (ahtSensor.read(temp, humi)) {
  Serial.print("Temp: "); Serial.print(temp); Serial.print(" C  ");
  Serial.print("Humi: "); Serial.print(humi); Serial.println(" %");
}
delay(500);`,
      },
      platformio: {
        dependencies: [
          'adafruit/Adafruit AHTX0@^2.0.5',
        ],
        header: `\
#pragma once
#include <Wire.h>
#include <Adafruit_AHTX0.h>

class AHT20Sensor {
public:
  bool begin();
  bool read(float &temp, float &humi);
private:
  Adafruit_AHTX0 _aht;
};`,
        source: `\
#include "aht20.h"

bool AHT20Sensor::begin() {
  return _aht.begin();
}

bool AHT20Sensor::read(float &temp, float &humi) {
  sensors_event_t humidity_event, temp_event;
  if (!_aht.getEvent(&humidity_event, &temp_event)) return false;
  temp = temp_event.temperature;
  humi = humidity_event.relative_humidity;
  return true;
}`,
        usage: `\
// --- 在 setup() 中 ---
Wire.begin(SDA_PIN, SCL_PIN);   // STM32F103-KIT: Wire.begin(PB7, PB6)
AHT20Sensor ahtSensor;
if (!ahtSensor.begin()) {
  Serial.println("AHT20 init failed!");
  while (1);
}

// --- 在 loop() 中 ---
float temp, humi;
if (ahtSensor.read(temp, humi)) {
  Serial.print("Temp: "); Serial.print(temp); Serial.println(" C");
  Serial.print("Humi: "); Serial.print(humi); Serial.println(" %");
}
delay(500);`,
      },
      espidf: {
        dependencies: ['driver/i2c（ESP-IDF 内置）'],
        header: `\
#pragma once
#include "esp_err.h"
#include "driver/i2c.h"

#define AHT20_I2C_ADDR   0x38
#define AHT20_CMD_INIT   0xBE
#define AHT20_CMD_TRIG   0xAC

/**
 * @brief 初始化 AHT20（I2C 主机端需已初始化）
 */
esp_err_t aht20_init(i2c_port_t port);

/**
 * @brief 触发采集并读取温湿度
 * @param port   I2C 端口号
 * @param temp   输出温度（°C）
 * @param humi   输出湿度（%RH）
 */
esp_err_t aht20_read(i2c_port_t port, float *temp, float *humi);`,
        source: `\
#include "aht20.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static esp_err_t i2c_write(i2c_port_t port, uint8_t addr,
                            const uint8_t *data, size_t len) {
  i2c_cmd_handle_t cmd = i2c_cmd_link_create();
  i2c_master_start(cmd);
  i2c_master_write_byte(cmd, (addr << 1) | I2C_MASTER_WRITE, true);
  i2c_master_write(cmd, data, len, true);
  i2c_master_stop(cmd);
  esp_err_t ret = i2c_master_cmd_begin(port, cmd, pdMS_TO_TICKS(100));
  i2c_cmd_link_delete(cmd);
  return ret;
}

static esp_err_t i2c_read(i2c_port_t port, uint8_t addr,
                           uint8_t *buf, size_t len) {
  i2c_cmd_handle_t cmd = i2c_cmd_link_create();
  i2c_master_start(cmd);
  i2c_master_write_byte(cmd, (addr << 1) | I2C_MASTER_READ, true);
  i2c_master_read(cmd, buf, len, I2C_MASTER_LAST_NACK);
  i2c_master_stop(cmd);
  esp_err_t ret = i2c_master_cmd_begin(port, cmd, pdMS_TO_TICKS(100));
  i2c_cmd_link_delete(cmd);
  return ret;
}

esp_err_t aht20_init(i2c_port_t port) {
  vTaskDelay(pdMS_TO_TICKS(40));   // 上电等待
  uint8_t cmd[] = {AHT20_CMD_INIT, 0x08, 0x00};
  return i2c_write(port, AHT20_I2C_ADDR, cmd, sizeof(cmd));
}

esp_err_t aht20_read(i2c_port_t port, float *temp, float *humi) {
  uint8_t trig[] = {AHT20_CMD_TRIG, 0x33, 0x00};
  esp_err_t ret = i2c_write(port, AHT20_I2C_ADDR, trig, sizeof(trig));
  if (ret != ESP_OK) return ret;
  vTaskDelay(pdMS_TO_TICKS(80));  // 采集等待

  uint8_t data[6];
  ret = i2c_read(port, AHT20_I2C_ADDR, data, 6);
  if (ret != ESP_OK) return ret;

  uint32_t raw_humi = ((uint32_t)data[1] << 12) | ((uint32_t)data[2] << 4) | (data[3] >> 4);
  uint32_t raw_temp = (((uint32_t)data[3] & 0x0F) << 16) | ((uint32_t)data[4] << 8) | data[5];
  *humi = (float)raw_humi / 1048576.0f * 100.0f;
  *temp = (float)raw_temp / 1048576.0f * 200.0f - 50.0f;
  return ESP_OK;
}`,
        usage: `\
// --- 初始化 I2C ---
i2c_config_t conf = {
  .mode = I2C_MODE_MASTER,
  .sda_io_num = GPIO_NUM_21,
  .scl_io_num = GPIO_NUM_22,
  .sda_pullup_en = GPIO_PULLUP_ENABLE,
  .scl_pullup_en = GPIO_PULLUP_ENABLE,
  .master.clk_speed = 100000,
};
i2c_param_config(I2C_NUM_0, &conf);
i2c_driver_install(I2C_NUM_0, I2C_MODE_MASTER, 0, 0, 0);
aht20_init(I2C_NUM_0);

// --- 读取数据 ---
float temp, humi;
if (aht20_read(I2C_NUM_0, &temp, &humi) == ESP_OK) {
  ESP_LOGI("AHT20", "Temp: %.1f C  Humi: %.1f %%", temp, humi);
}`,
      },
    },
  },

  // ── WS2812 / WS2812B 可寻址 RGB LED ─────────────────────────────────────────
  {
    id: 'ws2812',
    name: 'WS2812/WS2812B 可寻址 RGB LED',
    interface: 'GPIO',
    matchKeywords: ['ws2812', 'ws2812b', 'neopixel', '可寻址', '彩灯', 'rgb灯', 'ws2815'],
    apiDoc: `WS2812 驱动 API（Arduino/STM32，使用 Adafruit NeoPixel）：
- Adafruit_NeoPixel strip(NUM_LEDS, DATA_PIN, NEO_GRB + NEO_KHZ800)：构造
- strip.begin()：初始化
- strip.setPixelColor(i, r, g, b)：设置第 i 颗 LED 颜色（0-indexed）
- strip.fill(color, first, count)：批量填色
- strip.show()：推送数据，调用后才更新显示
- strip.clear()：清除所有灯（需再 show() 才生效）
- strip.setBrightness(0-255)：设置全局亮度（在 begin() 之后调用）
- STM32F103-KIT：DATA_PIN = PB4，必须配置为开漏输出（库已处理）`,
    templates: {
      arduino: {
        dependencies: [
          'Adafruit NeoPixel（Arduino Library Manager 搜索安装）',
        ],
        header: `\
#pragma once
#include <Adafruit_NeoPixel.h>

// WS2812 可寻址 RGB LED 封装
// STM32F103-KIT: DATA_PIN = PB4（5V耐受，开漏输出）
class WS2812Strip {
public:
  WS2812Strip(uint8_t pin, uint16_t numLeds);
  void begin();
  void setColor(uint16_t index, uint8_t r, uint8_t g, uint8_t b);
  void fill(uint8_t r, uint8_t g, uint8_t b);
  void clear();
  void show();
  void setBrightness(uint8_t brightness);
private:
  Adafruit_NeoPixel _strip;
};`,
        source: `\
#include "ws2812.h"

WS2812Strip::WS2812Strip(uint8_t pin, uint16_t numLeds)
  : _strip(numLeds, pin, NEO_GRB + NEO_KHZ800) {}

void WS2812Strip::begin() {
  _strip.begin();
  _strip.setBrightness(50);  // 默认亮度 50/255，避免过亮
  _strip.show();
}

void WS2812Strip::setColor(uint16_t index, uint8_t r, uint8_t g, uint8_t b) {
  _strip.setPixelColor(index, _strip.Color(r, g, b));
}

void WS2812Strip::fill(uint8_t r, uint8_t g, uint8_t b) {
  _strip.fill(_strip.Color(r, g, b));
}

void WS2812Strip::clear() {
  _strip.clear();
}

void WS2812Strip::show() {
  _strip.show();
}

void WS2812Strip::setBrightness(uint8_t brightness) {
  _strip.setBrightness(brightness);
}`,
        usage: `\
// --- 在 setup() 中 ---
#define WS2812_PIN  PB4    // STM32F103-KIT 学习板数据引脚
#define NUM_LEDS    8      // 灯珠数量，根据实际修改

WS2812Strip strip(WS2812_PIN, NUM_LEDS);
strip.begin();

// --- 在 loop() 中 ---
// 全红
strip.fill(255, 0, 0);
strip.show();
delay(500);

// 逐颗绿色流水
strip.clear();
for (int i = 0; i < NUM_LEDS; i++) {
  strip.setColor(i, 0, 255, 0);
  strip.show();
  delay(100);
  strip.setColor(i, 0, 0, 0);
}`,
      },
      platformio: {
        dependencies: [
          'adafruit/Adafruit NeoPixel@^1.12.3',
        ],
        header: `\
#pragma once
#include <Adafruit_NeoPixel.h>

class WS2812Strip {
public:
  WS2812Strip(uint8_t pin, uint16_t numLeds);
  void begin();
  void setColor(uint16_t index, uint8_t r, uint8_t g, uint8_t b);
  void fill(uint8_t r, uint8_t g, uint8_t b);
  void clear();
  void show();
  void setBrightness(uint8_t brightness);
private:
  Adafruit_NeoPixel _strip;
};`,
        source: `\
#include "ws2812.h"

WS2812Strip::WS2812Strip(uint8_t pin, uint16_t numLeds)
  : _strip(numLeds, pin, NEO_GRB + NEO_KHZ800) {}

void WS2812Strip::begin() {
  _strip.begin();
  _strip.setBrightness(50);
  _strip.show();
}

void WS2812Strip::setColor(uint16_t index, uint8_t r, uint8_t g, uint8_t b) {
  _strip.setPixelColor(index, _strip.Color(r, g, b));
}

void WS2812Strip::fill(uint8_t r, uint8_t g, uint8_t b) {
  _strip.fill(_strip.Color(r, g, b));
}

void WS2812Strip::clear() { _strip.clear(); }
void WS2812Strip::show()  { _strip.show();  }
void WS2812Strip::setBrightness(uint8_t b) { _strip.setBrightness(b); }`,
        usage: `\
#define WS2812_PIN  PB4
#define NUM_LEDS    8

WS2812Strip strip(WS2812_PIN, NUM_LEDS);

void setup() {
  strip.begin();
}

void loop() {
  strip.fill(255, 0, 0); strip.show(); delay(500);
  strip.fill(0, 255, 0); strip.show(); delay(500);
  strip.fill(0, 0, 255); strip.show(); delay(500);
  strip.clear();         strip.show(); delay(500);
}`,
      },
    },
  },

  // ── HC-SR04 超声波测距 ────────────────────────────────────────────────────────
  {
    id: 'hcsr04',
    name: 'HC-SR04 超声波测距',
    interface: 'GPIO',
    matchKeywords: ['hc-sr04', 'hcsr04', 'hc_sr04', '超声波', '测距', 'ultrasonic'],
    apiDoc: `HC-SR04 驱动 API：
- hcsr04_init(trig_pin, echo_pin)：初始化引脚方向
- hcsr04_measure_cm()：发送 10µs 触发脉冲，测量回波时间，返回距离（cm），超时返回 -1
- 测量范围：2~400cm；盲区 < 2cm
- 触发：TRIG 拉高 ≥ 10µs 后拉低
- 计算：distance_cm = pulse_duration_us / 58.0（声速 340m/s at 20°C）
- STM32F103-KIT：TRIG = PA10，ECHO = PA11`,
    templates: {
      arduino: {
        dependencies: [],
        header: `\
#pragma once
#include <Arduino.h>

// HC-SR04 超声波测距驱动
// STM32F103-KIT: TRIG = PA10, ECHO = PA11
class HCSR04 {
public:
  HCSR04(uint8_t trigPin, uint8_t echoPin);
  void begin();
  float measureCm();    // 返回距离（cm），超时返回 -1
private:
  uint8_t _trig, _echo;
};`,
        source: `\
#include "hcsr04.h"

HCSR04::HCSR04(uint8_t trigPin, uint8_t echoPin)
  : _trig(trigPin), _echo(echoPin) {}

void HCSR04::begin() {
  pinMode(_trig, OUTPUT);
  pinMode(_echo, INPUT);
  digitalWrite(_trig, LOW);
}

float HCSR04::measureCm() {
  // 发送 10µs 触发脉冲
  digitalWrite(_trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(_trig, LOW);

  // 等待回波（超时 30ms）
  unsigned long duration = pulseIn(_echo, HIGH, 30000UL);
  if (duration == 0) return -1.0f;
  return duration / 58.0f;
}`,
        usage: `\
// --- 在 setup() 中 ---
HCSR04 sonar(PA10, PA11);  // STM32F103-KIT: TRIG=PA10, ECHO=PA11
sonar.begin();
Serial.begin(115200);

// --- 在 loop() 中 ---
float dist = sonar.measureCm();
if (dist < 0) {
  Serial.println("Out of range");
} else {
  Serial.print("Distance: ");
  Serial.print(dist, 1);
  Serial.println(" cm");
}
delay(200);`,
      },
      platformio: {
        dependencies: [],
        header: `\
#pragma once
#include <Arduino.h>

class HCSR04 {
public:
  HCSR04(uint8_t trigPin, uint8_t echoPin);
  void begin();
  float measureCm();
private:
  uint8_t _trig, _echo;
};`,
        source: `\
#include "hcsr04.h"

HCSR04::HCSR04(uint8_t trigPin, uint8_t echoPin)
  : _trig(trigPin), _echo(echoPin) {}

void HCSR04::begin() {
  pinMode(_trig, OUTPUT);
  pinMode(_echo, INPUT);
  digitalWrite(_trig, LOW);
}

float HCSR04::measureCm() {
  digitalWrite(_trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(_trig, LOW);
  unsigned long duration = pulseIn(_echo, HIGH, 30000UL);
  if (duration == 0) return -1.0f;
  return duration / 58.0f;
}`,
        usage: `\
HCSR04 sonar(PA10, PA11);

void setup() {
  sonar.begin();
  Serial.begin(115200);
}

void loop() {
  float d = sonar.measureCm();
  if (d < 0) Serial.println("Timeout");
  else { Serial.print(d, 1); Serial.println(" cm"); }
  delay(200);
}`,
      },
    },
  },

  // ── 无源蜂鸣器（PWM 驱动）────────────────────────────────────────────────────
  {
    id: 'buzzer',
    name: '无源蜂鸣器（PWM）',
    interface: 'GPIO',
    matchKeywords: ['蜂鸣器', 'buzzer', 'passive buzzer', '无源蜂鸣器', 'beeper'],
    apiDoc: `无源蜂鸣器驱动 API（必须使用 PWM，禁止直接 GPIO High）：
- buzzer_init(pin)：初始化 PWM 引脚
- buzzer_tone(freq_hz)：以指定频率发声（0 停止）
- buzzer_off()：关闭蜂鸣器
- buzzer_beep(freq, duration_ms)：鸣响指定时长后自动停止
- 常用音符频率：C4=262Hz, D4=294Hz, E4=330Hz, G4=392Hz, A4=440Hz
- STM32F103-KIT：引脚 PB9（TIM4_CH4），必须用 tone() / analogWrite() PWM 驱动
- 注意：直接 digitalWrite(HIGH) 无声，必须用频率驱动`,
    templates: {
      arduino: {
        dependencies: [],
        header: `\
#pragma once
#include <Arduino.h>

// 无源蜂鸣器 PWM 驱动
// STM32F103-KIT: BUZZER_PIN = PB9（TIM4_CH4）
// 必须使用 tone() 驱动，不可 digitalWrite HIGH
class Buzzer {
public:
  explicit Buzzer(uint8_t pin);
  void begin();
  void tone(uint16_t freq);       // 持续发声（freq=0 停止）
  void off();                     // 关闭
  void beep(uint16_t freq, uint16_t durationMs);  // 鸣响后自动停止
private:
  uint8_t _pin;
};`,
        source: `\
#include "buzzer.h"

Buzzer::Buzzer(uint8_t pin) : _pin(pin) {}

void Buzzer::begin() {
  pinMode(_pin, OUTPUT);
  ::noTone(_pin);
}

void Buzzer::tone(uint16_t freq) {
  if (freq == 0) { ::noTone(_pin); return; }
  ::tone(_pin, freq);
}

void Buzzer::off() {
  ::noTone(_pin);
}

void Buzzer::beep(uint16_t freq, uint16_t durationMs) {
  ::tone(_pin, freq, durationMs);
}`,
        usage: `\
// --- 在 setup() 中 ---
Buzzer buzzer(PB9);   // STM32F103-KIT: PB9 = TIM4_CH4
buzzer.begin();

// --- 在 loop() 中 ---
// 播放开机提示音
buzzer.beep(1000, 100);  // 1kHz，100ms
delay(150);
buzzer.beep(1500, 100);  // 1.5kHz，100ms
delay(150);
buzzer.beep(2000, 200);  // 2kHz，200ms
delay(1000);`,
      },
      platformio: {
        dependencies: [],
        header: `\
#pragma once
#include <Arduino.h>

class Buzzer {
public:
  explicit Buzzer(uint8_t pin);
  void begin();
  void tone(uint16_t freq);
  void off();
  void beep(uint16_t freq, uint16_t durationMs);
private:
  uint8_t _pin;
};`,
        source: `\
#include "buzzer.h"

Buzzer::Buzzer(uint8_t pin) : _pin(pin) {}

void Buzzer::begin() {
  pinMode(_pin, OUTPUT);
  ::noTone(_pin);
}

void Buzzer::tone(uint16_t freq) {
  if (freq == 0) { ::noTone(_pin); return; }
  ::tone(_pin, freq);
}

void Buzzer::off() { ::noTone(_pin); }

void Buzzer::beep(uint16_t freq, uint16_t durationMs) {
  ::tone(_pin, freq, durationMs);
}`,
        usage: `\
Buzzer buzzer(PB9);

void setup() {
  buzzer.begin();
  buzzer.beep(1000, 200);  // 开机提示
}

void loop() {
  // 警报音：500Hz 与 1000Hz 交替
  buzzer.beep(500,  300); delay(400);
  buzzer.beep(1000, 300); delay(400);
}`,
      },
    },
  },

  // ── 舵机（PWM 50Hz）───────────────────────────────────────────────────────────
  {
    id: 'servo',
    name: '舵机（PWM 50Hz）',
    interface: 'GPIO',
    matchKeywords: ['舵机', 'servo', 'sg90', 'mg90', 'mg995', 'servo motor'],
    apiDoc: `舵机驱动 API（Arduino Servo 库）：
- Servo servo; servo.attach(pin)：挂载引脚（自动输出 50Hz PWM）
- servo.write(angle)：设置角度（0~180°）
- servo.writeMicroseconds(us)：精确设置脉宽（500~2500µs）
- servo.read()：读取当前角度
- servo.detach()：断开 PWM 输出（引脚变为普通 GPIO）
- 典型脉宽：0° ≈ 500µs，90° ≈ 1500µs，180° ≈ 2500µs
- STM32F103-KIT：引脚 PB8（TIM4_CH3）；舵机需 5V 独立供电`,
    templates: {
      arduino: {
        dependencies: [
          'Servo（Arduino 内置库，无需额外安装）',
        ],
        header: `\
#pragma once
#include <Arduino.h>
#include <Servo.h>

// 舵机 PWM 驱动封装
// STM32F103-KIT: SERVO_PIN = PB8（TIM4_CH3），5V 独立供电
class ServoMotor {
public:
  explicit ServoMotor(uint8_t pin);
  void begin();
  void setAngle(uint8_t angle);    // 0 ~ 180 度
  uint8_t getAngle() const;
  void sweep(uint8_t from, uint8_t to, uint16_t stepDelay);
private:
  uint8_t _pin;
  Servo   _servo;
};`,
        source: `\
#include "servo_motor.h"

ServoMotor::ServoMotor(uint8_t pin) : _pin(pin) {}

void ServoMotor::begin() {
  _servo.attach(_pin, 500, 2500);  // 500~2500µs 适配大多数舵机
  _servo.write(90);                // 默认居中
}

void ServoMotor::setAngle(uint8_t angle) {
  angle = constrain(angle, 0, 180);
  _servo.write(angle);
}

uint8_t ServoMotor::getAngle() const {
  return (uint8_t)_servo.read();
}

void ServoMotor::sweep(uint8_t from, uint8_t to, uint16_t stepDelay) {
  if (from <= to) {
    for (uint8_t a = from; a <= to; a++) { _servo.write(a); delay(stepDelay); }
  } else {
    for (int a = from; a >= to; a--)   { _servo.write(a); delay(stepDelay); }
  }
}`,
        usage: `\
// --- 在 setup() 中 ---
ServoMotor servo(PB8);  // STM32F103-KIT: PB8 = TIM4_CH3
servo.begin();

// --- 在 loop() 中 ---
servo.setAngle(0);    delay(500);
servo.setAngle(90);   delay(500);
servo.setAngle(180);  delay(500);
servo.sweep(180, 0, 10);  // 从 180° 扫回 0°，每步 10ms`,
      },
      platformio: {
        dependencies: [
          'arduino-libraries/Servo@^1.2.1',
        ],
        header: `\
#pragma once
#include <Arduino.h>
#include <Servo.h>

class ServoMotor {
public:
  explicit ServoMotor(uint8_t pin);
  void begin();
  void setAngle(uint8_t angle);
  uint8_t getAngle() const;
  void sweep(uint8_t from, uint8_t to, uint16_t stepDelay);
private:
  uint8_t _pin;
  Servo   _servo;
};`,
        source: `\
#include "servo_motor.h"

ServoMotor::ServoMotor(uint8_t pin) : _pin(pin) {}

void ServoMotor::begin() {
  _servo.attach(_pin, 500, 2500);
  _servo.write(90);
}

void ServoMotor::setAngle(uint8_t angle) {
  _servo.write(constrain(angle, 0, 180));
}

uint8_t ServoMotor::getAngle() const {
  return (uint8_t)_servo.read();
}

void ServoMotor::sweep(uint8_t from, uint8_t to, uint16_t stepDelay) {
  if (from <= to) {
    for (uint8_t a = from; a <= to; a++) { _servo.write(a); delay(stepDelay); }
  } else {
    for (int a = from; a >= to; a--)   { _servo.write(a); delay(stepDelay); }
  }
}`,
        usage: `\
ServoMotor servo(PB8);

void setup() {
  servo.begin();
}

void loop() {
  servo.sweep(0, 180, 10);
  servo.sweep(180, 0, 10);
}`,
      },
    },
  },

  // ── DRV8833 双路电机驱动 ──────────────────────────────────────────────────────
  {
    id: 'drv8833',
    name: 'DRV8833 双路直流电机驱动',
    interface: 'GPIO',
    matchKeywords: ['drv8833', '电机驱动', 'motor driver', '直流电机', 'dc motor', '马达'],
    apiDoc: `DRV8833 电机驱动 API：
- drv_init(in1, in2, in3, in4)：初始化 4 个控制引脚（IN1/IN2 控制电机A，IN3/IN4 控制电机B）
- drv_forward_a(speed)：电机A正转（speed 0~255，PWM 或 GPIO HIGH）
- drv_reverse_a(speed)：电机A反转
- drv_stop_a()：电机A停止（滑行 coast：两路同 LOW）
- drv_brake_a()：电机A制动（两路同 HIGH，快速停止）
- 同理 _b() 系列控制电机B
- STM32F103-KIT：IN1=PA0，IN2=PA1（电机A），IN3/IN4 如有需要接其他引脚
- 注意：DRV8833 VM 电源范围 2.7V~10.8V，可直接接 5V 或锂电`,
    templates: {
      arduino: {
        dependencies: [],
        header: `\
#pragma once
#include <Arduino.h>

// DRV8833 双路直流电机驱动
// STM32F103-KIT: IN1=PA0, IN2=PA1（电机A）
// IN1 IN2 → 状态：00=Coast, 10=正转, 01=反转, 11=制动
class DRV8833 {
public:
  DRV8833(uint8_t in1, uint8_t in2, uint8_t in3 = 255, uint8_t in4 = 255);
  void begin();
  // 电机 A
  void forwardA(uint8_t speed = 255);
  void reverseA(uint8_t speed = 255);
  void stopA();   // coast（滑行停止）
  void brakeA();  // brake（强制制动）
  // 电机 B
  void forwardB(uint8_t speed = 255);
  void reverseB(uint8_t speed = 255);
  void stopB();
  void brakeB();
private:
  uint8_t _in1, _in2, _in3, _in4;
  bool    _hasBridge;
};`,
        source: `\
#include "drv8833.h"

DRV8833::DRV8833(uint8_t in1, uint8_t in2, uint8_t in3, uint8_t in4)
  : _in1(in1), _in2(in2), _in3(in3), _in4(in4),
    _hasBridge(in3 != 255 && in4 != 255) {}

void DRV8833::begin() {
  pinMode(_in1, OUTPUT); pinMode(_in2, OUTPUT);
  digitalWrite(_in1, LOW); digitalWrite(_in2, LOW);
  if (_hasBridge) {
    pinMode(_in3, OUTPUT); pinMode(_in4, OUTPUT);
    digitalWrite(_in3, LOW); digitalWrite(_in4, LOW);
  }
}

void DRV8833::forwardA(uint8_t speed) {
  analogWrite(_in1, speed); digitalWrite(_in2, LOW);
}
void DRV8833::reverseA(uint8_t speed) {
  digitalWrite(_in1, LOW); analogWrite(_in2, speed);
}
void DRV8833::stopA()  { digitalWrite(_in1, LOW);  digitalWrite(_in2, LOW);  }
void DRV8833::brakeA() { digitalWrite(_in1, HIGH); digitalWrite(_in2, HIGH); }

void DRV8833::forwardB(uint8_t speed) {
  if (!_hasBridge) return;
  analogWrite(_in3, speed); digitalWrite(_in4, LOW);
}
void DRV8833::reverseB(uint8_t speed) {
  if (!_hasBridge) return;
  digitalWrite(_in3, LOW); analogWrite(_in4, speed);
}
void DRV8833::stopB()  { if (_hasBridge) { digitalWrite(_in3, LOW);  digitalWrite(_in4, LOW);  } }
void DRV8833::brakeB() { if (_hasBridge) { digitalWrite(_in3, HIGH); digitalWrite(_in4, HIGH); } }`,
        usage: `\
// --- 在 setup() 中 ---
// STM32F103-KIT: IN1=PA0, IN2=PA1（电机A）
DRV8833 motor(PA0, PA1);
motor.begin();

// --- 在 loop() 中 ---
motor.forwardA(200);   // 正转，约 78% 速度
delay(1000);
motor.stopA();         // 滑行停止
delay(500);
motor.reverseA(150);   // 反转，约 59% 速度
delay(1000);
motor.brakeA();        // 强制制动
delay(1000);`,
      },
      platformio: {
        dependencies: [],
        header: `\
#pragma once
#include <Arduino.h>

class DRV8833 {
public:
  DRV8833(uint8_t in1, uint8_t in2, uint8_t in3 = 255, uint8_t in4 = 255);
  void begin();
  void forwardA(uint8_t speed = 255);
  void reverseA(uint8_t speed = 255);
  void stopA();
  void brakeA();
  void forwardB(uint8_t speed = 255);
  void reverseB(uint8_t speed = 255);
  void stopB();
  void brakeB();
private:
  uint8_t _in1, _in2, _in3, _in4;
  bool    _hasBridge;
};`,
        source: `\
#include "drv8833.h"

DRV8833::DRV8833(uint8_t in1, uint8_t in2, uint8_t in3, uint8_t in4)
  : _in1(in1), _in2(in2), _in3(in3), _in4(in4),
    _hasBridge(in3 != 255 && in4 != 255) {}

void DRV8833::begin() {
  pinMode(_in1, OUTPUT); pinMode(_in2, OUTPUT);
  digitalWrite(_in1, LOW); digitalWrite(_in2, LOW);
  if (_hasBridge) {
    pinMode(_in3, OUTPUT); pinMode(_in4, OUTPUT);
    digitalWrite(_in3, LOW); digitalWrite(_in4, LOW);
  }
}

void DRV8833::forwardA(uint8_t speed) { analogWrite(_in1, speed); digitalWrite(_in2, LOW); }
void DRV8833::reverseA(uint8_t speed) { digitalWrite(_in1, LOW); analogWrite(_in2, speed); }
void DRV8833::stopA()  { digitalWrite(_in1, LOW);  digitalWrite(_in2, LOW);  }
void DRV8833::brakeA() { digitalWrite(_in1, HIGH); digitalWrite(_in2, HIGH); }

void DRV8833::forwardB(uint8_t speed) { if (_hasBridge) { analogWrite(_in3, speed); digitalWrite(_in4, LOW); } }
void DRV8833::reverseB(uint8_t speed) { if (_hasBridge) { digitalWrite(_in3, LOW); analogWrite(_in4, speed); } }
void DRV8833::stopB()  { if (_hasBridge) { digitalWrite(_in3, LOW);  digitalWrite(_in4, LOW);  } }
void DRV8833::brakeB() { if (_hasBridge) { digitalWrite(_in3, HIGH); digitalWrite(_in4, HIGH); } }`,
        usage: `\
DRV8833 motor(PA0, PA1);

void setup() {
  motor.begin();
}

void loop() {
  motor.forwardA(200); delay(1000);
  motor.stopA();       delay(500);
  motor.reverseA(150); delay(1000);
  motor.brakeA();      delay(1000);
}`,
      },
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 匹配与格式化函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 根据硬件方案自动匹配需要的驱动模板
 * 从 BOM 名称/型号、方案描述、引脚连接说明中检测关键词
 */
export function matchDriverTemplates(scheme: HardwareScheme): DriverTemplate[] {
  // 汇总所有可检索文本（统一小写）
  const searchText = [
    scheme.description,
    ...scheme.bom.map(b => `${b.name} ${b.model}`),
    ...scheme.pins.map(p => p.connectedTo),
  ].join(' ').toLowerCase()

  return DRIVER_TEMPLATES.filter(drv =>
    drv.matchKeywords.some(kw => searchText.includes(kw))
  )
}

/**
 * 将匹配到的驱动模板格式化为可注入 AI prompt 的文本
 * 当无匹配驱动时返回空字符串
 */
export function driverTemplatesToPromptText(
  templates: DriverTemplate[],
  format: ProjectFormat,
): string {
  if (templates.length === 0) return ''

  const lines: string[] = [
    '## 已验证驱动模板（强制要求：必须使用以下驱动代码，禁止自行编写驱动逻辑）',
    '以下驱��已在真实硬件验证，复制使用即可，不允许修改驱动实现文件的核心逻辑。',
    '',
  ]

  for (const drv of templates) {
    const code = drv.templates[format]
    lines.push(`### ${drv.name}（${drv.interface} 接口）`)

    if (code) {
      if (code.dependencies.length > 0) {
        lines.push(`#### 所需依赖库`)
        code.dependencies.forEach(d => lines.push(`- ${d}`))
        lines.push('')
      }
      lines.push(`#### 驱动头文件`)
      lines.push('```c')
      lines.push(code.header.trim())
      lines.push('```')
      lines.push('')
      lines.push(`#### 驱动实现文件`)
      lines.push('```c')
      lines.push(code.source.trim())
      lines.push('```')
      lines.push('')
      lines.push(`#### 调用示例（main 中如何使用）`)
      lines.push('```c')
      lines.push(code.usage.trim())
      lines.push('```')
    }

    lines.push(`#### API 说明`)
    lines.push(drv.apiDoc)
    lines.push('')
  }

  return lines.join('\n')
}
