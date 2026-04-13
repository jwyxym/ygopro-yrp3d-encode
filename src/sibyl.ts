import { YGOProStocChat } from 'ygopro-msg-encode';

import { YRP3D_NAME_FIELD_BYTES, YRP3D_NAME_FIELD_CHARS } from './constants';
import { ByteReader, ByteWriter } from './utility/byte-io';
import {
  decodeUtf16leZ,
  encodeUtf16leFixed,
  encodeUtf16leZ,
} from './utility/utf16';

export type YGOProYrp3dNameInfo = {
  name0: string;
  name0Tag: string;
  name0Current: string;
  name1: string;
  name1Tag: string;
  name1Current: string;
  masterRule: number;
};

export function readSibylChat(payload: Uint8Array): YGOProStocChat {
  if (payload.length < 2) {
    throw new Error('sibyl_chat payload too short');
  }

  const hasUnityPadding =
    payload.length >= 4 && payload[2] === 0 && payload[3] === 0;
  if (!hasUnityPadding) {
    return new YGOProStocChat().fromPayload(payload);
  }

  const normalized = new Uint8Array(payload.length - 2);
  normalized[0] = payload[0];
  normalized[1] = payload[1];
  normalized.set(payload.subarray(4), 2);
  return new YGOProStocChat().fromPayload(normalized);
}

export function writeSibylChat(message: YGOProStocChat): Uint8Array {
  const standard = message.toPayload();
  const out = new Uint8Array(standard.length + 2);
  out[0] = standard[0] ?? 0;
  out[1] = standard[1] ?? 0;
  out[2] = 0;
  out[3] = 0;
  out.set(standard.subarray(2), 4);
  return out;
}

export function readSibylName(payload: Uint8Array): YGOProYrp3dNameInfo {
  if (payload.length < YRP3D_NAME_FIELD_BYTES * 6) {
    throw new Error('sibyl_name payload too short');
  }

  const reader = new ByteReader(payload);
  const name0 = readNameField(reader);
  const name0Tag = readNameField(reader);
  const name0Current = readNameField(reader);
  const name1 = readNameField(reader);
  const name1Tag = readNameField(reader);
  const name1Current = readNameField(reader);
  const masterRule = reader.remaining >= 4 ? reader.readInt32() : 3;

  return {
    name0,
    name0Tag,
    name0Current,
    name1,
    name1Tag,
    name1Current,
    masterRule,
  };
}

export function writeSibylName(name: YGOProYrp3dNameInfo): Uint8Array {
  const writer = new ByteWriter(YRP3D_NAME_FIELD_BYTES * 6 + 4);
  writer.writeBytes(writeNameField(name.name0));
  writer.writeBytes(writeNameField(name.name0Tag));
  writer.writeBytes(writeNameField(name.name0Current));
  writer.writeBytes(writeNameField(name.name1));
  writer.writeBytes(writeNameField(name.name1Tag));
  writer.writeBytes(writeNameField(name.name1Current));
  writer.writeInt32(name.masterRule);
  return writer.toUint8Array();
}

function readNameField(reader: ByteReader): string {
  return decodeUtf16leZ(reader.readBytes(YRP3D_NAME_FIELD_BYTES));
}

function writeNameField(value: string): Uint8Array {
  return encodeUtf16leFixed(value, YRP3D_NAME_FIELD_CHARS * 2);
}

export function writeUtf16Text(value: string): Uint8Array {
  return encodeUtf16leZ(value);
}
