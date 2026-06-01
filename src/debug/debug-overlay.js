export function createDebugOverlay({ getViewport }) {
  const canvas = document.getElementById('debug');
  const ctx = canvas.getContext('2d');
  let visible = false;
  let pointerX = 0;
  let pointerY = 0;
  let pointerInfo = null;

  return {
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = getViewport();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    toggle() {
      visible = !visible;
    },

    setPointerPos(x, y, info) {
      pointerX = x;
      pointerY = y;
      pointerInfo = info;
    },

    render() {
      const { width, height } = getViewport();
      ctx.clearRect(0, 0, width, height);
      if (!visible || !pointerInfo) return;

      const { x, y, tileName, entityNames, passable, opaque } = pointerInfo;

      ctx.font = '12px monospace';

      const lines = [`${x},${y}`];
      if (tileName) {
        lines.push(`${tileName}  pass:${passable ? '✓' : '✗'}  opq:${opaque ? '✓' : '✗'}`);
      }
      if (entityNames?.length) lines.push(...entityNames);

      const lineH = 16;
      const pad = 4;
      const maxTextW = Math.max(...lines.map(l => ctx.measureText(l).width));
      const boxW = maxTextW + pad * 2;
      const boxH = lines.length * lineH + pad * 2;

      let lx = pointerX + 14;
      let ly = pointerY - boxH - 6;
      if (lx + boxW > width) lx = pointerX - boxW - 6;
      if (ly < 0) ly = pointerY + 14;

      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(lx, ly, boxW, boxH);
      ctx.fillStyle = '#00ff41';
      lines.forEach((line, i) => {
        ctx.fillText(line, lx + pad, ly + pad + (i + 1) * lineH - 3);
      });
    },
  };
}
