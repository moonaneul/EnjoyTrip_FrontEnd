import { normalizePlannerInput } from './validation.js';

const INPUT_KEY = 'teum.planner.pending.v1';
const PLANS_KEY = 'teum.planner.plans.v1';
const ACTIVE_KEY = 'teum.planner.active.v1';

function sessionAvailable() {
  try { return typeof sessionStorage !== 'undefined'; } catch { return false; }
}

export function savePlannerInput(input) {
  if (!sessionAvailable()) return;
  sessionStorage.setItem(INPUT_KEY, JSON.stringify(input));
}

export function loadPlannerInput() {
  if (!sessionAvailable()) return null;
  try {
    const raw = JSON.parse(sessionStorage.getItem(INPUT_KEY) || 'null');
    return normalizePlannerInput(raw);
  } catch { return null; }
}

export function savePlans(plans) {
  if (!sessionAvailable()) return;
  sessionStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function loadPlans() {
  if (!sessionAvailable()) return [];
  try {
    const raw = JSON.parse(sessionStorage.getItem(PLANS_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(revivePlan) : [];
  } catch { return []; }
}

export function saveActivePlan(plan) {
  if (!sessionAvailable()) return;
  sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(plan));
}

export function loadActivePlan() {
  if (!sessionAvailable()) return null;
  try { return revivePlan(JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || 'null')); }
  catch { return null; }
}

function revivePlanDates(plan, reviveVariants = true) {
  if (!plan) return null;
  const revived = {
    ...plan,
    startAt: new Date(plan.startAt),
    returnAt: new Date(plan.returnAt),
    lodgingArrivalAt: plan.lodgingArrivalAt ? new Date(plan.lodgingArrivalAt) : null,
    day1EndAt: plan.day1EndAt ? new Date(plan.day1EndAt) : null,
    day2StartAt: plan.day2StartAt ? new Date(plan.day2StartAt) : null,
    places: (plan.places || []).map((item) => ({
      ...item,
      arriveAt: new Date(item.arriveAt),
      leaveAt: new Date(item.leaveAt),
    })),
  };
  if (reviveVariants && Array.isArray(plan.lodgingVariants)) {
    revived.lodgingVariants = plan.lodgingVariants.map((variant) => revivePlanDates(variant, false));
  }
  return revived;
}

export function revivePlan(plan) {
  return revivePlanDates(plan, true);
}

export { INPUT_KEY, PLANS_KEY, ACTIVE_KEY };
