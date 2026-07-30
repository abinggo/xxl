// 场景注册表: key -> 工厂(接收 stage, game 上下文)
import { createJump } from "./jump.js?v=1785379502";
import { createWhackShop } from "./workshop.js?v=1785379502";
import { createCut } from "./cut.js?v=1785379502";

const REGISTRY = { jump: createJump, workshop: createWhackShop, cut: createCut };

export function createScene(key, stage, game) {
  const make = REGISTRY[key] || createJump;
  return make(stage, game);
}
