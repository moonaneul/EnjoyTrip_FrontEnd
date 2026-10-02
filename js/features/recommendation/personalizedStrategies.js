const CATEGORY_LABELS = Object.freeze({
  nature:'자연', food:'맛집', cafe:'카페', culture:'문화', history:'역사', shopping:'쇼핑', photo:'사진·전망', local:'로컬', activity:'체험',
});

const CATEGORY_ICONS = Object.freeze({
  nature:'🌳', food:'🍜', cafe:'☕', culture:'🎨', history:'🏛', shopping:'🛍', photo:'📷', local:'🏘', activity:'🎯',
});

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function rankedCategories(preference) {
  return Object.entries(preference?.categoryWeights || {})
    .sort((a,b) => b[1] - a[1])
    .map(([key, weight]) => ({ key, weight, label:CATEGORY_LABELS[key] || key, icon:CATEGORY_ICONS[key] || '✦' }));
}

function paceMode(preference) {
  const pace = Number(preference?.pace ?? 0.5);
  const rest = Number(preference?.restImportance ?? 0.5);
  if (pace <= 0.35 || rest >= 0.72) return 'relaxed';
  if (pace >= 0.72 && rest < 0.65) return 'active';
  return 'balanced';
}

function paceCopy(mode) {
  if (mode === 'relaxed') return '천천히 머무는';
  if (mode === 'active') return '알차게 경험하는';
  return '균형 있게 즐기는';
}

function focusLabel(items) {
  return items.slice(0,2).map((item)=>item.label).join(' · ') || '취향';
}

export function buildPersonalizedStrategies(preference, input = {}) {
  const categories = rankedCategories(preference);
  const top = categories.slice(0,2);
  const secondary = categories.slice(2,5).filter((item)=>item.weight >= 0.42);
  const mode = paceMode(preference);
  const primary = focusLabel(top);
  const moodCopy = (input?.moods || []).length ? (input.moods || []).join(' · ') : null;
  const neutral = !preference || preference.source === 'neutral';

  const signatureLabel = neutral
    ? (mode === 'relaxed' ? '느긋한 균형 코스' : mode === 'active' ? '알찬 균형 코스' : '균형 추천 코스')
    : (mode === 'relaxed' ? '느긋한 취향 코스' : mode === 'active' ? '취향 가득 코스' : '취향 균형 코스');

  const focusStrategyLabel = neutral
    ? (moodCopy ? `${moodCopy} 집중 코스` : '오늘의 테마 코스')
    : (mode === 'relaxed' ? `${primary} 중심 코스` : `${primary} 집중 코스`);

  const discoveryLabel = mode === 'relaxed'
    ? '여유로운 발견 코스'
    : mode === 'active' ? '취향 확장 탐험 코스' : '취향 확장 발견 코스';

  return [
    {
      id:'signature', legacyType:'slow', icon:mode === 'relaxed' ? '🌿' : '🧭',
      label:signatureLabel,
      tag:neutral ? 'BALANCED' : 'MY TASTE',
      tagline:neutral
        ? `이번 여행 조건 안에서 ${paceCopy(mode)} 기본안을 만들었어요.`
        : `${primary} 취향을 중심으로 ${paceCopy(mode)} 대표안을 만들었어요.`,
      focusKeys:top.map((item)=>item.key), explorationKeys:[], targetOffset:0,
      dwellMultiplier:mode === 'relaxed' ? 1.08 : mode === 'active' ? 0.96 : 1.02,
      safetyDelta:mode === 'relaxed' ? 4 : 0,
      mode,
    },
    {
      id:'focus', legacyType:'full', icon:top[0]?.icon || '🎯',
      label:focusStrategyLabel,
      tag:'TASTE FOCUS',
      tagline:moodCopy
        ? `저장된 취향에 이번 여행의 ${moodCopy} 분위기를 더 강하게 반영했어요.`
        : `${primary} 선호를 더 선명하게 반영한 일정이에요.`,
      focusKeys:top.map((item)=>item.key), explorationKeys:[], targetOffset:mode === 'active' ? 1 : mode === 'relaxed' ? -1 : 0,
      dwellMultiplier:mode === 'relaxed' ? 1.12 : mode === 'active' ? 0.9 : 1,
      safetyDelta:mode === 'relaxed' ? 3 : 0,
      mode,
    },
    {
      id:'discovery', legacyType:'random', icon:'✨',
      label:discoveryLabel,
      tag:'TASTE DISCOVERY',
      tagline:secondary.length
        ? `${primary} 취향을 지키면서 ${focusLabel(secondary)} 같은 새로운 선택지를 조금 섞었어요.`
        : `${primary} 취향의 경계 안에서 새로운 장소를 조금 섞었어요.`,
      focusKeys:top.map((item)=>item.key), explorationKeys:secondary.map((item)=>item.key), targetOffset:0,
      dwellMultiplier:mode === 'relaxed' ? 1.02 : mode === 'active' ? 0.94 : 0.98,
      safetyDelta:mode === 'relaxed' ? 2 : 0,
      mode,
    },
  ];
}

