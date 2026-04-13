import {
  YGOProMessages,
  YGOProMsgBase,
  YGOProStocChat,
  YGOProStocReplay,
} from 'ygopro-msg-encode';
import { YGOProYrp } from 'ygopro-yrp-encode';

import {
  YRP3D_SIBYL_CHAT,
  YRP3D_SIBYL_NAME,
  YRP3D_SIBYL_QUIT,
  YRP3D_SIBYL_REPLAY,
} from './constants';
import {
  readSibylChat,
  readSibylName,
  writeSibylChat,
  writeSibylName,
} from './sibyl';
import type { YGOProYrp3dLike, YGOProYrp3dMessage } from './ygopro-yrp3d-like';
import {
  readYrp3dPackets,
  writeYrp3dPackets,
  type YGOProYrp3dRawPacket,
} from './yrp3d-io';
import { concatBytes } from './utility/bytes';

export class YGOProYrp3d {
  constructor(init: Partial<YGOProYrp3dLike> = {}) {
    if (init.name0 !== undefined) this.name0 = init.name0;
    if (init.name0Tag !== undefined) this.name0Tag = init.name0Tag;
    if (init.name0Current !== undefined) this.name0Current = init.name0Current;
    if (init.name1 !== undefined) this.name1 = init.name1;
    if (init.name1Tag !== undefined) this.name1Tag = init.name1Tag;
    if (init.name1Current !== undefined) this.name1Current = init.name1Current;
    if (init.masterRule !== undefined) this.masterRule = init.masterRule;

    if (init.messages) {
      this.messages = init.messages.map((message) => message.copy());
    }
  }

  name0 = '';
  name0Tag = '';
  name0Current = '';
  name1 = '';
  name1Tag = '';
  name1Current = '';
  masterRule = 3;
  messages: YGOProYrp3dMessage[] = [];

  fromYrp3d(payload: Uint8Array): this {
    this.reset();
    let hasName = false;

    for (const packet of readYrp3dPackets(payload)) {
      try {
        if (packet.type === YRP3D_SIBYL_CHAT) {
          this.messages.push(readSibylChat(packet.payload));
          continue;
        }

        if (packet.type === YRP3D_SIBYL_REPLAY) {
          this.messages.push(
            new YGOProStocReplay().fromPayload(packet.payload),
          );
          continue;
        }

        if (packet.type === YRP3D_SIBYL_NAME) {
          if (!hasName) {
            this.applyName(readSibylName(packet.payload));
            hasName = true;
          }
          continue;
        }

        if (packet.type === YRP3D_SIBYL_QUIT) {
          continue;
        }

        const message = YGOProMessages.getInstanceFromPayload(
          concatBytes([Uint8Array.of(packet.type), packet.payload]),
        );
        if (message) {
          this.messages.push(message);
        }
      } catch {
        // Invalid or unknown packets are intentionally ignored in the high-level API.
      }
    }

    return this;
  }

  toYrp3d(): Uint8Array {
    const namePacket: YGOProYrp3dRawPacket = {
      type: YRP3D_SIBYL_NAME,
      payload: writeSibylName(this.currentName()),
    };
    const packets: YGOProYrp3dRawPacket[] = [];
    let wroteName = false;

    for (const message of this.messages) {
      packets.push(this.messageToPacket(message));
      if (!wroteName && this.isStartMessage(message)) {
        packets.push(namePacket);
        wroteName = true;
      }
    }

    if (!wroteName) {
      packets.unshift(namePacket);
    }

    return writeYrp3dPackets(packets);
  }

  extractYrp(): YGOProYrp | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const message = this.messages[i];
      if (message instanceof YGOProStocReplay) {
        return message.replay;
      }
    }
    return undefined;
  }

  private reset(): void {
    this.name0 = '';
    this.name0Tag = '';
    this.name0Current = '';
    this.name1 = '';
    this.name1Tag = '';
    this.name1Current = '';
    this.masterRule = 3;
    this.messages = [];
  }

  private applyName(name: ReturnType<typeof readSibylName>): void {
    this.name0 = name.name0;
    this.name0Tag = name.name0Tag;
    this.name0Current = name.name0Current;
    this.name1 = name.name1;
    this.name1Tag = name.name1Tag;
    this.name1Current = name.name1Current;
    this.masterRule = name.masterRule;
  }

  private currentName(): ReturnType<typeof readSibylName> {
    return {
      name0: this.name0,
      name0Tag: this.name0Tag,
      name0Current: this.name0Current,
      name1: this.name1,
      name1Tag: this.name1Tag,
      name1Current: this.name1Current,
      masterRule: this.masterRule,
    };
  }

  private messageToPacket(message: YGOProYrp3dMessage): YGOProYrp3dRawPacket {
    if (message instanceof YGOProStocChat) {
      return {
        type: YRP3D_SIBYL_CHAT,
        payload: writeSibylChat(message),
      };
    }

    if (message instanceof YGOProStocReplay) {
      return {
        type: YRP3D_SIBYL_REPLAY,
        payload: message.toPayload(),
      };
    }

    const payload = message.toPayload();
    return {
      type: payload[0] ?? 0,
      payload: payload.subarray(1),
    };
  }

  private isStartMessage(message: YGOProYrp3dMessage): boolean {
    return message instanceof YGOProMsgBase && message.identifier === 4;
  }
}
