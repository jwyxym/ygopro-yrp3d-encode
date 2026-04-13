export class ByteReader {
  private ptr = 0;
  private readonly view: DataView;

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  get offset(): number {
    return this.ptr;
  }

  get remaining(): number {
    return this.buf.length - this.ptr;
  }

  readUInt8(): number {
    this.ensure(1);
    const value = this.view.getUint8(this.ptr);
    this.ptr += 1;
    return value;
  }

  readUInt32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.ptr, true);
    this.ptr += 4;
    return value >>> 0;
  }

  readInt32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.ptr, true);
    this.ptr += 4;
    return value | 0;
  }

  readBytes(length: number): Uint8Array {
    this.ensure(length);
    const out = this.buf.subarray(this.ptr, this.ptr + length);
    this.ptr += length;
    return out;
  }

  private ensure(length: number): void {
    if (length < 0 || this.ptr + length > this.buf.length) {
      throw new Error(
        `read out of range: want=${length}, remaining=${this.remaining}`,
      );
    }
  }
}

export class ByteWriter {
  private buf: Uint8Array;
  private view: DataView;
  private ptr = 0;

  constructor(initialSize = 256) {
    this.buf = new Uint8Array(initialSize);
    this.view = new DataView(this.buf.buffer);
  }

  toUint8Array(): Uint8Array {
    return this.buf.subarray(0, this.ptr);
  }

  writeUInt8(value: number): void {
    this.ensure(1);
    this.view.setUint8(this.ptr, value & 0xff);
    this.ptr += 1;
  }

  writeUInt32(value: number): void {
    this.ensure(4);
    this.view.setUint32(this.ptr, value >>> 0, true);
    this.ptr += 4;
  }

  writeInt32(value: number): void {
    this.ensure(4);
    this.view.setInt32(this.ptr, value | 0, true);
    this.ptr += 4;
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.ptr);
    this.ptr += bytes.length;
  }

  private ensure(length: number): void {
    const required = this.ptr + length;
    if (required <= this.buf.length) return;

    let nextLength = this.buf.length;
    while (nextLength < required) nextLength = Math.max(256, nextLength * 2);

    const next = new Uint8Array(nextLength);
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(this.buf.buffer);
  }
}
