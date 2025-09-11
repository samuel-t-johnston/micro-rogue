// Centralized data file loading system
export class DataFileLoader {
  constructor() {
    this.cache = new Map();
  }

  // Load items from JSON file
  async loadItems() {
    const cacheKey = 'items';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('/data/items/items.json');
      if (!response.ok) {
        throw new Error(`Failed to load items: ${response.status} ${response.statusText}`);
      }
      const itemsData = await response.json();
      console.log('Items loaded:', itemsData);
      
      this.cache.set(cacheKey, itemsData);
      return itemsData;
    } catch (error) {
      console.error('Error loading items:', error);
      return {};
    }
  }

  // Load furniture from JSON file
  async loadFurniture() {
    const cacheKey = 'furniture';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('/data/furniture/furniture.json');
      if (!response.ok) {
        throw new Error(`Failed to load furniture: ${response.status} ${response.statusText}`);
      }
      const furnitureData = await response.json();
      console.log('Furniture loaded:', furnitureData);
      
      this.cache.set(cacheKey, furnitureData);
      return furnitureData;
    } catch (error) {
      console.error('Error loading furniture:', error);
      return {};
    }
  }

  // Load a level from a JSON file
  async loadLevel(levelPath) {
    const cacheKey = `level_${levelPath}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(levelPath);
      if (!response.ok) {
        throw new Error(`Failed to load level: ${response.status} ${response.statusText}`);
      }
      const levelData = await response.json();
      
      this.cache.set(cacheKey, levelData);
      return levelData;
    } catch (error) {
      console.error('Error loading level:', error);
      throw error;
    }
  }

  // Clear cache (useful for testing or when data might have changed)
  clearCache() {
    this.cache.clear();
  }

  // Clear specific cache entry
  clearCacheEntry(key) {
    this.cache.delete(key);
  }
}
