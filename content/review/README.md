# Tactical review: first three cases

Three Roundcraft cases are ready for a knowledgeable CS2 player to review. Each packet takes about 5–10 minutes. You do not need the demo, the case JSON or a local install. Read the packet, then fill in its approval form (section 7).

| # | Case | The decision | What the follow-up tests | Packet |
|---|---|---|---|---|
| 1 | Inferno, CT, 2v2 retake at A | 36 s on the bomb, two kits, no utility, AWP + M4A1-S. Retake together now, wait and defuse late, or save? | An enemy smoke in Balcony with 26 s left. The draft keeps the retake as the strongest line. | [`case_inferno_post_plant_356758`](case_inferno_post_plant_356758/README.md) |
| 2 | Inferno, T, 2v2, no plant | 35 s on the clock, bomb dropped in Top of Mid, one player on 44 HP, one molotov. Execute now, play slowly, or fake? | A defender appears in Arch with 24 s left, about 1 s before the next kill. The draft keeps the execute as the strongest line. | [`case_inferno_late_round_no_plant_a430fd`](case_inferno_late_round_no_plant_a430fd/README.md) |
| 3 | Mirage, T, 5v4 after the opening kill | 74 s on the clock, bomb in Palace, one defender seen in Middle, three unknown. Default, lurk, fake or execute? | A second defender appears in Underpass. The draft's strongest line flips from playing slowly to executing now. | [`case_mirage_opening_pick_cae8a3`](case_mirage_opening_pick_cae8a3/README.md) |

## How each packet is laid out

1. **Situation**: map, side, score, time, alive players, weapons and armour, utility, bomb.
2. **What the deciding team knew**:
   - each fact as confirmed, last seen (with its age), inferred or unknown;
   - a player-known diagram next to the ground truth.
3. **Main decision**:
   - the actions and ways to execute them, with proposed scores and the rule behind each;
   - how evidence is weighted;
   - why more than one line may be defensible.
4. **Follow-up**:
   - the new information and its exact timing;
   - the score matrix: how each answer scores after each locked action.
5. **What actually happened**: descriptive only, never the answer key.
6. **Questions** only a CS2 player can answer, and the draft's assumptions.
7. **Approval form**: yes/no answers with room for changes, and a verdict.

## Reading the scores

- A case is worth 100 points: 50 for the main call, 20 for the two pieces of evidence the player picks, and 30 for the follow-up. Confidence is recorded but never scored.
- The follow-up is judged against the line the player locked. Staying with a line the new information leaves sound scores best. Switching earns the new line's value minus the time and position a switch costs, so a weak call corrected still scores reasonably, while a sound call abandoned does not.
- Every number is a proposal from the draft generator, not a tactical judgement. If a row or cell is wrong, say which and what it should be. The owner changes the case and re-scores it.
- The source round shows what one team did. It is never treated as the correct answer.

## Returning your review

- Send the filled-in approval form to the case owner. The owner records it in the case file as `editorial.reviewers` (`approved` or `changes_requested`, with your notes).
- Only a named human CS2 reviewer can approve. An approval lets the owner move the case to `tactically_reviewed`; nothing is published by a review alone.
- Two independent reviews per case are recommended. One is required.

## Not in this handoff

- **Other packets in this folder:** the Mirage 2v2 no-kit retake (`case_mirage_post_plant_4fb7d6`) and the Inferno 3v3 (`case_inferno_man_advantage_shift_927fb7`) also have packets. Each needs a tactical decision from the owner before review. See [`docs/content-review-queue.md`](../../docs/content-review-queue.md).
- **Regenerating packets:** run `roundcraft-miner case packet` (see [`tools/case-miner`](../../tools/case-miner/README.md)). Summaries and questions come from [`questions.json`](questions.json).
