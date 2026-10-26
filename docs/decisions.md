# HyperEmpire — design decisions log

How the MVP rules in [mvp-design.md](mvp-design.md) were reached. As of Oct 26, 2026.

## Decided

| Topic | Decision | Why |
| --- | --- | --- |
| Reward basis | $aura is earned per $1 of builder fee paid, on opens and closes, win or lose | Rewards stay backed by revenue; no trade-lifecycle accounting needed |
| Emission rate | 500 $aura per $1 fee (k = 0.5 notional, ×1,000 multiplier) | Bigger, friendlier numbers; 1 $aura ≈ $0.001 notional |
| One token | Everything runs on $aura; no second currency | Keep the system simple |
| Loss bonus | Parked for MVP | Farmable, adds accounting edge cases, poor optics |
| Builder fee | Users approve the 0.1% perps cap; launch rate 0.05%, raise later | Matches Phantom at launch, keeps headroom without re-approval |
| Season 0 | $aura transfers off, no liquidity pool | No price to farm against; pool launched later at ≤ $0.001 |
| Pay-to-win | Allowed on the global leaderboard | Whales fund the system; a separate low/mid-spend season can come later |
| Leaderboard prizes | Funded from a share of builder fees, not new $aura | Prizes stay below what top players spent |
| Stats | STR / AGI / VIT / INT / LUCK; base stats from tier, +1 point per level, free allocation | Five stats give room for fighter and crafter builds |
| On-chain | Hero, $aura, leveling, adventure on HyperEVM; fee indexer off-chain posting Merkle roots | Fill history lives on HyperCore |
| Hero tiers | Random tier at mint (Common 50% … Mythic 0.2%) sets total base stats, split randomly across five stats; ships in Phase 1 | Every $10 mint is a gacha moment for low/mid players and creators |
| Rerolls | Pay $aura to reroll tier and spread; the new roll always replaces the old; cost 5,000 × 1.5^n × (1 + level / 20); ships in Phase 1 | A true gamble and a second Phase 1 sink, biggest for whales rerolling high-level heroes |
| Roll fairness | Commit-reveal or VRF; contracts cannot mint or reroll | Stops bots cancelling bad rolls |
| Risky level-up | Pay 10–100% of a level's cost (10% steps) for the same % chance; $aura burned either way | Fair odds keep the expected burn unchanged; gives small players a cheap shot and more gamble moments |
| MVP scope | Hero mint, leveling, simple adventure, global leaderboard | Crafting, materials, PvP later |
| Low/mid-tier role | Crafting: they turn time and luck into gear that whales buy | Whales need a living economy of smaller players |
| Crafting mastery | Stored on the hero NFT, not the account | A high-mastery crafter hero becomes a sellable asset; value still flows from whales to the players who built it |
| Gear and hero trading | Gear is an NFT, freely tradable on existing marketplaces; no in-house market for now | Nothing to build; real-money exit draws low/mid players |
| Materials | Non-transferable in Season 0 | Only finished, really-crafted gear reaches the market; less bot value |
| Gear score | None; leaderboard stays ranked by level | A single score kills build variety; zones weight stats differently instead |
| Gear slots | Weapon, Armor, Helmet, Shoes, Accessory (ring or necklace) | One clear job per slot |
| Gear-only stats | SPD only (shoes, shorter adventure locks, capped at −40%); LUCK became a base stat that gear can also boost | Gear keeps one exclusive stat |
| Material tiers | Five families (Ore, Hide, Wood, Gem, Essence) × four tiers | Tier sets stat range; four tiers are enough depth |
| Naming | Classic fantasy names, no crypto flavor (zone renamed Liquidation Crypt → Forgotten Crypt) | Keep the game world readable on its own |
| Player types | Every mechanic is checked for pure traders, whales and low/mid tier (five-question check in mvp-design.md) | The economy fails if any one group leaves |
| Fee discount | Every 10 hero levels cut the builder fee by 5%, max 40% off at level 80 | Gives pure traders a Season 0 use for $aura and a reason to stay vs Phantom; leveling still burns $aura |
| Starter $aura | The $10 mint includes 5,000 $aura | Players who don't trade can still level and craft a little |
| Free daily run | One Rat Cellar run per hero per day, no entry fee, drops materials only | A free path into crafting without printing $aura; $10 mint and daily cap limit bots |
| Phase 1 scope | Trading UI with builder code, $aura from fees, hero mint, leveling, Season 0 level leaderboard | Ship the trade → $aura → level → rank loop first; adventure, crafting and stat allocation follow in Phases 2–3 |
| Creator referral codes | In Phase 1: referrers earn a share of builder fees from traders they bring, paid in USDC (share TBD, 10–20%) | Growth lever with no streaming work; creators earn real money while $aura can't be cashed out |
| Banked stat points | Levels in Phase 1 still grant points, spent once stat allocation ships | Early leveling carries over into Phase 2 |
| Weekly Rising board | Not in Phase 1 | Keep Phase 1 to one Season 0 board ranked by level |
| **Pivot: empire game** (Oct 25) | The game grows an **empire** instead of a single hero; the repo moved to `hyperempire` | A bigger scope gives every player type more to do; empire builders are a familiar genre |
| **Name: HyperEmpire** (Oct 25) | The project and product are called **HyperEmpire** (repo `hyperempire`); "HyperHero" and "Degen Empire" were working names | "Hyper" ties it to Hyperliquid; "Empire" matches what players build |
| Buildings | Townhall (progression), Exchange (trading UI), Tavern (heroes, Phase 2), Garden (seeds, Phase 3) | One building per loop; the scene doubles as navigation |
| Townhall leveling | Leveling, risky upgrades and the Season 0 leaderboard move from the hero to the Townhall | The Townhall is the empire's level and the main $aura sink |
| Building caps | No building can be a higher level than the Townhall | Keeps the Townhall the first upgrade |
| Perk tree | 1 point per Townhall level, spent like stat allocation across Trader / Fighter / Crafter branches; tiers open at 5 and 15 points in a branch; rising-cost respec | Players choose their own build; each branch serves one player type |
| Fee discount (revised) | Exchange levels + Trader "Lower fees" perk, capped at −40% in total (replaces "every 10 hero levels −5%") | Traders get a discount from the buildings they use |
| Exchange naming | The trading UI is the **Exchange** building, opened from the scene or `#exchange` | Instantly clear to traders |
| Core trading never gated | Market/limit, TP/SL and all markets are available from Exchange level 1 | Gating core features loses traders to Phantom |
| Heroes move to the Tavern | Tiered recruits (Common 50% … Mythic 0.2%) and rerolls apply to Tavern heroes in Phase 2; hero stats stay STR / AGI / VIT / INT / LUCK | Heroes become a building feature, not the whole game |
| Content creators | Fourth player group; referral codes in Phase 1, live gifting later; six-question mechanic check adds "worth showing on stream?" | Creators bring players and give whales a stage |
| Art direction | Muted top-down RPG town; the main scene is generated with PixelLab (Create Image Pro, style reference); icons with Pixflux in the scene palette | PixelLab output matched the reference far better than hand-drawn generators |
| Building hover | Shape-following highlight from cut-out sprites (`design/scene/cutout.py`), not a box | Highlights read as the building itself |
| Townhall state (temporary) | Level, perks and $aura spent kept in browser storage per wallet until the Townhall contract ships; perk fee discount is display-only | Lets the UI ship before contracts; display-only stops self-granted discounts |
| **Mining is Phase 2** (Oct 26) | The first gacha loop: Tavern recruits Miners, Workshop crafts Picks, the Mine pays block rewards; heroes follow later | Uses the Townhall, Exchange, Tavern, Workshop and Mine together, and gives $aura sinks beyond the Townhall |
| Character types | Miners first, heroes later, more types after; all stored as one generic character record | Heroes and others fit in without a rework |
| Grades | Common / Uncommon / Rare / Epic / Legendary for Miners and Picks; recruit and craft odds 70 / 22 / 6.5 / 1.4 / 0.1%; Mythic stays for heroes | Legendary must be extremely hard to get (1 in 1,000 by roll, ~1,800 Commons by merging) |
| Merging | Two of the same type and grade make one of the next (50 / 40 / 30 / 15% success); a failure destroys both; no $aura boost | Simple flow; failures are a large $aura sink |
| Picks | Crafted at the Workshop with the same grades and merge rules; multiply a Miner's power; have durability and are repaired with $aura | A second collection and a recurring sink |
| Hunger | Miners have energy, drain it while mining, stop at 0, and are fed with $aura | Miners are people; upkeep keeps $aura flowing out as power grows |
| Miner slots | Base 3, +1 per rank of the Crafter perk **Foreman** (5 ranks, 8 max) | Limited slots make merging and pool choice matter, and tie mining to the Townhall |
| Block reward | Fixed per block, every 60 s; set manually per reward each week or season | Bitcoin-like and easy to tune; the team controls emission |
| Pools | Each reward has a shared pool (split by power) and a rush pool (one winner per block, odds by power), 50/50 by default; rush pools can be switched off and their launch is decided later | Steady income plus jackpot moments, without committing to the lottery yet |
| One pool per Miner | Each Miner works in exactly one pool; moving costs a few blocks of walking; power counted at the start of each block | Placement is a real choice; no jumping in before a payout |
| Pool choice is the player's | The Mine shows each pool's payout per power and the player's expected earnings and odds | Players decide with real numbers instead of guesses |
| Other rewards | BTC, ETH, oil and others are set up manually per week or season, each with its own pools | Lets seasons feature different prizes |
| No power cap | One player's mining power is not capped | Pay-to-win stays allowed, as on the leaderboard |
| $aura stays non-transferable | Confirmed for mining | Keeps mining rewards in-game and lowers gambling-law risk |
| Game backend | Balances, inventory, rolls and block draws run on a backend, with commit-reveal draws players can check | A 60 s block lottery can't run in the browser, and on-chain draws every minute are costly |

