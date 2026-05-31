export function createDebugOverlay({ getViewport }) {
  const canvas = document.getElementById('debug');
  const ctx = canvas.getContext('2d');
  let visible = false;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTile = null;

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

    setPointerPos(x, y, tile) {
      pointerX = x;
      pointerY = y;
      pointerTile = tile;
    },

    render() {
      const { width, height } = getViewport();
      ctx.clearRect(0, 0, width, height);
      if (!visible || !pointerTile) return;

      const label = `${pointerTile.x},${pointerTile.y}`;
      ctx.font = '12px monospace';
      const textW = ctx.measureText(label).width;
      const pad = 4;
      const boxW = textW + pad * 2;
      const boxH = 20;

      let lx = pointerX + 14;
      let ly = pointerY - 24;
      if (lx + boxW > width) lx = pointerX - boxW - 6;
      if (ly < 0) ly = pointerY + 14;

      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(lx, ly, boxW, boxH);
      ctx.fillStyle = '#00ff41';
      ctx.fillText(label, lx + pad, ly + boxH - pad - 2);
    },
  };
}
