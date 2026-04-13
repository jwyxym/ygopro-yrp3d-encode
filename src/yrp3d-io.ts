import { ByteReader, ByteWriter } from './utility/byte-io';

export type YGOProYrp3dRawPacket = {
  type: number;
  payload: Uint8Array;
};

export function readYrp3dPackets(payload: Uint8Array): YGOProYrp3dRawPacket[] {
  const reader = new ByteReader(payload);
  const packets: YGOProYrp3dRawPacket[] = [];

  while (reader.remaining > 0) {
    if (reader.remaining < 5) {
      throw new Error(
        `Invalid yrp3d packet header at offset ${reader.offset}: remaining=${reader.remaining}`,
      );
    }

    const type = reader.readUInt8();
    const length = reader.readUInt32();
    if (reader.remaining < length) {
      throw new Error(
        `Invalid yrp3d packet length at offset ${reader.offset - 4}: want=${length}, remaining=${reader.remaining}`,
      );
    }

    packets.push({ type, payload: reader.readBytes(length) });
  }

  return packets;
}

export function writeYrp3dPackets(packets: YGOProYrp3dRawPacket[]): Uint8Array {
  const writer = new ByteWriter();

  for (const packet of packets) {
    writer.writeUInt8(packet.type);
    writer.writeUInt32(packet.payload.length);
    writer.writeBytes(packet.payload);
  }

  return writer.toUint8Array();
}
