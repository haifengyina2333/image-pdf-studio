(() => {
  const ns = window.Toolbox ??= {};
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
  const expressions = [
    { id: 'neutral', name: '平静', emoji: '😐' },
    { id: 'smile', name: '微笑', emoji: '😊' },
    { id: 'laugh', name: '大笑', emoji: '🤣' },
    { id: 'surprise', name: '惊讶', emoji: '😮' },
    { id: 'sad', name: '哭泣', emoji: '😭' },
    { id: 'angry', name: '生气', emoji: '😠' },
    { id: 'shy', name: '害羞', emoji: '☺️' },
    { id: 'silly', name: '搞怪', emoji: '🤪' }
  ];
  const expressionIds = new Set(expressions.map((item) => item.id));
  const average = (...values) => values.reduce((sum, value) => sum + clamp(value), 0) / Math.max(1, values.length);

  const categoryMap = (blendshapes = []) => {
    const categories = Array.isArray(blendshapes) ? blendshapes : blendshapes?.categories || [];
    return new Map(categories.map((category) => [category.categoryName || category.displayName || category.name, clamp(category.score)]));
  };

  const classify = (blendshapes = []) => {
    const values = categoryMap(blendshapes); const value = (name) => values.get(name) || 0;
    const smile = average(value('mouthSmileLeft'), value('mouthSmileRight'));
    const frown = average(value('mouthFrownLeft'), value('mouthFrownRight'));
    const browDown = average(value('browDownLeft'), value('browDownRight'));
    const browUp = Math.max(value('browInnerUp'), average(value('browOuterUpLeft'), value('browOuterUpRight')));
    const eyeWide = average(value('eyeWideLeft'), value('eyeWideRight'));
    const eyeBlink = average(value('eyeBlinkLeft'), value('eyeBlinkRight'));
    const eyeSquint = average(value('eyeSquintLeft'), value('eyeSquintRight'));
    const cheekSquint = average(value('cheekSquintLeft'), value('cheekSquintRight'));
    const mouthPress = average(value('mouthPressLeft'), value('mouthPressRight'));
    const mouthLower = average(value('mouthLowerDownLeft'), value('mouthLowerDownRight'));
    const asymmetry = Math.abs(value('mouthSmileLeft') - value('mouthSmileRight')) + Math.abs(value('eyeBlinkLeft') - value('eyeBlinkRight'));
    const jawOpen = value('jawOpen'), pucker = value('mouthPucker'), tongue = value('tongueOut');
    const scores = {
      smile: .74 * smile + .18 * cheekSquint + .08 * (1 - jawOpen),
      laugh: .54 * smile + .32 * jawOpen + .14 * cheekSquint,
      surprise: .42 * jawOpen + .3 * eyeWide + .28 * browUp - .18 * smile,
      sad: .5 * frown + .28 * browUp + .17 * mouthLower + .05 * eyeBlink - .12 * smile,
      angry: .5 * browDown + .22 * eyeSquint + .2 * mouthPress + .08 * frown,
      shy: .42 * smile + .25 * eyeBlink + .23 * cheekSquint + .1 * pucker,
      silly: .38 * tongue + .22 * asymmetry + .2 * pucker + .2 * jawOpen
    };
    if (smile > .43 && jawOpen > .18) scores.laugh += .2;
    if (eyeWide > .34 && jawOpen > .22) scores.surprise += .18;
    if (frown > .3 && browUp > .18) scores.sad += .14;
    if (browDown > .32 && eyeSquint > .16) scores.angry += .15;
    if (tongue > .15 || asymmetry > .5) scores.silly += .18;
    const ranked = Object.entries(scores).map(([id, score]) => [id, clamp(score)]).sort((a, b) => b[1] - a[1]);
    const [bestId, bestScore] = ranked[0] || ['neutral', 0], secondScore = ranked[1]?.[1] || 0;
    const featureComplete = values.size >= 40;
    const reliable = featureComplete && bestScore >= .31 && (bestScore - secondScore >= .045 || bestScore >= .62);
    const neutralReliable = values.size >= 40 && bestScore <= .2;
    const expression = reliable ? bestId : 'neutral';
    return { expression, confidence: expression === 'neutral' ? clamp(1 - bestScore) : clamp(bestScore), reliable: reliable || neutralReliable, scores: Object.fromEntries(ranked), blendshapeCount: values.size };
  };

  const normalize = (value) => expressionIds.has(value) ? value : 'neutral';
  const nameFor = (value) => expressions.find((item) => item.id === normalize(value))?.name || '平静';
  const emojiFor = (value) => expressions.find((item) => item.id === normalize(value))?.emoji || '😐';

  ns.FaceExpression = { expressions, classify, normalize, nameFor, emojiFor };
})();