export function preferenceForStrategy(preference, strategy) {
  if (!preference) return null;
  const next = {
    ...preference,
    categoryWeights:{ ...(preference.categoryWeights || {}) },
  };

  if (strategy?.id === 'focus') {
    for (const key of Object.keys(next.categoryWeights)) {
      const current = Number(next.categoryWeights[key] ?? 0.5);
      next.categoryWeights[key] = strategy.focusKeys.includes(key)
        ? clamp(current + 0.16)
        : clamp(current - 0.05);
    }
  }

  if (strategy?.id === 'discovery') {
    next.discoveryStyle = clamp(Number(next.discoveryStyle ?? 0.5) + 0.18);
    for (const key of strategy.explorationKeys || []) {
      next.categoryWeights[key] = clamp(Number(next.categoryWeights[key] ?? 0.5) + 0.15);
    }
  }
  return next;
}

export function personalizedTargetCount({ tripSpan = 'day', preference, strategy, micro = false } = {}) {
  const mode = strategy?.mode || paceMode(preference);
  if (micro) {
    const base = mode === 'active' ? 3 : 2;
    return Math.max(2, base + Math.min(0, Number(strategy?.targetOffset || 0)));
  }
  const base = tripSpan === 'overnight'
    ? (mode === 'relaxed' ? 6 : mode === 'active' ? 9 : 7)
    : (mode === 'relaxed' ? 3 : mode === 'active' ? 5 : 4);
  const rest = Number(preference?.restImportance ?? 0.5);
  const restAdjustment = mode === 'relaxed' && rest >= 0.8 ? -1 : 0;
  const minimum = tripSpan === 'overnight' ? 4 : 2;
  return Math.max(minimum, base + Number(strategy?.targetOffset || 0) + restAdjustment);
}

export function strategyDwellScale(preference, strategy, { micro = false, overnight = false } = {}) {
  const mode = strategy?.mode || paceMode(preference);
  let scale = mode === 'relaxed' ? 1.16 : mode === 'active' ? 0.8 : 0.98;
  if (overnight) scale *= 0.94;
  if (micro) scale *= 0.72;
  scale *= Number(strategy?.dwellMultiplier || 1);
  return Math.max(0.56, Math.min(1.42, scale));
}

export function strategySafetyBuffer(base, preference, strategy) {
  const rest = Number(preference?.restImportance ?? 0.5);
  const extra = Number(strategy?.safetyDelta || 0) + (rest >= 0.8 ? 3 : 0);
  return Math.max(8, Math.round(Number(base || 12) + extra));
}

export function strategyTitle(strategy, selected, tripSpan = 'day') {
  const area = selected[0]?.place?.categoryPath?.split(' · ')[0]
    || selected[0]?.place?.address?.split(' ').slice(0,2).join(' ')
    || '가까운 곳';
  return `${area} · ${strategy?.label || '맞춤 여행'}${tripSpan === 'overnight' ? ' 1박2일' : ''}`;
}
