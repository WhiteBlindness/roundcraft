"""Per-situation templates and documented heuristic priors for demo-grounded drafts.

EVERYTHING in here is a PROPOSAL from category templates, not tactical truth. The lists of options
are generic for the situation (they are not derived from the demo), the tiers and qualifier scores
are simple, inspectable rules over the player-known features, and every prose field is marked in
editorial.knownIssues as needing human tactical review.

Rule shape: ordered `Rule(test, value, text)`; the first rule whose test passes wins. The `text` is
written verbatim into editorial.notes so every rubric value can be traced to the rule that produced it.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from typing import Any

from .features import Features

Cond = Callable[[Features], bool]


@dataclass(frozen=True)
class Rule:
    test: Cond
    value: Any
    text: str


@dataclass(frozen=True)
class QualT:
    id: str
    label: str
    base: int  # rank score before rules
    rules: tuple[Rule, ...] = ()
    # Physical-possibility requirements. When one is not met, `fallback` (a variant of the same idea that
    # is possible in this state) is offered instead, so a brief never proposes "use utility" to a team
    # that has none, "rotate two and leave one" to a team of two, or "the known position" when no
    # enemy position is known.
    min_utility: int = 0  # own utility items needed
    min_own_alive: int = 0  # own players alive needed
    needs_known_enemy: bool = False  # a fresh enough known (confirmed/last_seen) enemy position is needed
    fallback: "QualT | None" = None
    label_two: str | None = None  # wording when exactly two own players are alive


def _satisfied(q: QualT, f: Any) -> bool:
    return not (
        (q.min_utility and f.util_total < q.min_utility)
        or (q.min_own_alive and f.own_alive < q.min_own_alive)
        or (q.needs_known_enemy and f.place is None)
    )


def resolve_qualifier(q: QualT, f: Any) -> QualT:
    """Follow the fallback chain until a qualifier that is possible in this state is found."""
    current = q
    while not _satisfied(current, f) and current.fallback is not None:
        current = current.fallback
    if current.label_two and f.own_alive == 2:
        current = replace(current, label=current.label_two)
    return current


def available_qualifiers(action: "ActionT", f: Any) -> tuple[QualT, ...]:
    """Qualifiers that are possible in this state: fallbacks applied, duplicates (by id or label) dropped."""
    seen_ids: set[str] = set()
    seen_labels: set[str] = set()
    result: list[QualT] = []
    for q in action.qualifiers:
        resolved = resolve_qualifier(q, f)
        if resolved.id in seen_ids or resolved.label in seen_labels:
            continue
        seen_ids.add(resolved.id)
        seen_labels.add(resolved.label)
        result.append(resolved)
    if len(result) < 2:  # the schema needs two per action: keep the original options rather than break it
        return tuple(action.qualifiers)
    return tuple(result)


@dataclass(frozen=True)
class ActionT:
    id: str
    label: str  # may contain {place}
    label_no_place: str
    qualifiers: tuple[QualT, ...]
    tier_rules: tuple[Rule, ...]
    default_tier: str
    why: str
    cost: str
    assumption: str
    breaks: str
    alt: str  # clause used when this action is the closest alternative: "The closest alternative was <alt>."
    cf_fact: str
    cf_effect: str
    evidence_weights: dict[str, int] = field(default_factory=dict)
    cap_rules: tuple[Rule, ...] = ()
    applies: Cond | None = None  # action is offered only when this holds (>= 3 actions are always kept)
    label_unplanted: str | None = None  # label used while the bomb is not planted


_OPTIONAL = re.compile(r"\[\[(.*?)\]\]")


def fill(text: str, f: Any) -> str:
    """Render template prose: `[[...]]` clauses talk about the team's own utility as a plan in itself, so they are
    dropped when the team has fewer than two items (a single grenade cannot carry "take space with utility")."""
    has_utility = f.util_total >= 2
    return _OPTIONAL.sub(lambda m: m.group(1) if has_utility else "", text)


@dataclass(frozen=True)
class ResponseT:
    id: str
    label: str


@dataclass(frozen=True)
class Situation:
    id: str
    title: str  # "{map}" is substituted
    focus: str  # <= 80 chars (public metadata limit)
    principle: str
    dims: tuple[tuple[str, int], ...]
    actions: tuple[ActionT, ...]
    evidence_priority: tuple[str, ...]
    evidence_weights: dict[str, int]
    responses: tuple[ResponseT, ...]
    urgent_test: Cond
    urgent_text: str
    urgent_best: str  # response id that is best when the follow-up state is urgent
    generic_followup_stimulus: str
    evidence_notes: dict[str, str]  # signal class -> reveal explanation


# Rating pairs (dimension 1, dimension 2) by tier and qualifier rank. With weights 60/40:
# best 100/90/75/65, good 75/65/60/50, fair 50/40/35/25, poor 25/15/10/0.
TIER_RATINGS: dict[str, tuple[tuple[int, int], ...]] = {
    "best": ((4, 4), (4, 3), (3, 3), (3, 2)),
    "good": ((3, 3), (3, 2), (2, 3), (2, 2)),
    "fair": ((2, 2), (2, 1), (1, 2), (1, 1)),
    "poor": ((1, 1), (1, 0), (0, 1), (0, 0)),
}
TIER_ORDER = ("poor", "fair", "good", "best")
POOR_CAP = 35

# Follow-up quality by class -> response id (0..100). "urgent" is resolved per situation.
FOLLOWUP_QUALITY: dict[str, dict[str, int]] = {
    "position_info": {"continue_plan": 60, "adjust_to_new_info": 92, "take_more_info": 55, "fall_back": 30},
    "enemy_loss": {"continue_plan": 90, "adjust_to_new_info": 75, "take_more_info": 45, "fall_back": 25},
    "own_loss": {"continue_plan": 45, "adjust_to_new_info": 88, "take_more_info": 50, "fall_back": 55},
    "bomb_event": {"continue_plan": 55, "adjust_to_new_info": 90, "take_more_info": 45, "fall_back": 35},
    "default": {"continue_plan": 70, "adjust_to_new_info": 88, "take_more_info": 55, "fall_back": 40},
    "no_followup": {"continue_plan": 75, "adjust_to_new_info": 70, "take_more_info": 55, "fall_back": 40},
}
URGENT_QUALITY_BEST = 90
URGENT_QUALITY_OTHERS = {"adjust_to_new_info": 55, "continue_plan": 25, "take_more_info": 15, "fall_back": 30}


def _r(test: Cond, value: Any, text: str) -> Rule:
    return Rule(test, value, text)


# ---------------------------------------------------------------------------
# 1. CT retake (bomb planted, CT perspective)
# ---------------------------------------------------------------------------

_RETAKE_ACTIONS = (
    ActionT(
        id="group_retake",
        label="Retake together, clearing {place} first",
        label_no_place="Retake together through the nearest entrance",
        qualifiers=(
            QualT("clear_with_utility", "Clear the known position with utility first", 1, (
                _r(lambda f: f.util_total >= 2 and f.place is not None, 2, "+2 when >=2 utility items and a known position exist"),
                _r(lambda f: f.util_total == 0, -2, "-2 when the team has no utility"),
                _r(lambda f: f.util_total == 1, -1, "-1 with a single utility item: it cannot both clear the position and cover the defuse"),
            ), min_utility=2, needs_known_enemy=True, fallback=QualT(
                "clear_by_trading", "Clear the known position together and trade the first contact", 1,
                needs_known_enemy=True, fallback=QualT("clear_site_together", "Clear the site together and trade the first contact", 1))),
            QualT("stack_keep_utility", "Move as one stack and keep utility for the defuse", 1, (
                _r(lambda f: f.util_total >= 3, 1, "+1 when >=3 utility items can be split between clearing and the defuse"),
                _r(lambda f: f.util_total == 0, -2, "-2 when there is no utility to keep"),
            ), min_utility=1, fallback=QualT("stack_and_trade", "Move as one stack and trade every contact", 1)),
            QualT("probe_then_commit", "Send one player ahead to probe while the rest follow", 0, (
                _r(lambda f: f.info_level < 0.5, 2, "+2 when fewer than half of the enemies are located"),
                _r(lambda f: f.time < f.t_high, -1, "-1 when the clock is short (probing spends seconds)"),
            ), label_two="Send one player ahead to probe while the other follows"),
        ),
        tier_rules=(
            _r(lambda f: f.time < f.t_low, "poor", "bomb timer < defuse duration + 7 s: a committed retake cannot finish"),
            _r(lambda f: f.adv <= -2, "fair", "outnumbered by 2+: retake is a long shot"),
            _r(lambda f: f.adv == -1 and f.time < f.t_high, "good", "outnumbered by 1 with a short clock"),
            _r(lambda f: True, "best", "numbers level or better, or -1 with a comfortable clock: group retake is the proposed lead"),
        ),
        default_tier="best",
        why="The case for arriving as one group is that every defender stays within trade distance, so a single attacker cannot win an isolated duel[[, and utility and the defuse can be covered at the same time]].",
        cost="It commits the whole team to one line of approach, which is predictable and gives the attackers time to set up crossfires on it.",
        assumption="The remaining time is enough to clear the site and finish the defuse, and the known information is not a fake.",
        breaks="The timer runs too short for a defuse after the clear, or the attackers hold two angles that the group cannot clear at once.",
        alt="to retake as one group, trading a predictable approach for trade spacing[[ and shared utility]]",
        cf_fact="The bomb timer is far shorter than a defuse needs.",
        cf_effect="No committed retake could finish, and saving the weapons becomes the stronger line.",
        evidence_weights={"enemy_seen": 5, "own_utility": 4},
        cap_rules=(_r(lambda f: f.time < f.defuse_needed, 20, "cap 20: bomb timer shorter than the defuse itself"),),
    ),
    ActionT(
        id="split_retake",
        label="Split the retake across two entrances",
        label_no_place="Split the retake across two entrances",
        qualifiers=(
            QualT("split_sync", "Arrive together on a timed call", 1, (
                _r(lambda f: f.adv >= 1, 1, "+1 when the team is ahead on numbers"),
            )),
            QualT("split_info_first", "Let one group take information before the other commits", 0, (
                _r(lambda f: f.info_level < 0.5, 2, "+2 when fewer than half of the enemies are located"),
            )),
            QualT("split_fake", "Fake one side and commit through the other", 0, (
                _r(lambda f: f.util_total >= 2, 1, "+1 when >=2 utility items can sell the fake"),
                _r(lambda f: f.util_total < 2, -1, "-1 with less than 2 utility items"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.time < f.t_low, "poor", "bomb timer < defuse duration + 7 s"),
            _r(lambda f: f.adv <= -2, "poor", "outnumbered by 2+: two small groups lose the first duels"),
            _r(lambda f: f.time < f.t_high, "fair", "a split needs more travel time than a short clock allows"),
            _r(lambda f: f.adv == -1, "fair", "outnumbered by 1: smaller groups are harder to trade"),
            _r(lambda f: True, "good", "clock comfortable and numbers level or better: a defensible alternative"),
        ),
        default_tier="good",
        why="The case for two simultaneous entrances is that the attackers must cover more angles than they can hold, and either group can trade the other.",
        cost="Each group is smaller and further from the other, so a lost first duel cannot always be traded.",
        assumption="Both entrances are reachable within the clock and the two groups can arrive within a second or two of each other.",
        breaks="The groups arrive at different times, or the attackers stack one entrance so one group meets the whole team.",
        alt="to split across two entrances, giving up some trade spacing for the pressure of two simultaneous angles",
        applies=lambda f: f.own_alive >= 3,
        cf_fact="One of the two entrances is held by the attackers.",
        cf_effect="Splitting sends a small group into a prepared crossfire, and retaking through the other entrance as one group becomes stronger.",
        evidence_weights={"enemy_seen": 5, "own_positions": 4, "alive_count": 4},
        cap_rules=(_r(lambda f: f.time < f.defuse_needed, 20, "cap 20: bomb timer shorter than the defuse itself"),),
    ),
    ActionT(
        id="take_information",
        label="Wait for information before committing",
        label_no_place="Wait for information before committing",
        qualifiers=(
            QualT("listen_first", "Listen for footsteps before moving", 0, (
                _r(lambda f: f.info_level < 0.5, 2, "+2 when fewer than half of the enemies are located"),
                _r(lambda f: f.time < f.t_high, -1, "-1 when the clock is short"),
            )),
            QualT("late_defuse", "Hold back and go for a late defuse", 0, (
                _r(lambda f: f.own_kit > 0 and f.time >= f.defuse_needed + 10, 2, "+2 with a kit and enough clock to still defuse late"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.time < f.t_low + 5, "poor", "bomb timer < defuse duration + 12 s: waiting spends the retake"),
            _r(lambda f: f.adv <= -2, "poor", "outnumbered by 2+"),
            _r(lambda f: f.unknown_enemies >= 1 and f.time >= 30, "good", "at least one enemy is unlocated and the clock is long: information has real value"),
            _r(lambda f: True, "fair", "waiting costs clock without a clear information gap"),
        ),
        default_tier="fair",
        why="Sound and sightings can turn unknown positions into known ones before any player is exposed.",
        cost="Every second spent listening is a second off the bomb timer, and it gives the attackers time to set up.",
        assumption="There is enough time to spend on information and still finish a defuse.",
        breaks="The timer, not the attackers, becomes the deciding factor: waiting leaves too few seconds for a defuse.",
        alt="to wait for information first, accepting less time on the bomb for a better read on positions",
        cf_fact="Every attacker position was already known at the decision point.",
        cf_effect="Waiting has nothing left to add, so the seconds it spends are wasted and committing at once is stronger.",
        evidence_weights={"enemy_unknown": 5, "enemy_seen": 4, "bomb_timer": 5},
        cap_rules=(_r(lambda f: f.time < f.defuse_needed, 20, "cap 20: bomb timer shorter than the defuse itself"),),
    ),
    ActionT(
        id="save_weapons",
        label="Save the weapons",
        label_no_place="Save the weapons",
        qualifiers=(
            QualT("save_all", "Everyone saves and avoids contact", 1, (
                _r(lambda f: f.adv <= -1, 1, "+1 when outnumbered"),
            )),
            QualT("save_take_trade", "Save, but take a trade if an attacker is met", 0, (
                _r(lambda f: f.adv >= 0, 1, "+1 when numbers are level or better"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.time < f.t_low, "best", "bomb timer < defuse duration + 7 s: the retake cannot finish"),
            _r(lambda f: f.adv <= -2, "best", "outnumbered by 2+: saving is the proposed lead"),
            _r(lambda f: f.adv == -1 and f.time < f.t_high, "best", "outnumbered by 1 with a short clock"),
            _r(lambda f: f.adv == -1, "good", "outnumbered by 1 with a comfortable clock"),
            _r(lambda f: f.time < f.t_high, "good", "numbers level or better but a short clock: saving is defensible"),
            _r(lambda f: True, "poor", "numbers level or better and a comfortable clock: saving gives away a winnable round"),
        ),
        default_tier="poor",
        why="When the clock or the numbers make the retake unlikely to work, keeping the weapons preserves the next round's economy.",
        cost="It concedes the round outright and gives up any chance of a defuse.",
        assumption="The retake would be unlikely to succeed, and the saved weapons matter more than the small chance that it does.",
        breaks="The time and numbers were better than assumed, so a retake could have won the round.",
        alt="to save the weapons, conceding the round to keep the economy intact",
        cf_fact="The team has a clear numbers advantage and a comfortable bomb timer.",
        cf_effect="Saving gives away a winnable round, and retaking together becomes clearly stronger.",
        evidence_weights={"bomb_timer": 5, "alive_count": 5, "enemy_seen": 2, "own_utility": 1},
    ),
)

# ---------------------------------------------------------------------------
# 2. T post-plant hold (bomb planted, T perspective)
# ---------------------------------------------------------------------------

_POST_PLANT_ACTIONS = (
    ActionT(
        id="hold_crossfire",
        label="Hold the bomb from separated crossfire angles",
        label_no_place="Hold the bomb from separated crossfire angles",
        qualifiers=(
            QualT("spread_crossfire", "Spread out so one grenade cannot clear everyone", 1, (
                _r(lambda f: f.own_alive >= 3, 1, "+1 with three or more players to spread"),
            )),
            QualT("stay_tradeable", "Stay close enough to trade every duel", 1, (
                _r(lambda f: f.own_alive <= 2, 1, "+1 with two or fewer players"),
            )),
            QualT("off_angle_watch", "Keep one player on an off angle to catch the defuse", 0, (
                _r(lambda f: f.own_alive >= 2, 1, "+1 when a second player can trade the off angle"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.adv >= 1, "best", "ahead on numbers: holding crossfires is the proposed lead"),
            _r(lambda f: True, "good", "level or behind: holding is defensible but less dominant"),
        ),
        default_tier="good",
        why="Separated angles make each defender's approach cost a duel, and the bomb timer keeps working for the attackers.",
        cost="Spread players are harder to trade, and utility can pin them one at a time.",
        assumption="The defenders arrive piecemeal, so each duel is close to one against one.",
        breaks="The defenders arrive together behind utility, and no single angle can stop the whole group.",
        alt="to hold separated crossfire angles, trading tight trade spacing for coverage of more approaches",
        cf_fact="The defenders have several smokes and flashes left to force a group entry.",
        cf_effect="Separated players lose their duels in sequence, and staying closer together becomes stronger.",
        evidence_weights={"enemy_seen": 5, "own_positions": 4, "alive_count": 4},
    ),
    ActionT(
        id="play_the_clock",
        label="Stay out of contact and play for the bomb timer",
        label_no_place="Stay out of contact and play for the bomb timer",
        qualifiers=(
            QualT("hide_and_listen", "Stay hidden and listen for the defuse", 1, ()),
            QualT("save_utility_for_defuse", "Save utility to deny the defuse", 1, (
                _r(lambda f: f.util_total >= 2, 1, "+1 with >=2 utility items to spend on the defuse"),
                _r(lambda f: f.util_total == 0, -2, "-2 with no utility"),
            ), min_utility=1, fallback=QualT("crossfire_on_bomb", "Hold a crossfire on the bomb", 1)),
        ),
        tier_rules=(
            _r(lambda f: f.time < 12, "best", "bomb timer under 12 s: surviving out of contact is enough"),
            _r(lambda f: f.adv <= 0, "best", "level or behind on numbers: avoid fair fights while the timer works for you"),
            _r(lambda f: True, "good", "ahead on numbers: passive play is safe but leaves value unused"),
        ),
        default_tier="good",
        why="The bomb timer works for the attackers, so every second spent out of contact forces the defenders to come to them.",
        cost="Giving up map space lets the defenders reach the bomb with less resistance.",
        assumption="The defenders cannot defuse from a position the attackers can deny with utility in time.",
        breaks="The defenders plant utility on the bomb early and get a safe defuse.",
        alt="to keep clear of any fight and let the bomb timer run, giving up space for safety",
        cf_fact="The defenders are known to hold a defuse kit and enough utility to cover it.",
        cf_effect="Waiting out of contact gives them the time they need, and contesting the approach becomes stronger.",
        evidence_weights={"bomb_timer": 5, "alive_count": 4, "own_utility": 4},
    ),
    ActionT(
        id="contest_known",
        label="Take the fight to {place}",
        label_no_place="Push towards the last known defender positions",
        qualifiers=(
            QualT("flash_entry", "Entry with a flash while the others trade", 1, (
                _r(lambda f: f.util["flash"] >= 1, 1, "+1 when the team still has a flash"),
                _r(lambda f: f.util["flash"] == 0, -2, "-2 with no flash"),
            ), min_utility=1, label_two="Entry with a flash while the other trades",
                fallback=QualT("wide_swing_entry", "Entry with a wide swing while the others trade", 1,
                               label_two="Entry with a wide swing while the other trades")),
            QualT("peek_together", "Peek together to trade", 1, ()),
        ),
        tier_rules=(
            _r(lambda f: f.time < 12, "poor", "bomb timer under 12 s: no reason to expose yourself"),
            _r(lambda f: f.adv >= 2 and f.place is not None, "good", "two or more players ahead with a known position"),
            _r(lambda f: True, "fair", "contesting gives up the timer advantage"),
        ),
        default_tier="fair",
        why="Removing a known defender early reduces the number of retakers before they can group.",
        cost="It leaves the safe position and gives up the advantage the bomb timer provides.",
        assumption="The known position is still occupied and the team wins the first duel or trades it.",
        breaks="The defender has moved and the team meets a second defender while exposed.",
        alt="to take the fight to the known defender, giving up the timer's protection for tempo",
        cf_fact="The known defender position is old and the defender is believed to have moved.",
        cf_effect="The push finds nobody and exposes the team, so holding position becomes stronger.",
        evidence_weights={"enemy_seen": 5, "own_utility": 4, "alive_count": 3},
    ),
    ActionT(
        id="cut_the_route",
        label="Reposition to cut off the retake route",
        label_no_place="Reposition to cut off the retake route",
        qualifiers=(
            QualT("cut_with_two", "Send two players to cut it off", 1, (
                _r(lambda f: f.own_alive >= 3, 1, "+1 with three or more players"),
            )),
            QualT("cut_with_one", "Send one player alone", 0, ()),
        ),
        tier_rules=(
            _r(lambda f: f.time < 25, "poor", "not enough clock to reposition and set up"),
            _r(lambda f: f.adv >= 1, "good", "ahead on numbers with a comfortable clock"),
            _r(lambda f: f.adv >= 0, "fair", "level on numbers"),
            _r(lambda f: True, "poor", "behind on numbers"),
        ),
        default_tier="fair",
        why="Meeting the retake before it reaches the site splits the defenders' timing.",
        cost="It leaves the bomb less covered and separates the team.",
        assumption="The route is predictable and the team gets there before the defenders do.",
        breaks="The defenders take another route, and the bomb is defused while the team is out of position.",
        alt="to meet the retake before it reaches the site, spreading the team in exchange for earlier contact",
        cf_fact="The defenders are known to be approaching through a different route.",
        cf_effect="The repositioned players miss them, and holding near the bomb becomes stronger.",
        evidence_weights={"enemy_seen": 5, "bomb_timer": 4, "own_positions": 4},
    ),
)

# ---------------------------------------------------------------------------
# 3. T execute or default (no bomb, T perspective)
# ---------------------------------------------------------------------------

_EXECUTE_ACTIONS = (
    ActionT(
        id="commit_execute",
        label="Commit to an execute now",
        label_no_place="Commit to an execute now",
        qualifiers=(
            QualT("full_utility_take", "Use utility together to take space", 1, (
                _r(lambda f: f.util_total >= 3, 1, "+1 with >=3 utility items"),
                _r(lambda f: f.util_total == 0, -2, "-2 with no utility"),
            ), min_utility=2, fallback=QualT("hit_together_trade", "Hit the site together and trade each entry", 1)),
            QualT("hold_back_for_post_plant", "Keep some utility back for the post-plant", 0, (
                _r(lambda f: f.util_total >= 4, 2, "+2 with >=4 utility items (enough to split)"),
                _r(lambda f: f.util_total <= 1, -1, "-1 with almost no utility"),
            ), min_utility=2, fallback=QualT("plant_then_crossfire", "Plant quickly and set up crossfires", 0)),
        ),
        tier_rules=(
            _r(lambda f: f.adv <= -2 and f.time < 25, "good", "outnumbered by 2+ with under 25 s: an attempt is a live but long-shot line"),
            _r(lambda f: f.adv <= -2, "fair", "outnumbered by 2+: an early attempt is a long shot"),
            _r(lambda f: f.time < 25, "best", "under 25 s on the round clock: the plant needs time, so commit"),
            _r(lambda f: f.util_total >= 3 and f.adv >= 0 and f.info_level >= 0.4, "best", "utility in hand, numbers level or better, and enemies partly located"),
            _r(lambda f: f.time < 45, "good", "under 45 s: a committed execute is defensible"),
            _r(lambda f: True, "fair", "plenty of clock and little information: committing early spends the options"),
        ),
        default_tier="fair",
        why="With limited clock, taking space[[ with utility]] while the defence is unsettled is the most reliable way to plant in time.",
        cost="It spends the team's[[ utility and]] options at once, leaving little for the post-plant.",
        assumption="The defenders cannot rotate enough players to the site before the plant.",
        breaks="The defence stacks the chosen site and has its own utility ready for the execute.",
        alt="to commit to an execute now, spending[[ utility and]] options at once for a plant before the clock runs low",
        cf_fact="The defenders are known to be stacked on the site you would hit.",
        cf_effect="The execute meets a full defence, and taking information or faking becomes stronger.",
        evidence_weights={"clock": 5, "own_utility": 5, "alive_count": 4},
    ),
    ActionT(
        id="default_take_info",
        label="Keep the default and take information first",
        label_no_place="Keep the default and take information first",
        qualifiers=(
            QualT("play_slow_listen", "Play slowly and listen for rotations", 1, (
                _r(lambda f: f.info_level < 0.4, 1, "+1 when few enemies are located"),
            )),
            QualT("probe_nearest_contact", "Probe the nearest known contact", 0, (
                _r(lambda f: f.place is not None, 2, "+2 when a known enemy position exists to probe"),
                _r(lambda f: f.place is None, -1, "-1 when there is nothing known to probe"),
            ), needs_known_enemy=True, fallback=QualT(
                "probe_with_one", "Probe with one player while the others hold", 0,
                label_two="Probe with one player while the other holds")),
        ),
        tier_rules=(
            _r(lambda f: f.time < 25, "poor", "under 25 s on the round clock: too late to gather information"),
            _r(lambda f: f.time >= 45 and f.info_level < 0.4, "best", "plenty of clock and few enemies located: information has the most value"),
            _r(lambda f: f.time >= 45, "good", "plenty of clock"),
            _r(lambda f: f.info_level < 0.4, "good", "moderate clock and little known"),
            _r(lambda f: True, "fair", "moderate clock and enemies already partly located"),
        ),
        default_tier="fair",
        why="When most positions are unknown and the clock is long, information converts the execute from a guess into a read.",
        cost="It spends round clock, which limits the later options.",
        assumption="There is enough clock left to act on whatever the information shows.",
        breaks="The clock runs down before the information is used, so the team has to execute blind anyway.",
        alt="to gather information before acting, spending clock to reduce the guess",
        cf_fact="The round clock is under half a minute.",
        cf_effect="Gathering information no longer fits, and committing at once becomes stronger.",
        evidence_weights={"enemy_unknown": 5, "enemy_seen": 4, "clock": 5},
    ),
    ActionT(
        id="fake_and_rotate",
        label="Fake one site, then rotate to the other",
        label_no_place="Fake one site, then rotate to the other",
        qualifiers=(
            QualT("fake_with_utility", "Sell the fake with utility", 1, (
                _r(lambda f: f.util_total >= 3, 1, "+1 with >=3 utility items"),
                _r(lambda f: f.util_total < 2, -1, "-1 with fewer than 2 utility items"),
            ), min_utility=1, fallback=QualT("fake_with_presence", "Sell the fake with noise and a brief peek", 1)),
            QualT("quiet_early_rotate", "Fake quietly and rotate early", 0, ()),
        ),
        tier_rules=(
            _r(lambda f: f.time >= 45 and f.util_total >= 3, "good", "long clock and utility to spend on a fake"),
            _r(lambda f: f.time >= 25, "fair", "enough clock to try, but the fake has to work"),
            _r(lambda f: True, "poor", "under 25 s: no time to rotate after the fake"),
        ),
        default_tier="fair",
        why="A convincing fake pulls defenders to one site and makes the second entry a numbers advantage.",
        cost="It spends clock[[ and utility]] on a site the team does not intend to take.",
        assumption="The defenders react to the fake and rotate late enough to matter.",
        breaks="The defenders hold their positions and the team arrives at the real site with too little clock[[ and utility]].",
        alt="to fake one site and rotate, spending clock[[ and utility]] to pull defenders out of position",
        applies=lambda f: f.own_alive >= 3,
        cf_fact="The defenders are known to hold their positions without rotating.",
        cf_effect="The fake gains nothing, and a direct execute becomes stronger.",
        evidence_weights={"clock": 5, "own_utility": 4, "enemy_unknown": 3},
    ),
    ActionT(
        id="lurk_to_pull",
        label="Use a lone lurker to pull a rotation",
        label_no_place="Use a lone lurker to pull a rotation",
        qualifiers=(
            QualT("lurk_alone", "Send one player alone behind the defence", 1, ()),
            QualT("lurk_with_partner", "Send two players wide with a trade", 0, (
                _r(lambda f: f.own_alive >= 4, 1, "+1 with four or more players"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.adv >= 0 and f.time >= 30, "good", "level or better on numbers with 30+ s of clock: a lurk can pull a rotation"),
            _r(lambda f: f.time >= 45, "fair", "long clock but behind on numbers: a lurk is a risk"),
            _r(lambda f: True, "poor", "short clock: a lurk cannot influence the round in time"),
        ),
        default_tier="poor",
        why="A lurker forces the defence to keep a player back, which thins the site defence.",
        cost="The team plays a player down elsewhere.",
        assumption="The defence reacts to the lurker rather than ignoring it.",
        breaks="The lurker is found early and is traded for nothing.",
        alt="to send a single lurker behind the defence, playing a player down for a thinner site defence",
        applies=lambda f: f.own_alive >= 3,
        cf_fact="The defence is known to ignore lurkers and keep its full site setup.",
        cf_effect="The lurker adds nothing, and the whole team executing becomes stronger.",
        evidence_weights={"clock": 4, "alive_count": 4, "enemy_seen": 3},
    ),
    ActionT(
        id="save_weapons_t",
        label="Save the weapons",
        label_no_place="Save the weapons",
        qualifiers=(
            QualT("save_all_t", "Everyone saves and avoids contact", 1, ()),
            QualT("save_one_last_try", "Save, but keep one player on a last-second attempt", 0, ()),
        ),
        tier_rules=(
            _r(lambda f: f.adv <= -2 and f.time < 30, "best", "outnumbered by 2+ late in the round: saving is the proposed lead"),
            _r(lambda f: f.adv <= -2, "fair", "outnumbered by 2+ with clock left"),
            _r(lambda f: f.category == "economy_save" and f.time < 30, "good", "an economy-save moment late in the round: saving is defensible"),
            _r(lambda f: True, "poor", "not outnumbered: saving gives away a live round"),
        ),
        default_tier="poor",
        why="When the numbers and the clock make a plant unlikely, keeping the weapons preserves the next round's economy.",
        cost="It concedes the round and any chance to plant.",
        assumption="A plant is unlikely to succeed, and the saved weapons matter more than the small chance that it does.",
        breaks="The defenders were weaker or further away than assumed, so an attempt could have planted.",
        alt="to save the weapons, conceding the round to keep the economy intact",
        cf_fact="The team has a clear numbers advantage and enough clock to plant.",
        cf_effect="Saving gives away a live round, and committing to an execute becomes clearly stronger.",
        evidence_weights={"alive_count": 5, "clock": 5, "enemy_seen": 2},
        applies=lambda f: f.adv <= -2 or f.category == "economy_save",
    ),
)

# ---------------------------------------------------------------------------
# 4. CT hold or rotate (no bomb, CT perspective)
# ---------------------------------------------------------------------------

_HOLD_ACTIONS = (
    ActionT(
        id="hold_setup",
        label="Hold the current setup",
        label_no_place="Hold the current setup",
        qualifiers=(
            QualT("stay_and_trade", "Stay in the set positions and trade", 1, ()),
            QualT("delay_with_utility", "Use utility to delay the first contact", 0, (
                _r(lambda f: f.util_total >= 3, 1, "+1 with >=3 utility items"),
                _r(lambda f: f.util_total == 0, -2, "-2 with no utility"),
            ), min_utility=1, fallback=QualT("delay_with_angles", "Delay with off-angles instead of utility", 0)),
        ),
        tier_rules=(
            _r(lambda f: f.time < 30, "best", "under 30 s on the round clock: attackers must commit, so the setup is set"),
            _r(lambda f: f.info_level < 0.5, "best", "few attackers located: nothing justifies leaving the setup"),
            _r(lambda f: True, "good", "attackers partly located: holding remains defensible"),
        ),
        default_tier="good",
        why="Without a reason to move, an intact setup keeps every player where trades are already arranged.",
        cost="It gives the attackers the initiative and leaves information unused.",
        assumption="The setup covers the sites well enough that the attackers cannot pick a soft spot.",
        breaks="The attackers commit to the one area the setup covers thinly.",
        alt="to hold the current setup, keeping trades in place at the cost of the initiative",
        cf_fact="A group of attackers is confirmed moving into one area with utility.",
        cf_effect="Holding leaves the target area outnumbered, and rotating help there becomes stronger.",
        evidence_weights={"enemy_unknown": 5, "clock": 4, "alive_count": 4},
    ),
    ActionT(
        id="rotate_to_info",
        label="Rotate a player towards {place}",
        label_no_place="Rotate a player towards the most recent information",
        qualifiers=(
            QualT("rotate_one", "Rotate one player and keep the rest in place", 1, (),
                  label_two="Rotate one player and keep the other in place"),
            QualT("rotate_two", "Rotate two players and leave one behind", 0, (
                _r(lambda f: f.own_alive >= 4, 1, "+1 with four or more players"),
            ), min_own_alive=3, fallback=QualT("rotate_together", "Rotate the whole group together", 0)),
        ),
        tier_rules=(
            _r(lambda f: f.place is not None and f.info_level >= 0.5 and f.time >= 30, "best", "a fresh sighting and enough clock: shifting weight to it is the proposed lead"),
            _r(lambda f: f.place is not None, "good", "some sighting exists"),
            _r(lambda f: True, "poor", "nothing located to rotate towards"),
        ),
        default_tier="poor",
        why="Moving weight towards where the attackers were seen puts more defenders on the likely point of contact.",
        cost="It thins another area and can be punished by a fake.",
        assumption="The sighting reflects the real intent and is not a fake.",
        breaks="The attackers were showing the position to pull a rotation and hit the area that was left thin.",
        alt="to rotate towards the most recent information, thinning another area for more weight on the likely contact",
        cf_fact="The sighting is known to be a deliberate fake.",
        cf_effect="The rotation leaves the real target thin, and holding the setup becomes stronger.",
        evidence_weights={"enemy_seen": 5, "clock": 4, "alive_count": 3},
    ),
    ActionT(
        id="gather_information",
        label="Take information before committing",
        label_no_place="Take information before committing",
        qualifiers=(
            QualT("listen_and_read", "Listen and read footsteps before moving", 1, ()),
            QualT("probe_with_trade", "Probe with a trade behind the prober", 0, (
                _r(lambda f: f.own_alive >= 3, 1, "+1 when a trade partner is available"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.time >= 45, "good", "long clock: information is affordable"),
            _r(lambda f: f.time >= 30, "fair", "moderate clock"),
            _r(lambda f: True, "poor", "short clock: attackers commit before the information matters"),
        ),
        default_tier="fair",
        why="Information turns a guess about the attackers' intent into a read before weight is moved.",
        cost="It exposes a player and spends attention while the attackers keep the initiative.",
        assumption="The information can be taken safely and acted on in time.",
        breaks="The prober is traded early and the information arrives too late to use.",
        alt="to take information before committing, exposing a player to reduce the guess",
        cf_fact="The attackers are known to be already committed to one area.",
        cf_effect="Information no longer adds anything, and reinforcing that area becomes stronger.",
        evidence_weights={"enemy_unknown": 5, "clock": 4, "own_positions": 3},
    ),
    ActionT(
        id="fall_back_for_retake",
        label="Fall back and play for the retake",
        label_no_place="Fall back and play for the retake",
        label_unplanted="Fall back and play for a retake if they plant",
        qualifiers=(
            QualT("fall_back_together", "Fall back together and regroup", 1, ()),
            QualT("fall_back_and_hold_angle", "Fall back but hold one angle", 0, (
                _r(lambda f: f.own_alive >= 3, 1, "+1 when a trade partner is available"),
            )),
        ),
        tier_rules=(
            _r(lambda f: f.adv <= -2, "good", "outnumbered by 2+: a retake setup avoids duels at a disadvantage"),
            _r(lambda f: True, "fair", "level or better on numbers: giving up a site is rarely necessary"),
        ),
        default_tier="fair",
        why="Giving up the site while keeping the team together turns a bad duel into a retake with numbers.",
        cost="It concedes the plant and puts the team on a running clock.",
        assumption="The attackers plant without heavy utility support for the post-plant.",
        breaks="The attackers plant safely with utility, and the retake faces a prepared post-plant.",
        alt="to give up the site and regroup for a later retake, conceding the plant to keep the team together",
        cf_fact="The attackers are known to have spent nearly all of their utility.",
        cf_effect="Holding the site becomes stronger, since the attackers cannot force it.",
        evidence_weights={"alive_count": 5, "enemy_unknown": 4, "clock": 3},
    ),
)


def _situation(
    sid: str,
    title: str,
    focus: str,
    principle: str,
    dims: tuple[tuple[str, int], ...],
    actions: tuple[ActionT, ...],
    priority: tuple[str, ...],
    weights: dict[str, int],
    responses: tuple[ResponseT, ...],
    urgent_test: Cond,
    urgent_text: str,
    urgent_best: str,
    generic: str,
    notes: dict[str, str],
) -> Situation:
    return Situation(sid, title, focus, principle, dims, actions, priority, weights, responses, urgent_test,
                     urgent_text, urgent_best, generic, notes)


_COMMON_NOTES = {
    "bomb_timer": "The timer decides how long any plan can take.",
    "clock": "The round clock bounds how long any plan can take.",
    "alive_count": "The head count sets how many duels the team can lose and still carry out its plan.",
    "enemy_seen": "A sighting narrows where contact is likely, but its value falls quickly with age.",
    "enemy_unknown": "Unaccounted-for opponents are the main risk to any committed plan and the main reason to gather information.",
    "own_utility": "The utility left sets how much of the plan can be forced rather than hoped for.",
    "own_positions": "Where the team starts sets how quickly it can act together.",
    "own_loadout": "Weapons and armour set how the team fares in the first duels.",
    "bomb_location": "Where the bomb sits sets which approaches matter.",
    "enemy_utility": "Utility already seen from the other side tells what they can no longer use.",
    "defuse_kit": "A kit halves the defuse time, which moves the point where a retake stops being possible.",
}

SITUATIONS: dict[str, Situation] = {
    "retake": _situation(
        "retake",
        "Retake on {map}",
        "Retake timing and information under a running bomb timer",
        "On a retake, weigh the seconds a defuse needs against what you actually know: commit while the clock and the numbers support it, and save when they do not.",
        (("commitment_timing", 60), ("information_use", 40)),
        _RETAKE_ACTIONS,
        ("bomb_timer", "alive_count", "enemy_seen", "own_utility", "defuse_kit", "enemy_unknown",
         "bomb_location", "enemy_utility", "own_positions", "own_loadout"),
        {"bomb_timer": 5, "alive_count": 4, "enemy_seen": 4, "own_utility": 3, "defuse_kit": 3, "enemy_unknown": 3,
         "bomb_location": 2, "enemy_utility": 2, "own_positions": 2, "own_loadout": 1, "clock": 3},
        (
            ResponseT("continue_plan", "Stick to the line you chose"),
            ResponseT("adjust_to_new_info", "Change your line to use the new information"),
            ResponseT("take_more_info", "Slow down and gather more information"),
            ResponseT("fall_back", "Stop and save the weapons"),
        ),
        lambda f: f.time < f.t_low or f.adv <= -2,
        "the bomb timer is below the defuse duration plus travel allowance, or the team is outnumbered by two or more",
        "fall_back",
        "Time passes and the retake has not yet made decisive contact.",
        {**_COMMON_NOTES},
    ),
    "post_plant_hold": _situation(
        "post_plant_hold",
        "Holding the post-plant on {map}",
        "Playing the post-plant: positions, utility and the bomb timer",
        "After the plant, the clock is an ally: take fights that improve your position, and avoid the ones that only trade time for risk.",
        (("position_choice", 60), ("utility_and_trades", 40)),
        _POST_PLANT_ACTIONS,
        ("bomb_timer", "alive_count", "enemy_seen", "own_utility", "enemy_unknown", "bomb_location",
         "enemy_utility", "own_positions", "own_loadout"),
        {"bomb_timer": 5, "alive_count": 4, "enemy_seen": 4, "own_utility": 3, "enemy_unknown": 3,
         "bomb_location": 2, "enemy_utility": 2, "own_positions": 3, "own_loadout": 1, "clock": 3, "defuse_kit": 1},
        (
            ResponseT("continue_plan", "Stick to the line you chose"),
            ResponseT("adjust_to_new_info", "Change your line to use the new information"),
            ResponseT("take_more_info", "Slow down and gather more information"),
            ResponseT("fall_back", "Back off and stay out of contact"),
        ),
        lambda f: f.adv <= -2,
        "the team is outnumbered by two or more after the new information",
        "fall_back",
        "Time passes and the defenders have not yet made decisive contact.",
        {**_COMMON_NOTES},
    ),
    "execute_or_default": _situation(
        "execute_or_default",
        "Execute or default on {map}",
        "Committing to an execute versus taking information first",
        "Decide when to stop gathering information: keep reading while the clock is long and positions are unknown, and commit once the clock or the numbers force the plan.",
        (("commitment_timing", 60), ("utility_use", 40)),
        _EXECUTE_ACTIONS,
        ("clock", "alive_count", "enemy_seen", "own_utility", "enemy_unknown", "enemy_utility",
         "own_positions", "own_loadout"),
        {"clock": 5, "alive_count": 4, "enemy_seen": 4, "own_utility": 4, "enemy_unknown": 3,
         "enemy_utility": 2, "own_positions": 2, "own_loadout": 1, "bomb_timer": 3, "bomb_location": 1, "defuse_kit": 1},
        (
            ResponseT("continue_plan", "Stick to the line you chose"),
            ResponseT("adjust_to_new_info", "Change your line to use the new information"),
            ResponseT("take_more_info", "Slow down and gather more information"),
            ResponseT("fall_back", "Drop the line you chose and reset"),
        ),
        lambda f: f.time < 15,
        "the round clock is under 15 seconds after the new information, so only a commitment can still plant",
        "continue_plan",
        "Time passes and no defender position has changed decisively.",
        {**_COMMON_NOTES},
    ),
    "hold_or_rotate": _situation(
        "hold_or_rotate",
        "Hold or rotate on {map}",
        "Holding a setup versus shifting weight on partial information",
        "Move weight only for information you trust: a fresh sighting justifies a rotation, an old or unconfirmed one usually does not.",
        (("position_choice", 60), ("information_use", 40)),
        _HOLD_ACTIONS,
        ("enemy_seen", "clock", "alive_count", "enemy_unknown", "own_utility", "enemy_utility",
         "own_positions", "own_loadout"),
        {"enemy_seen": 5, "clock": 4, "alive_count": 4, "enemy_unknown": 4, "own_utility": 3,
         "enemy_utility": 3, "own_positions": 3, "own_loadout": 1, "bomb_timer": 3, "bomb_location": 1, "defuse_kit": 1},
        (
            ResponseT("continue_plan", "Stick to the line you chose"),
            ResponseT("adjust_to_new_info", "Change your line to use the new information"),
            ResponseT("take_more_info", "Slow down and gather more information"),
            ResponseT("fall_back", "Fall back to a deeper position"),
        ),
        lambda f: f.adv <= -2,
        "the team is outnumbered by two or more after the new information",
        "fall_back",
        "Time passes and no attacker position has changed decisively.",
        {**_COMMON_NOTES},
    ),
}
