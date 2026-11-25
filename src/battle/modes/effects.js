import { LowPowerEffect } from './LowPowerEffect'
import { RotateEffect } from './RotateEffect'
import { AdEffect, BossEffect, RhythmEffect, ShortsEffect, UpdateEffect } from './ruleEffects'
import { SelfieEffect } from './SelfieEffect'
import { TorchEffect } from './TorchEffect'

// 모드 열쇠 → 화면 효과. 모두 draw(ctx, world, me, info), react(signal, world, meId)를 가진다(없으면 기본 화면 그대로).
export const EFFECTS = {
  rotate: RotateEffect,
  selfie: SelfieEffect,
  torch: TorchEffect,
  lowpower: LowPowerEffect,
  shorts: ShortsEffect,
  ad: AdEffect,
  rhythm: RhythmEffect,
  update: UpdateEffect,
  boss: BossEffect,
}
