// Furniture class to encapsulate furniture behavior and state
export class Furniture {
  constructor(x, y, furnitureId, furnitureData) {
    this.x = x;
    this.y = y;
    this.furnitureId = furnitureId;
    this.state = furnitureData.defaultState || null;
    this.containerItems = furnitureData.container ? [] : null;
    this.data = furnitureData; // Reference to the furniture definition
  }

  // Toggle furniture state (for doors, chests, etc.)
  toggleState() {
    if (!this.data.stateful || !this.data.states) {
      return false;
    }

    const currentStateIndex = this.data.states.indexOf(this.state);
    if (currentStateIndex === -1) {
      return false;
    }

    const nextStateIndex = (currentStateIndex + 1) % this.data.states.length;
    this.state = this.data.states[nextStateIndex];
    return true;
  }

  // Check if this furniture blocks movement
  isPassible() {
    // If furniture is always impassible
    if (this.data.impassible) {
      return false;
    }

    // If furniture is stateful and has impassibleWhen conditions
    if (this.data.impassibleWhen && this.state) {
      return !this.data.impassibleWhen.includes(this.state);
    }

    return true;
  }

  // Add item to furniture container
  addItemToContainer(item) {
    if (!this.containerItems) {
      return false; // Not a container
    }

    if (!this.data.container) {
      return false; // Not a container
    }

    if (this.containerItems.length >= this.data.container.capacity) {
      return false; // Container is full
    }

    this.containerItems.push(item);
    return true;
  }

  // Remove item from furniture container
  removeItemFromContainer(itemIndex) {
    if (!this.containerItems) {
      return null; // Not a container
    }

    if (itemIndex < 0 || itemIndex >= this.containerItems.length) {
      return null; // Invalid index
    }

    return this.containerItems.splice(itemIndex, 1)[0];
  }

  // Get furniture name
  getName() {
    return this.data.name || 'Unknown Furniture';
  }

  // Get furniture symbol
  getSymbol() {
    return this.data.symbol || 'F';
  }

  // Check if furniture is stateful
  isStateful() {
    return this.data.stateful || false;
  }

  // Check if furniture is a container
  isContainer() {
    return this.data.container !== undefined;
  }

  // Check if furniture is usable
  isUsable() {
    return this.data.usable !== undefined;
  }

  // Get current state description
  getStateDescription() {
    if (this.isStateful() && this.state) {
      return `${this.getName()} (${this.state})`;
    }
    return this.getName();
  }

  // Get container items
  getContainerItems() {
    return this.containerItems || [];
  }

  // Get container capacity
  getContainerCapacity() {
    return this.data.container?.capacity || 0;
  }

  // Get container status description
  getContainerStatus() {
    if (!this.isContainer()) {
      return null;
    }
    
    const itemCount = this.containerItems ? this.containerItems.length : 0;
    const capacity = this.getContainerCapacity();
    
    if (this.state === 'closed') {
      return `(${itemCount}/${capacity} items)`;
    } else {
      return `(${itemCount}/${capacity} items)`;
    }
  }
}
