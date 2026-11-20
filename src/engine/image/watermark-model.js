(() => {
  const ns = window.Toolbox ??= {};
  const anchors = [[.08,.08],[.5,.08],[.92,.08],[.08,.5],[.5,.5],[.92,.5],[.08,.92],[.5,.92],[.92,.92]];
  const defaultOptions = () => ({
    kind: 'text', text: '© YOUR STUDIO', font: 'Arial, sans-serif', weight: '600', color: '#ffffff',
    sizeRatio: .07, opacity: .72, rotation: 0, tile: false, density: .6,
    offsetXRatio: 0, offsetYRatio: 0, position: { xRatio: .92, yRatio: .92 }, logo: null
  });
  const fromControls = (controls, state) => {
    const fallback = defaultOptions();
    return {
      ...fallback,
      kind: state.kind,
      text: controls.watermarkText.value || fallback.text,
      font: controls.fontFamily.value,
      weight: controls.fontWeight.value,
      color: controls.color.value,
      sizeRatio: Number(controls.size.value) / 100,
      opacity: Number(controls.opacity.value) / 100,
      rotation: Number(controls.rotation.value),
      tile: controls.tile.checked,
      density: Number(controls.density.value) / 100,
      offsetXRatio: Number(controls.offsetX.value) / 100,
      offsetYRatio: Number(controls.offsetY.value) / 100,
      position: state.position ?? fallback.position,
      logo: state.logo ?? null
    };
  };
  const positionForAnchor = (index) => { const [xRatio, yRatio] = anchors[index] ?? anchors[8]; return { xRatio, yRatio }; };
  ns.WatermarkModel = { defaultOptions, fromControls, positionForAnchor };
})();
