import type { ProjectFormat } from './hardware'

export type Esp32Family = 'esp32' | 'esp32s3' | 'esp32c3' | 'esp32c6' | 'esp32s2'
export type Esp32PlatformioFramework = 'arduino' | 'espidf'
export type Esp32SupportLevel = 'verified-local' | 'documented' | 'unverified'

export interface Esp32ReservedPinGroup {
  pins: string[]
  reason: string
}

export interface Esp32PinPolicy {
  available: string[]
  inputOnly: string[]
  strapping: string[]
  reserved: Esp32ReservedPinGroup[]
  usbPins: string[]
  defaultPins: {
    i2c?: { sda: string; scl: string }
    spi?: { mosi: string; miso: string; sck: string; cs: string }
    uart?: { tx: string; rx: string }
  }
  adcRestrictions: string[]
}

export interface Esp32BoardProfile {
  id: string
  family: Esp32Family
  target: string
  label: string
  module: string
  description: string
  cpu: string
  flashSize: string
  flashMode: 'dio' | 'qio' | 'opi'
  psramSize: string
  usb: string
  connectivity: string[]
  platformioId: string
  platformioFrameworks: Esp32PlatformioFramework[]
  idfTarget: Esp32Family
  arduinoBoard?: string
  supportedFormats: ProjectFormat[]
  support: Partial<Record<ProjectFormat, Esp32SupportLevel>>
  defaultUploadSpeed: number
  defaultMonitorSpeed: number
  defaultPartition: string
  recommendedFor: string[]
  notes: string[]
  pinPolicy: Esp32PinPolicy
  sourceUrls: string[]
}

export interface Esp32ProjectConfig {
  family: Esp32Family
  boardId: string
  module: string
  platformioBoard: string
  platformioFramework: Esp32PlatformioFramework
  idfTarget: Esp32Family
  arduinoBoard?: string
  flashSize: string
  flashMode: Esp32BoardProfile['flashMode']
  psramSize: string
  usbMode: string
  uploadSpeed: number
  monitorSpeed: number
  partitionScheme: string
}

export interface Esp32ValidationIssue {
  severity: 'warning' | 'error'
  code: string
  message: string
  pins?: string[]
}
