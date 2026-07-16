#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <Wire.h>

#include "config.example.h"

#define DHT_PIN 4
#define DHT_TYPE DHT22
#define OLED_SDA 21
#define OLED_SCL 22
#define STATUS_LED_PIN 2

Adafruit_SSD1306 display(128, 64, &Wire, -1);
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient networkClient;
PubSubClient mqttClient(networkClient);

unsigned long lastPublishAt = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  }
  digitalWrite(STATUS_LED_PIN, HIGH);
}

void connectMqtt() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  while (!mqttClient.connected()) {
    mqttClient.connect("metacore-demo-node");
    if (!mqttClient.connected()) delay(1000);
  }
}

void showEnvironment(float temperature, float humidity) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("MetaCore IoT Node");
  display.setCursor(0, 22);
  display.printf("Temp: %.1f C", temperature);
  display.setCursor(0, 40);
  display.printf("Humi: %.1f %%", humidity);
  display.display();
}

void publishEnvironment(float temperature, float humidity) {
  char payload[96];
  snprintf(payload, sizeof(payload), "{\"temperature\":%.1f,\"humidity\":%.1f}", temperature, humidity);
  mqttClient.publish(MQTT_TOPIC, payload, true);
}

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  Wire.begin(OLED_SDA, OLED_SCL);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  dht.begin();
  connectWiFi();
  connectMqtt();
}

void loop() {
  if (!mqttClient.connected()) connectMqtt();
  mqttClient.loop();

  if (millis() - lastPublishAt < 5000) return;
  lastPublishAt = millis();

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  if (isnan(temperature) || isnan(humidity)) return;

  showEnvironment(temperature, humidity);
  publishEnvironment(temperature, humidity);
}

