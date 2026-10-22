// Persistencia local: config, historial, favoritas.
const K = (n: string) => `bdp:${n}`;
export const store = {
  load<T>(name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(K(name));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  save(name: string, value: unknown) {
    try { localStorage.setItem(K(name), JSON.stringify(value)); } catch { /* noop */ }
  }
};
