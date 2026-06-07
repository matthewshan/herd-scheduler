"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createCreateFormStore,
  type CreateFormInit,
  type CreateFormState,
  type CreateFormStore,
} from "./store";

// Per-mount store via context (the documented Zustand + Next.js App Router
// pattern): a module-level store would be shared across requests on the server,
// so each provider instance gets its own store seeded with the server-computed
// calendar anchor.
const CreateFormStoreContext = createContext<CreateFormStore | null>(null);

interface CreateFormStoreProviderProps {
  init: CreateFormInit;
  children: ReactNode;
}

export function CreateFormStoreProvider({
  init,
  children,
}: CreateFormStoreProviderProps) {
  const storeRef = useRef<CreateFormStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createCreateFormStore(init);
  }
  return (
    <CreateFormStoreContext.Provider value={storeRef.current}>
      {children}
    </CreateFormStoreContext.Provider>
  );
}

// Returns the whole form store (fields + actions). This is a single form that
// touches most of its state, so subscribing to everything and patching via
// `patch` is simpler than — and as correct as — a wall of per-field selectors.
export function useCreateForm(): CreateFormState {
  const store = useContext(CreateFormStoreContext);
  if (store === null) {
    throw new Error(
      "useCreateForm must be used within CreateFormStoreProvider",
    );
  }
  return useStore(store);
}
