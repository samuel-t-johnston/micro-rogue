/**
 * A stack of UI layers (scenes, dialogs, menus). Rendering walks bottom-to-top; input is offered
 * top-to-bottom and stops at the first layer that returns true from `handleInput` (modal behavior).
 */
export class LayerStack {
  constructor() {
    this._layers = [];
  }

  push(layer) {
    this._layers.push(layer);
  }

  pop() {
    return this._layers.pop();
  }

  top() {
    return this._layers[this._layers.length - 1];
  }

  get size() {
    return this._layers.length;
  }

  render(ctx) {
    for (const layer of this._layers) {
      layer.render?.(ctx);
    }
  }

  handleInput(event) {
    for (let i = this._layers.length - 1; i >= 0; i--) {
      const handled = this._layers[i].handleInput?.(event);
      if (handled) return true;
    }
    return false;
  }
}
