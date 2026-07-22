import type { Locale } from "./types";

const TAGLINES_EN = [
  "Ass-embly required. Mud optional. Regret included.",
  "WebAssembly jokes. Telnet tears. Same energy.",
  "Not your grandma’s zMUD — she had better fonts.",
  "Because typing north in a browser was a personality trait.",
  "mudgate: where Big5 meets midlife crisis.",
  "Half Ass, half MUD, 100% intentional branding.",
  "We put Ass in the name so you wouldn’t take us seriously. Then we shipped VT100.",
  "If this client crashes, the Ass is yours.",
  "No WASM TCP. Just Ass, WSS, and a dream.",
  "Ass first. Questions later. map_d always.",
];

const TAGLINES_ZH_TW = [
  "組裝需要 Ass。泥巴可選。後悔附贈。",
  "WebAssembly 玩笑，Telnet 眼淚，同一種能量。",
  "不是阿嬤的 zMUD——她字體還比較好看。",
  "在瀏覽器打 north 曾是一種人格特質。",
  "mudgate：Big5 遇見中年危機的地方。",
  "一半 Ass，一半 MUD，百分之百故意的名字。",
  "名字放 Ass 是要你別太認真。然後我們出了 VT100。",
  "客戶端若當機，Ass 算你的。",
  "沒有 WASM TCP。只有 Ass、WSS，與一個夢。",
  "先 Ass，問題後問。map_d 永遠在線。",
];

const TAGLINES_ZH_CN = [
  "组装需要 Ass。泥巴可选。后悔附赠。",
  "WebAssembly 玩笑，Telnet 眼泪，同一种能量。",
  "不是奶奶的 zMUD——她字体还更好看。",
  "在浏览器打 north 曾是一种人格特质。",
  "mudgate：Big5 遇见中年危机的地方。",
  "一半 Ass，一半 MUD，百分之百故意的名字。",
  "名字放 Ass 是要你别太认真。然后我们出了 VT100。",
  "客户端若崩溃，Ass 算你的。",
  "没有 WASM TCP。只有 Ass、WSS，与一个梦。",
  "先 Ass，问题后问。map_d 永远在线。",
];

function pool(locale: Locale): readonly string[] {
  if (locale === "zh-TW") return TAGLINES_ZH_TW;
  if (locale === "zh-CN") return TAGLINES_ZH_CN;
  return TAGLINES_EN;
}

export function pickTagline(locale: Locale): string {
  const list = pool(locale);
  return list[Math.floor(Math.random() * list.length)]!;
}

/** For tests / re-export parity. */
export const TAGLINES = {
  en: TAGLINES_EN,
  "zh-TW": TAGLINES_ZH_TW,
  "zh-CN": TAGLINES_ZH_CN,
} as const;
