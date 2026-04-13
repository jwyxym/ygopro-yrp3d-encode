# ygopro-yrp3d-encode

A platform-agnostic TypeScript parser and writer for YGOPro Unity `.yrp3d` replay packet files.

This package follows the API style of [`ygopro-yrp-encode`](https://github.com/purerosefallen/ygopro-yrp-encode): construct an object, call `fromYrp3d()` to parse bytes, inspect or modify fields, then call `toYrp3d()` to serialize bytes again.

It also reuses protocol classes from [`ygopro-msg-encode`](https://github.com/purerosefallen/ygopro-msg-encode). Refer to that package for detailed `YGOProMsgBase`, `YGOProStocChat`, and `YGOProStocReplay` field definitions.

## Install

```bash
npm i ygopro-yrp3d-encode
```

## Quick Start

```ts
import fs from 'fs';
import { YGOProStocChat, YGOProStocReplay } from 'ygopro-msg-encode';
import { YGOProYrp3d } from 'ygopro-yrp3d-encode';

const payload = fs.readFileSync('replay.yrp3d');
const yrp3d = new YGOProYrp3d().fromYrp3d(payload);

console.log(yrp3d.name0);
console.log(yrp3d.name1);
console.log(yrp3d.masterRule);

const chats = yrp3d.messages.filter(
  (message): message is YGOProStocChat => message instanceof YGOProStocChat,
);
console.log(chats.map((chat) => chat.msg));

const embeddedYrp = yrp3d.extractYrp();
console.log(embeddedYrp?.hostName);
console.log(embeddedYrp?.clientName);

const out = yrp3d.toYrp3d();
fs.writeFileSync('replay-remade.yrp3d', out);
```

## File Format

A `.yrp3d` file is a sequence of packets:

```text
repeat until EOF:
  uint8   packet type
  uint32  payload length, little-endian
  uint8[] payload
```

There is no file-level magic, version field, or checksum. Invalid packet lengths throw in the raw packet reader.

High-level parsing maps packet types as follows:

| Packet type | Meaning | High-level representation |
| --- | --- | --- |
| normal `GameMessage` ids | OCG/YGOPro duel messages | `YGOProMsgBase` subclass |
| `230` | `sibyl_chat` | `YGOProStocChat` |
| `231` | `sibyl_replay` | `YGOProStocReplay` |
| `235` | `sibyl_name` | `YGOProYrp3d` name fields |
| `236` | `sibyl_quit` | ignored |
| unknown or unparsable packets | unsupported data | ignored |

## Main API

### `YGOProYrp3d`

Main class for reading and writing `.yrp3d` files.

```ts
import { YGOProYrp3d } from 'ygopro-yrp3d-encode';

const yrp3d = new YGOProYrp3d();
yrp3d.fromYrp3d(bytes);
const output = yrp3d.toYrp3d();
```

#### Constructor

```ts
constructor(init?: Partial<YGOProYrp3dLike>)
```

Creates a new replay object. When `init` is provided, string fields are copied and `messages` are deep-copied via each message object's `copy()` method.

```ts
const copy = new YGOProYrp3d(existing);
copy.name0 = 'changed';
```

### Fields

```ts
name0: string;
name0Tag: string;
name0Current: string;
name1: string;
name1Tag: string;
name1Current: string;
masterRule: number;
messages: YGOProYrp3dMessage[];
```

Name fields come from the first valid `235 = sibyl_name` packet. Later name packets are ignored.

Default values:

```ts
name0 = '';
name0Tag = '';
name0Current = '';
name1 = '';
name1Tag = '';
name1Current = '';
masterRule = 3;
messages = [];
```

### `fromYrp3d()`

```ts
fromYrp3d(payload: Uint8Array): this
```

Parses `.yrp3d` bytes into this object.

Behavior:

- Clears the current object before reading.
- Reads the first valid `sibyl_name` packet into name fields.
- Parses normal `GameMessage` packets into `YGOProMsgBase` subclasses with `ygopro-msg-encode`.
- Parses `sibyl_chat` into `YGOProStocChat`.
- Parses `sibyl_replay` into `YGOProStocReplay`.
- Ignores `sibyl_quit`.
- Ignores unknown or unsupported packet types.

### `toYrp3d()`

```ts
toYrp3d(): Uint8Array
```

Serializes the object into `.yrp3d` bytes.

Behavior:

- Writes all `messages` as `.yrp3d` packets.
- Writes exactly one `sibyl_name` packet from the object's name fields.
- If the message list contains a `YGOProMsgStart` message, inserts `sibyl_name` immediately after the first Start packet.
- If the message list has no Start packet, writes `sibyl_name` as the first packet.
- Writes `YGOProStocChat` as `230 = sibyl_chat`.
- Writes `YGOProStocReplay` as `231 = sibyl_replay`.
- Never writes `236 = sibyl_quit`.
- Does not preserve unknown packets.

### `extractYrp()`

```ts
extractYrp(): YGOProYrp | undefined
```

Finds the last `YGOProStocReplay` message by scanning `messages` backwards, then returns its embedded `YGOProYrp`.

```ts
const yrp = yrp3d.extractYrp();
if (yrp) {
  console.log(yrp.hostName, yrp.clientName);
}
```

This is a convenience method for the common case where a `.yrp3d` contains an embedded standard `.yrp` replay. See [`ygopro-yrp-encode`](https://github.com/purerosefallen/ygopro-yrp-encode) for the `YGOProYrp` API.

## Types

### `YGOProYrp3dMessage`

```ts
type YGOProYrp3dMessage =
  | YGOProMsgBase
  | YGOProStocChat
  | YGOProStocReplay;
```

These classes are provided by `ygopro-msg-encode`.

### `YGOProYrp3dLike`

```ts
interface YGOProYrp3dLike {
  name0: string;
  name0Tag: string;
  name0Current: string;
  name1: string;
  name1Tag: string;
  name1Current: string;
  masterRule: number;
  messages: YGOProYrp3dMessage[];
}
```

Used by the deep-copy constructor.

## Raw Packet API

Use the raw API when you need to inspect packet boundaries directly.

```ts
import {
  readYrp3dPackets,
  writeYrp3dPackets,
  type YGOProYrp3dRawPacket,
} from 'ygopro-yrp3d-encode';

const packets = readYrp3dPackets(bytes);
for (const packet of packets) {
  console.log(packet.type, packet.payload.length);
}

const remade = writeYrp3dPackets(packets);
```

### `YGOProYrp3dRawPacket`

```ts
type YGOProYrp3dRawPacket = {
  type: number;
  payload: Uint8Array;
};
```

### `readYrp3dPackets()`

```ts
readYrp3dPackets(payload: Uint8Array): YGOProYrp3dRawPacket[]
```

Reads raw `.yrp3d` packets. Throws if a packet header or payload length is truncated.

### `writeYrp3dPackets()`

```ts
writeYrp3dPackets(packets: YGOProYrp3dRawPacket[]): Uint8Array
```

Writes raw packets using the standard `.yrp3d` packet framing.

## Constants

```ts
import {
  YRP3D_SIBYL_CHAT,
  YRP3D_SIBYL_REPLAY,
  YRP3D_SIBYL_NAME,
  YRP3D_SIBYL_QUIT,
} from 'ygopro-yrp3d-encode';
```

Values:

```ts
YRP3D_SIBYL_CHAT = 230;
YRP3D_SIBYL_REPLAY = 231;
YRP3D_SIBYL_NAME = 235;
YRP3D_SIBYL_QUIT = 236;
```

## Chat Packets

`230 = sibyl_chat` is exposed as `YGOProStocChat`.

The reader accepts both known payload layouts:

```text
uint16 player_type
utf16le null-terminated msg
```

and the Unity-compatible variant:

```text
uint32 player_type
utf16le null-terminated msg
```

The writer emits the Unity-compatible `uint32 + utf16le` form.

See `YGOProStocChat` in [`ygopro-msg-encode`](https://github.com/purerosefallen/ygopro-msg-encode) for details about `player_type` and chat color values.

## Name Packets

`235 = sibyl_name` is exposed through fields on `YGOProYrp3d`.

Payload layout:

```text
UTF-16LE fixed 50 chars  name0
UTF-16LE fixed 50 chars  name0Tag
UTF-16LE fixed 50 chars  name0Current
UTF-16LE fixed 50 chars  name1
UTF-16LE fixed 50 chars  name1Tag
UTF-16LE fixed 50 chars  name1Current
int32                    masterRule
```

Only the first valid name packet is read. `toYrp3d()` writes exactly one name packet.

## Replay Packets

`231 = sibyl_replay` is exposed as `YGOProStocReplay`.

The replay payload is a complete `.yrp` or `.yrp2` byte stream. Use `extractYrp()` for the common case:

```ts
const yrp = new YGOProYrp3d().fromYrp3d(bytes).extractYrp();
```

For the embedded replay object API, refer to [`ygopro-yrp-encode`](https://github.com/purerosefallen/ygopro-yrp-encode).

## Notes

- This package is not a lossless editor for unknown `.yrp3d` packet types.
- `sibyl_quit` packets are intentionally ignored.
- Unknown or unparsable packets are intentionally ignored in the high-level API.
- Use `readYrp3dPackets()` if you need raw packet-level inspection.
