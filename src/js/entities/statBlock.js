// StatBlock class - encapsulates character statistics
export class StatBlock {
  constructor(body = 1, mind = 1, agility = 1, control = 1, hpBonus = 0, guard = 0, attack = 0) {
    this.body = body;
    this.mind = mind;
    this.agility = agility;
    this.control = control;
    this.hpBonus = hpBonus;
    this.guard = guard;
    this.attack = attack;
  }

  /**
   * Create a copy of this stat block
   * @returns {StatBlock} A new StatBlock with the same values
   */
  clone() {
    return new StatBlock(this.body, this.mind, this.agility, this.control, this.hpBonus, this.guard, this.attack);
  }

  /**
   * Check if this stat block equals another
   * @param {StatBlock} other - The other stat block to compare
   * @returns {boolean} True if all stats are equal
   */
  equals(other) {
    if (!other || !(other instanceof StatBlock)) return false;
    return this.body === other.body &&
           this.mind === other.mind &&
           this.agility === other.agility &&
           this.control === other.control &&
           this.hpBonus === other.hpBonus &&
           this.guard === other.guard &&
           this.attack === other.attack;
  }

  /**
   * Add another stat block to this one (for applying bonuses)
   * @param {StatBlock} other - The stat block to add
   * @returns {StatBlock} A new StatBlock with the sum of all stats
   */
  add(other) {
    if (!other || !(other instanceof StatBlock)) {
      throw new Error('Can only add StatBlock to StatBlock');
    }
    return new StatBlock(
      this.body + other.body,
      this.mind + other.mind,
      this.agility + other.agility,
      this.control + other.control,
      this.hpBonus + other.hpBonus,
      this.guard + other.guard,
      this.attack + other.attack
    );
  }

  /**
   * Subtract another stat block from this one
   * @param {StatBlock} other - The stat block to subtract
   * @returns {StatBlock} A new StatBlock with the difference of all stats
   */
  subtract(other) {
    if (!other || !(other instanceof StatBlock)) {
      throw new Error('Can only subtract StatBlock from StatBlock');
    }
    return new StatBlock(
      this.body - other.body,
      this.mind - other.mind,
      this.agility - other.agility,
      this.control - other.control,
      this.hpBonus - other.hpBonus,
      this.guard - other.guard,
      this.attack - other.attack
    );
  }

  /**
   * Get all stat names as an array
   * @returns {string[]} Array of stat property names
   */
  getStatNames() {
    return ['body', 'mind', 'agility', 'control', 'hpBonus', 'guard', 'attack'];
  }

  /**
   * Get a stat value by name
   * @param {string} statName - The name of the stat to get
   * @returns {number} The value of the stat
   */
  getStat(statName) {
    if (!this.getStatNames().includes(statName)) {
      throw new Error(`Unknown stat: ${statName}`);
    }
    return this[statName];
  }

  /**
   * Set a stat value by name
   * @param {string} statName - The name of the stat to set
   * @param {number} value - The value to set
   */
  setStat(statName, value) {
    if (!this.getStatNames().includes(statName)) {
      throw new Error(`Unknown stat: ${statName}`);
    }
    this[statName] = value;
  }

  /**
   * Convert to a plain object (for serialization)
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      body: this.body,
      mind: this.mind,
      agility: this.agility,
      control: this.control,
      hpBonus: this.hpBonus,
      guard: this.guard,
      attack: this.attack
    };
  }

  /**
   * Create StatBlock from plain object (for deserialization)
   * @param {Object} obj - Plain object with stat values
   * @returns {StatBlock} New StatBlock instance
   */
  static fromObject(obj) {
    return new StatBlock(
      obj.body || 0,
      obj.mind || 0,
      obj.agility || 0,
      obj.control || 0,
      obj.hpBonus || 0,
      obj.guard || 0,
      obj.attack || 0
    );
  }
}
