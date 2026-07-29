// 场景注册表: key -> 工厂(接收 stage, game 上下文)
import { createJump } from "./jump.js";
import { createWhackShop } from "./workshop.js";
import { createCut } from "./cut.js";

const REGISTRY = { jump: createJump, workshop: createWhackShop, cut: createCut };

export function createScene(key, stage, game) {
  const make = REGISTRY[key] || createJump;
  return make(stage, game);
}
