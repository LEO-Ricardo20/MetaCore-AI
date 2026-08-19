import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIServiceConfig } from '@/types/ai'
import { callAI } from './client'
import { callTaskContract, parseTaskContract } from './contracts'

vi.mock('./client', () => ({ callAI: vi.fn() }))

const service: AIServiceConfig = { id: 'test', name: 'Test', provider: 'custom', apiKey: 'secret', baseURL: 'https://example.com/v1', model: 'test', enabled: true }
const parseData = (text: string) => {
  const value = JSON.parse(text)
  if (typeof value.answer !== 'number') throw new Error('answer invalid')
  return value as { answer: number }
}

beforeEach(() => vi.mocked(callAI).mockReset())

describe('AI Task Contract', () => {
  it('parses a valid versioned task envelope', () => {
    const contract = parseTaskContract(JSON.stringify({ schemaVersion: '1.0', taskType: 'test', status: 'ok', assumptions: [], openQuestions: [], risks: [], evidence: [], data: { answer: 42 }, validationHints: [] }), 'test', parseData)
    expect(contract.data.answer).toBe(42)
  })

  it('rejects schema and data validation failures', () => {
    expect(() => parseTaskContract(JSON.stringify({ schemaVersion: '2.0', taskType: 'test', status: 'ok', data: { answer: 42 } }), 'test', parseData)).toThrow(/schemaVersion/)
    expect(() => parseTaskContract(JSON.stringify({ schemaVersion: '1.0', taskType: 'test', status: 'ok', data: { answer: 'bad' } }), 'test', parseData)).toThrow(/answer invalid/)
  })

  it('repairs one invalid response before returning structured data', async () => {
    vi.mocked(callAI)
      .mockResolvedValueOnce('{"broken":')
      .mockResolvedValueOnce(JSON.stringify({ schemaVersion: '1.0', taskType: 'test', status: 'ok', assumptions: [], openQuestions: [], risks: [], evidence: [], data: { answer: 7 }, validationHints: [] }))

    const result = await callTaskContract(service, 'test', [{ role: 'user', content: 'answer' }], parseData)
    expect(result.repaired).toBe(true)
    expect(result.contract.data.answer).toBe(7)
    expect(callAI).toHaveBeenCalledTimes(2)
  })

  it('surfaces an error when repair also fails', async () => {
    vi.mocked(callAI).mockResolvedValueOnce('{"broken":').mockResolvedValueOnce('{"still":')
    await expect(callTaskContract(service, 'test', [{ role: 'user', content: 'answer' }], parseData)).rejects.toThrow(/Task Contract/)
  })
})
