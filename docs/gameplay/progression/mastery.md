---
description: Each building has its own Mastery, earned by using that building, with a perk tree to spend points in.
---

# Mastery

Every building has its own **Mastery**, and you raise it only by doing what that building is for: traders level up by trading, gardeners by gardening. You see and spend a building's Mastery inside that building.

{% hint style="info" %}
Today only **Exchange Mastery** is open. Garden, Tavern, Workshop and Mine Mastery are coming.
{% endhint %}

## Levels and points

* Everyone starts at level 1. Going from level n to n + 1 takes **100 × n² XP**, the same curve in every building.
* Your [Townhall](townhall.md) adds +1% XP per Townhall level, in every building.
* **Each Mastery level gives 1 point** to spend on that building's perks.
* **The Townhall caps it:** a Mastery can't be higher than your Townhall level. XP past the cap is kept and counts as soon as you upgrade the Townhall.

| Reach level | Total XP |
| --- | --- |
| 5 | 3,000 |
| 10 | 28,500 |
| 20 | 247,000 |
| 25 | 490,000 |

## Respec

You can reset a building's perks and spend its points again. A respec costs $aura (burned) and rises each time:

> **Respec cost** = 5,000 × 1.5^(respecs so far) × (1 + Mastery level ÷ 20)

At Mastery level 5, the first respec costs 6,250 $aura and the second 9,375.

## Exchange Mastery

Earned by trading: **100 XP per $1 of builder fees**, added when each day's $aura pool settles. A fee discount never slows your XP, since fees count at the full rate.

| Perk | Effect | Max ranks |
| --- | --- | --- |
| **Lower fees** | −2% builder fee per rank | 10 (−20%) |
| **Market maker** | +3% pool weight on your maker (limit) fills per rank | 5 (+15%) |
| **Taker** | +3% pool weight on your taker (market) fills per rank | 5 (+15%) |
| **Whale** | +3% pool weight on all your fees per rank, on UTC days you trade $100k or more | 5 (+15%) |

**Pool weight** is how much your fees count when the daily pool is shared out (see [Exchange](../exchange.md#earning-aura)). A fill is either maker or taker, so one fill gets at most +30% (+15% from Market maker or Taker, plus +15% from Whale). The Lower fees discount doesn't shrink your share: your fees still count at the full rate.

Maxing all four perks takes 25 points, which is Mastery level 25. At our 0.05% fee that's about $4,900 of fees, or roughly $10M of trading volume.
