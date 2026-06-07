"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createPollFormStore,
  type PollFormInit,
  type PollFormState,
  type PollFormStore,
} from "./store";

// Per-mount store via context (the documented Zustand + Next.js App Router
// pattern): a module-level store would be shared across requests on the server,
// so each provider instance gets its own store seeded with the server-computed
// calendar anchor.
const PollFormStoreContext = createContext<PollFormStore | null>(null);

interface PollFormStoreProviderProps {
  init: PollFormInit;
  children: ReactNode;
}

export function PollFormStoreProvider({
  init,
  children,
}: PollFormStoreProviderProps) {
  const storeRef = useRef<PollFormStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createPollFormStore(init);
  }
  return (
    <PollFormStoreContext.Provider value={storeRef.current}>
      {children}
    </PollFormStoreContext.Provider>
  );
}

// Returns the whole form store (fields + actions). This is a single form that
// touches most of its state, so subscribing to everything and patching via
// `patch` is simpler than — and as correct as — a wall of per-field selectors.
export function usePollForm(): PollFormState {
  const store = useContext(PollFormStoreContext);
  if (store === null) {
    throw new Error("usePollForm must be used within PollFormStoreProvider");
  }
  return useStore(store);
}
