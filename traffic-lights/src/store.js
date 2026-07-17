// Minimal observable store: the UI subscribes and reacts to state changes;
// game logic never touches the DOM.

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    get: () => state,
    set(next) {
      const prev = state;
      state = next;
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
