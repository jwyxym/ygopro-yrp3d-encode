import fs from 'fs';
import path from 'path';

import {
  YGOProMessages,
  YGOProMsgStart,
  YGOProMsgWaiting,
  YGOProStocChat,
  YGOProStocReplay,
} from 'ygopro-msg-encode';

import {
  YGOProYrp3d,
  YRP3D_SIBYL_CHAT,
  YRP3D_SIBYL_NAME,
  YRP3D_SIBYL_QUIT,
  YRP3D_SIBYL_REPLAY,
  readYrp3dPackets,
  writeYrp3dPackets,
} from '../index';

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests', 'sample.yrp3d');

describe('yrp3d raw packets', () => {
  it('reads and writes packet streams', () => {
    const packets = [
      { type: 4, payload: Uint8Array.from([1, 2, 3]) },
      { type: 3, payload: new Uint8Array(0) },
    ];

    const bytes = writeYrp3dPackets(packets);

    expect(readYrp3dPackets(bytes)).toEqual(packets);
  });

  it('rejects truncated packet bodies', () => {
    expect(() =>
      readYrp3dPackets(Uint8Array.from([4, 10, 0, 0, 0, 1])),
    ).toThrow('Invalid yrp3d packet length');
  });
});

describe('YGOProYrp3d', () => {
  it('parses the sample replay', () => {
    const payload = fs.readFileSync(FIXTURE);
    const yrp3d = new YGOProYrp3d().fromYrp3d(payload);

    const chats = yrp3d.messages.filter(
      (message) => message instanceof YGOProStocChat,
    );
    const replays = yrp3d.messages.filter(
      (message) => message instanceof YGOProStocReplay,
    );

    expect(yrp3d.name0).toBeTruthy();
    expect(yrp3d.masterRule).toBeGreaterThan(0);
    expect(chats).toHaveLength(312);
    expect(replays).toHaveLength(1);

    const replay = yrp3d.extractYrp();
    expect(replay).toBeDefined();
    expect(replay?.hostName).toBe('闪亮史莱姆Pro');
    expect(replay?.clientName).toBe('灰鸦');
    expect(replay?.startLp).toBe(16000);
    expect(replay?.responses.length).toBe(2085);
  });

  it('round-trips parsed messages and name fields', () => {
    const payload = fs.readFileSync(FIXTURE);
    const yrp3d = new YGOProYrp3d().fromYrp3d(payload);
    const remade = new YGOProYrp3d().fromYrp3d(yrp3d.toYrp3d());

    expect(remade.name0).toBe(yrp3d.name0);
    expect(remade.name1).toBe(yrp3d.name1);
    expect(remade.masterRule).toBe(yrp3d.masterRule);
    expect(count(remade, YGOProStocChat)).toBe(count(yrp3d, YGOProStocChat));
    expect(count(remade, YGOProStocReplay)).toBe(
      count(yrp3d, YGOProStocReplay),
    );
    expect(remade.messages.length).toBe(yrp3d.messages.length);
  });

  it('reads only the first name packet and ignores quit packets', () => {
    const start = makeStartMessage();
    const first = new YGOProYrp3d({
      name0: 'first',
      name1: 'p2',
      messages: [start],
    }).toYrp3d();
    const second = new YGOProYrp3d({
      name0: 'second',
      name1: 'p2',
      messages: [],
    }).toYrp3d();
    const packets = [
      ...readYrp3dPackets(first),
      ...readYrp3dPackets(second).filter(
        (packet) => packet.type === YRP3D_SIBYL_NAME,
      ),
      { type: YRP3D_SIBYL_QUIT, payload: new Uint8Array(0) },
    ];

    const parsed = new YGOProYrp3d().fromYrp3d(writeYrp3dPackets(packets));

    expect(parsed.name0).toBe('first');
    expect(parsed.messages.some((message) => message.identifier === 236)).toBe(
      false,
    );
  });

  it('writes name after the first Start message', () => {
    const yrp3d = new YGOProYrp3d({
      name0: 'p1',
      name1: 'p2',
      messages: [makeStartMessage(), new YGOProMsgWaiting()],
    });

    const packets = readYrp3dPackets(yrp3d.toYrp3d());

    expect(packets[0]?.type).toBe(4);
    expect(packets[1]?.type).toBe(YRP3D_SIBYL_NAME);
  });

  it('writes name first when there is no Start message', () => {
    const yrp3d = new YGOProYrp3d({
      name0: 'p1',
      name1: 'p2',
      messages: [new YGOProMsgWaiting()],
    });

    const packets = readYrp3dPackets(yrp3d.toYrp3d());

    expect(packets[0]?.type).toBe(YRP3D_SIBYL_NAME);
    expect(packets[1]?.type).toBe(3);
  });

  it('reads both chat payload variants and writes the Unity-compatible variant', () => {
    const standardChat = new YGOProStocChat().fromPartial({
      player_type: 1,
      msg: 'hello',
    });
    const unityChatPayload = Uint8Array.from([
      2, 0, 0, 0, 104, 0, 105, 0, 0, 0,
    ]);
    const payload = writeYrp3dPackets([
      { type: YRP3D_SIBYL_CHAT, payload: standardChat.toPayload() },
      { type: YRP3D_SIBYL_CHAT, payload: unityChatPayload },
    ]);

    const parsed = new YGOProYrp3d().fromYrp3d(payload);
    const chats = parsed.messages.filter(
      (message): message is YGOProStocChat => message instanceof YGOProStocChat,
    );

    expect(chats.map((chat) => chat.msg)).toEqual(['hello', 'hi']);
    expect(chats.map((chat) => chat.player_type)).toEqual([1, 2]);

    const packets = readYrp3dPackets(parsed.toYrp3d()).filter(
      (packet) => packet.type === YRP3D_SIBYL_CHAT,
    );
    expect(packets[0]?.payload[2]).toBe(0);
    expect(packets[0]?.payload[3]).toBe(0);
  });

  it('deep-copies constructor input', () => {
    const source = new YGOProYrp3d().fromYrp3d(fs.readFileSync(FIXTURE));
    const clone = new YGOProYrp3d(source);
    const sourceChat = source.messages.find(
      (message): message is YGOProStocChat => message instanceof YGOProStocChat,
    );
    const cloneChat = clone.messages.find(
      (message): message is YGOProStocChat => message instanceof YGOProStocChat,
    );

    source.name0 = 'changed';
    if (sourceChat) sourceChat.msg = 'changed';
    const sourceReplay = source.extractYrp();
    if (sourceReplay) sourceReplay.hostName = 'changed';

    expect(clone.name0).not.toBe('changed');
    expect(cloneChat?.msg).not.toBe('changed');
    expect(clone.extractYrp()?.hostName).not.toBe('changed');
  });

  it('ignores unknown and unparsable packets', () => {
    const payload = writeYrp3dPackets([
      { type: 250, payload: Uint8Array.from([1, 2, 3]) },
      { type: YRP3D_SIBYL_REPLAY, payload: Uint8Array.from([1, 2, 3]) },
      { type: YRP3D_SIBYL_QUIT, payload: new Uint8Array(0) },
      { type: 3, payload: new Uint8Array(0) },
    ]);

    const parsed = new YGOProYrp3d().fromYrp3d(payload);

    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toBeInstanceOf(YGOProMsgWaiting);
  });
});

function makeStartMessage(): YGOProMsgStart {
  const payload = Uint8Array.from([
    4, 1, 5, 0x80, 0x3e, 0, 0, 0x80, 0x3e, 0, 0, 40, 0, 15, 0, 40, 0, 15, 0,
  ]);
  const message = YGOProMessages.getInstanceFromPayload(payload);
  if (!(message instanceof YGOProMsgStart)) {
    throw new Error('failed to build Start message');
  }
  return message;
}

function count(
  yrp3d: YGOProYrp3d,
  Constructor: typeof YGOProStocChat | typeof YGOProStocReplay,
): number {
  return yrp3d.messages.filter((message) => message instanceof Constructor)
    .length;
}
