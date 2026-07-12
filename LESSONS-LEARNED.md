# Lessons Learned

> Project-agnostic. These are **laws, not suggestions** — for every project, for human and AI
> contributors alike. No project, stack, vendor, file, or scenario specifics: a rule that only
> survives inside one story was never a lesson. Each law is phrased **trigger -> action -> verify**
> so it bites. Aspirational prose changes nothing.
>
> The authoritative copy belongs at the **top of the always-loaded rules file** (e.g. `AGENTS.md`).
> A law buried in a doc the agent never auto-loads is not a law — it is decoration (Law S).

---

## A. "Done" means it runs and was verified — nothing less
A task is **not** done until ALL of these are true. Merging is not functioning. Building is not
working. Editing a file is not shipping.

- [ ] It **runs end-to-end** the way it really runs — every required service and config up. Not
      "it compiles."
- [ ] It has **at least one demoable function**: a real action producing a real result (data
      read/written, state changed). A rendered screen with nothing behind it is a mock, not done.
- [ ] It was **exercised in the role/context/device it targets** — not just the author's easiest
      path or highest-privilege login.
- [ ] A **"how to test this"** note ships with it (steps + expected result) — see Law L.
- [ ] Build/checks pass. Necessary, never sufficient. Never confuse a green check with a working feature.
- [ ] It is **verified in the real target environment**, not just on the author's machine. If it
      isn't safe there yet, it ships **behind a flag/kill switch** — and still doesn't count as done.

> Litmus: "Could a non-expert open it and watch this work?" If not, it is a draft.
> **"Merged" is not "working." "Deployed" is not "verified."**

## B. Read the source of truth before you touch the code — every time
- Before writing a line, read the governing plan/spec/status and **state in one line how this task
  maps to an approved item.** Skip this and you are guessing what you're supposed to build.
- If the task is **not on any board**, or **contradicts** the docs, **stop and raise it.** Do not
  freelance scope. Do not silently diverge. Drifting from the plan is how the wrong thing gets built well.

## C. Review keeps pace with build — or build stops
- **One task = one small reviewable unit**, reviewed **before** the next one starts.
- **Do not batch.** Three features shipped before review is three reviews, not one rubber stamp.
- Cap work-in-flight to what a human can actually review. Velocity that outruns oversight is debt,
  not progress.

## D. Integration hygiene — never stack, never co-mingle
- Start every task from the **mainline**, current and pulled. Never base work on **unmerged** work —
  it cannot be reviewed or reverted independently.
- **One change per unit.** Never tangle two features in one working tree or one commit. If a file
  holds two in-flight changes, split them before you commit. Co-mingled work ships bugs you didn't intend to.
- Strip debug and throwaway instrumentation before committing. It does not belong in history.

## E. Foundations before features
- Build the spine first — identity/auth, the core data path, one real action working — before
  stacking widgets on top. Role-gated screens with no role system are dead weight.
- Every increment must leave the product **more usable**, not just larger.

## F. Label demo vs real — and never let a mock count
- The plan/PR states plainly which parts are **real (wired)** and which are **preview/mock/flag-gated.**
- A preview is never "done." "It looks finished" is not "it works." Do not let scaffolding masquerade as an MVP.

## G. Delegate only via a complete, bounded brief
A one-line wish is how a delegated agent runs off and burns a day. Every delegated/automated task
is a filled-in template, small and independent:

```
Base: mainline (do NOT stack on unmerged work).
Read first: <the governing docs>. State in one line how this maps to an approved item.
Task (one deliverable): ____
In scope: ____
Out of scope / do NOT touch: ____
Definition of Done: runs end-to-end, one demoable function (not just UI), exercised in the
  target role/context, include a "how to test" note, build/checks pass.
Stop and ask before: any schema/data-migration/RLS change, any shared or cross-system contract
  change, any new secret/vendor, any architecture/auth/security decision, or anything that
  contradicts the docs.
Output: one small reviewable unit off mainline, then stop.
```

## H. Guiding a non-technical stakeholder — make it followable, or you failed
The burden of clarity is on you. If they have to ask "what do you mean / what's next?", that is
your defect, not theirs. Default to this without being asked:
- **Numbered steps, one action per step.** No paragraphs of mixed instructions.
- Each step: **where to click** (exact label + location), **what to type/paste**, **what success
  looks like.**
- **Show, don't just tell** — visuals/screenshots, exact labels.
- **Never make them decide a technical question cold** — give a recommendation and a sensible
  default, then let them override.
- **One task at a time, in order.** No re-sequencing without a one-line "why."
- **No jargon.** Define it once if unavoidable.
- **End with one clear next action** — not a menu, unless a real decision is needed.

## I. Vertical slice before breadth — a walking skeleton beats a beautiful corpse
- Get **one path working end-to-end first** — one input, one real action, all the way through and
  back — before widening to more features.
- Breadth built on an untested spine multiplies risk. A working skeleton beats a beautiful dead body.

## J. ONE source of truth for status and sequencing
- Pick **one** canonical status/roadmap doc; everything else links to it. **One** numbering scheme;
  map legacy labels to it once. Conflicting docs and rival numbering schemes cause real confusion.
- **Update it at the end of every task, before starting the next.** A stale source of truth is a lie.