## Farming math

A hedged farmer (long on one wallet, short on another) pays Hyperliquid's fee plus our builder fee on every fill, and earns $aura only on the builder fee. Farming is unprofitable while $aura trades below:

| Builder fee | Farmer cost per $ filled (taker) | Break-even $aura price |
| --- | --- | --- |
| 0.1% | ~0.145% | ~$0.0029 (≈ $0.002 for rebated makers) |
| 0.05% | ~0.095% | ~$0.0038 |

## Crafting trade-offs to watch

- **$aura gets an indirect price.** Gear made from $aura sells for real money, so farming stays unprofitable only while gear value is below the builder fees behind the $aura in it. Tune craft costs and failure rates; watch gear floor prices.
- **Mastery can be bought.** With mastery on the hero NFT, the moat is scarcity of time, not exclusivity. Show mastery on the hero card so buyers see what they pay for.
- **Royalties may not be enforced.** Declare an ERC-2981 crafter royalty, but don't count on it as crafter income.
- **Marketplace support (checked Oct 23, 2026).** [OpenSea](https://support.opensea.io/en/articles/8867082-which-blockchains-are-compatible-with-opensea) lists HyperEVM as a supported chain (Hypurr NFTs already trade there). [Drip.Trade](https://alphagrowth.io/driptrade) is the Hyperliquid-native NFT marketplace where most ecosystem collections launch. Magic Eden is reported to be Solana-only since March 2026 ([CryptoTicker](https://cryptoticker.io/en/nft-marketplaces-2026-who-still-trades/)), so it is not an option.

## Loss bonus explorations (parked)

1. **Per-trade loss bonus** (extra 20–30% of fees on losing trades): dropped. It rewards reckless trading, a hedged pair always produces a loser, and liquidations and closes made elsewhere carry no builder fee.
2. **Rage Mode** (+25% on all fees for 24h after any loss): exploitable by losing $0.01 to keep the buff on permanently.
3. **Rage Charge** (charge = min(10% of realized loss, 50% of that position's fees), released as +50% on future fees, 72h expiry): bounded and dust-proof, but parked to keep MVP simple.

Possible later, non-economic: battle-scar badges on the hero ("Survived 10 liquidations").

## Builder fee comparison (perps, on top of Hyperliquid ~0.045% taker / ~0.015% maker)

| Frontend | Builder fee | Builder revenue (approx.) |
| --- | --- | --- |
| Hyperliquid UI | 0% | — |
| Phantom | 0.05% (most sources) | ~$26.8M all-time (Oct 2026), #1 |
| Based | not confirmed | ~$15.5M, #2 |
| MetaMask | 0.1% (the cap) | ~$11.9M |
| PVP.trade | not confirmed | ~$8M |

Sources: [Datawallet on Phantom](https://www.datawallet.com/crypto/phantom-perpetuals-review), [CryptoTicker on MetaMask](https://cryptoticker.io/en/metamask-dex/reviews/), [CoinGecko builder rankings](https://www.coingecko.com/research/publications/top-hyperliquid-builders), [Hyperliquid builder fees explained](https://hyperliquidguide.com/guides/trading/hyperliquid-builder-fees-explained), [DefiLlama builder rankings](https://defillama.com/protocols/hyperliquid-builder).
