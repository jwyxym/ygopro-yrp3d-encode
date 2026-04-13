import type {
  YGOProMsgBase,
  YGOProStocChat,
  YGOProStocReplay,
} from 'ygopro-msg-encode';

export type YGOProYrp3dMessage =
  | YGOProMsgBase
  | YGOProStocChat
  | YGOProStocReplay;

export interface YGOProYrp3dLike {
  name0: string;
  name0Tag: string;
  name0Current: string;
  name1: string;
  name1Tag: string;
  name1Current: string;
  masterRule: number;
  messages: YGOProYrp3dMessage[];
}
