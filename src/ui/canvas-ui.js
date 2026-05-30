export function drawPanel(ctx, theme, { x, y, w, h }) {
  ctx.fillStyle = theme.surface;
  ctx.fillRect(x, y, w, h);
}

export function drawText(ctx, text, x, y, opts = {}) {
  const {
    color = '#fff',
    size = 16,
    family = 'system-ui, sans-serif',
    weight = 'normal',
    align = 'left',
    baseline = 'top',
  } = opts;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

export function drawButton(ctx, theme, button) {
  const { x, y, w, h, label, enabled = true, hover = false } = button;

  let fill;
  let textColor;
  if (!enabled) {
    fill = theme.surface;
    textColor = theme.textDisabled;
  } else if (hover) {
    fill = theme.accent;
    textColor = theme.bg;
  } else {
    fill = theme.primary;
    textColor = theme.bg;
  }

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);

  drawText(ctx, label, x + w / 2, y + h / 2, {
    color: textColor,
    size: 20,
    weight: '600',
    align: 'center',
    baseline: 'middle',
  });
}

export function hitTest(rect, px, py) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}
