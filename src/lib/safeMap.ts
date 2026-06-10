/**
 * Safe Map utilities to prevent "Cannot read properties of undefined (reading 'get')" errors
 */

export const safeMapGet = <K, V>(map: Map<K, V> | undefined | null, key: K, defaultValue?: V): V | undefined => {
  if (!map || !(map instanceof Map)) {
    return defaultValue;
  }
  return map.get(key) ?? defaultValue;
};

export const safeMapHas = <K, V>(map: Map<K, V> | undefined | null, key: K): boolean => {
  if (!map || !(map instanceof Map)) {
    return false;
  }
  return map.has(key);
};

export const ensureMap = <K, V>(map: Map<K, V> | undefined | null): Map<K, V> => {
  if (map instanceof Map) {
    return map;
  }
  return new Map();
};
