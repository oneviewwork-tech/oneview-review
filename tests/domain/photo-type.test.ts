import { describe, it, expect } from "vitest";
import { imageTypeOf } from "@/services/people/photo";

const buf = (...b: number[]) => new Uint8Array([...b, ...Array(12).fill(0)]).buffer;
const text = (s: string) => new TextEncoder().encode(s.padEnd(12, "\0")).buffer as ArrayBuffer;

describe("photo content type", () => {
  it("trusts an image type storage already gave", () => expect(imageTypeOf(buf(0), "image/png")).toBe("image/png"));
  it("reads WebP, JPEG and PNG from the bytes when storage says text/plain", () => {
    expect(imageTypeOf(text("RIFF\0\0\0\0WEBP"), "text/plain;charset=UTF-8")).toBe("image/webp");
    expect(imageTypeOf(buf(0xff, 0xd8, 0xff), "text/plain")).toBe("image/jpeg");
    expect(imageTypeOf(buf(0x89, 0x50, 0x4e, 0x47), null)).toBe("image/png");
  });
});