## K. Confirm before acting — state intent, push back, get sign-off
After an instruction, do NOT just execute and move on. First:
1. **State what you are about to do**, in one or two plain lines.
2. **Push back if it isn't the best call** — reasoning plus a better option.
3. **Get explicit confirmation** before proceeding.

**Hold the line.** Do not flip-flop or appease under pressure. Defend your position with a stronger
source of truth, or formally amend the doc (Law N) — do not silently cave. Caving when challenged
is not humility; it is abandoning the truth you were hired to hold. **Exemptions:** read-only
investigation; tiny clearly-bounded asks; and **pre-authorised batches** ("do all of these") — then
proceed without nagging for re-confirmation on each.

## L. "How to test" starts with how to get the new code on the screen
The first step of every "how to test" note is the exact way to obtain and run the build under test:
which branch/build to fetch, how to start it, which entry point/URL to open, any flag/opt-in
required. **Never assume the reviewer is on the right branch or build — they almost never are.**
Skip this and they test the old code and see nothing, and you both waste the round trip.

## M. Verify external tools/APIs against current docs BEFORE you guide — they change
Your knowledge of external platforms (hosting, auth, payments, vendor dashboards/APIs) is frozen
and **their auth models change.** Step-by-step guidance built from memory is exactly how the
mismatch happens.

- **Verify before you write step 1. This is the real rule.** Confirm the current procedure against
  official docs/changelog, then write steps. A 30-second check beats an hour of clicking.
- **A mismatch is not bad luck — it's proof you skipped verification.** If the button/field/token
  isn't where you said, you guided from a stale mental model. Own it; do not blame the user's clicking.
- **Circuit-breaker — 1 strike.** The instant reality diverges from your instructions even once,
  STOP. Do not guess again. One wrong guess is the signal — don't spend a second one of the user's time.
- **Verify every link in the chain** — which credential, which grant, environment eligibility. One
  verified assumption does not license guessing the next.
- **"I wrote it and it built" is NEVER "it works."** Do not call unverified work "the fix,"
  "durable," or "correct" — least of all against an environment you have never run it in.
- **Check environment eligibility, not just that a feature exists** — dev vs production, plan tier,
  region, sandbox vs live. A capability in one context routinely fails in another.
- **A push for verification is a signal, not friction.** "Research first" means apply the rigor you skipped.

## N. Deviation only by amendment
To depart from a governing doc, **propose a written, justified edit to that exact doc, get sign-off,
then follow the updated doc.** No silent compromise. No side-plan workaround. No freelancing. The
doc is followed or it is changed — there is no third option. If a doc is wrong, fix it or burn it;
do not quietly ignore it.

## O. Docs must not contradict each other
Two docs governing the same thing is a defect. **Stop and reconcile by amendment** — never quietly
cherry-pick the one you prefer. A self-contradicting doc set is rubbish until the stale clause is fixed or retired.

## P. Schema/data before the code that uses it
Never ship a writer before its column/table/structure/policy exists. Deploy reader and writer
together. Version every persisted-data shape change and keep a migration for old data, so a new
writer and an old reader can never coexist. Get this wrong and you corrupt or crash live data.

## Q. Shared and cross-system resources are NEVER changed unilaterally
Shared schemas, shared identity/role models, and any cross-system contract are proposed, reviewed
by the owning parties, and sequenced across every affected side. Changing one alone breaks the others silently.

## R. Honesty and conduct
- **Don't declare success prematurely.** Default to skeptical, not congratulatory. "Merged / pushed
  / built" is not a victory. Verify it runs and is usable before you say "done."
- **Verify before asserting; lead with the correction.** When you were wrong, the fix goes in the
  first sentence — not buried, not hedged.
- **Advise, don't just agree.** Flip-flopping the moment you're pushed is useless. Weigh it, give a
  firm reasoned recommendation, then let the owner decide.
- **Surface gaps proactively.** Flag "is this actually usable end-to-end?" early — before a
  frustrated stakeholder finds the hole for you.
- **Proof of done is an artifact, not a claim.** Ship a short walkthrough (steps + what was seen
  working) so anyone can confirm it without re-testing from scratch.
- **Never fabricate.** If a referenced doc, file, or feature does not exist, say so. Do not invent it to look complete.
- **Protect the stakeholder's time.** Making them ask twice is your failure, not theirs.

## S. Make the rules bite — placement, phrasing, enforcement
Good intentions in prose change nothing. Behaviour changes through **placement + trigger-phrasing +
enforcement.**
- A rule in a file the agent does not auto-load is ~0% binding until something forces it to be read.
- Rules phrased **trigger -> action -> verify** get far higher compliance than abstract principles.
- A rule at the **top** of the loaded file beats the same rule mid-document.
- A **blocking pre-action hook** beats any prose. If a law MUST hold, back it with a hook or a check.

So: keep the authoritative copy at the **top of the always-loaded rules file**, write it as
triggers, and enforce the critical ones with hooks/CI. Do not trust a companion document to be read.

## One-line summary
**Stop equating "merged" with "working."** Ground every task in the plan, change docs by amendment
not by stealth, ship one small reviewable **runnable** slice per change (never co-mingled), verify
external platforms before you guide, and hold the truth under pressure.
