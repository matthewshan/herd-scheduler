"use client";

import { Button } from "@/components/ui";
import type { ButtonProps } from "@/components/ui/Button";
import { markPendingClaim } from "@/lib/guest";

// The sign-in screen's submit button (a client island inside the server-rendered
// SignInScreen). If this browser holds a guest identity, clicking it sets the
// one-shot pending-claim marker so the signed-in home adopts that guest's votes
// into the account on return — the only home-screen path that claims.
export function ClaimingSignInButton({ onClick, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        try {
          markPendingClaim(localStorage);
        } catch {
          // storage unavailable — nothing to claim
        }
        onClick?.(e);
      }}
    />
  );
}
