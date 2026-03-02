import { describe, it, expect } from "vitest"
import { formatBytes, formatLatency, formatErrorRate, formatTimestamp } from "@/lib/metrics-utils"

describe("formatBytes", () => {
  it("formats 0 bytes", () => expect(formatBytes(0)).toBe("0 B"))
  it("formats bytes", () => expect(formatBytes(500)).toBe("500 B"))
  it("formats KB", () => expect(formatBytes(1024)).toBe("1.0 KB"))
  it("formats MB", () => expect(formatBytes(1048576)).toBe("1.0 MB"))
  it("formats GB", () => expect(formatBytes(1073741824)).toBe("1.0 GB"))
  it("formats fractional KB", () => expect(formatBytes(1536)).toBe("1.5 KB"))
})

describe("formatLatency", () => {
  it("formats sub-millisecond", () => expect(formatLatency(0.5)).toBe("0.50 ms"))
  it("formats milliseconds", () => expect(formatLatency(150)).toBe("150 ms"))
  it("formats seconds", () => expect(formatLatency(1500)).toBe("1.50 s"))
  it("formats zero", () => expect(formatLatency(0)).toBe("0 ms"))
})

describe("formatErrorRate", () => {
  it("formats zero", () => expect(formatErrorRate(0)).toBe("0.0%"))
  it("formats percentage", () => expect(formatErrorRate(0.052)).toBe("5.2%"))
  it("formats 100%", () => expect(formatErrorRate(1)).toBe("100.0%"))
})

describe("formatTimestamp", () => {
  it("shows time for 1h range", () => {
    const result = formatTimestamp("2026-03-01T10:30:00Z", "1h")
    expect(result).toContain(":")
  })
  it("shows date for 7d range", () => {
    const result = formatTimestamp("2026-03-01T10:30:00Z", "7d")
    expect(result.length).toBeGreaterThan(0)
  })
})
