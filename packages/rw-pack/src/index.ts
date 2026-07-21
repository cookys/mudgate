import type { Package } from "@assmud/script-engine";

/** Declarative RW convenience pack — human-validated later; safe defaults. */
export const RW_STARTER_PACK: Package = {
  id: "rw-starter",
  name: "RW Starter",
  enabled: true,
  aliases: [
    { name: "l", expand: "look" },
    { name: "i", expand: "inventory" },
    { name: "sc", expand: "score" },
  ],
  triggers: [
    {
      id: "rw-channel-chat",
      pattern: "^\\[聊天\\]",
      action: "highlight",
    },
    {
      id: "rw-hp-low",
      pattern: "生命[^0-9]*([0-9]{1,2})%",
      action: "setvar",
      payload: "hp=$1",
      cooldownMs: 2000,
    },
  ],
  variables: {},
};

export function charsetLabel(c: string): string {
  switch (c) {
    case "big5hkscs":
    case "big5":
      return "BIG5";
    case "gbk":
      return "GB";
    default:
      return "UTF-8";
  }
}
