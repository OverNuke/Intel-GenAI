"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { ROLE_HOME } from "@/lib/access-labels";
import { apiPost } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { SignInForm } from "@/ui/organisms/sign-in-form";

type User = components["schemas"]["UserOut"];

/** Container: wires the presentational form to the API and the router. */
export function SignInContainer({ accounts }: { accounts: User[] | null }) {
  const router = useRouter();
  return (
    <SignInForm
      accounts={accounts}
      login={(body) => apiPost("/api/auth/login", body)}
      onSignedIn={(user) => {
        // A transition keeps the busy button responsive while the role home renders.
        startTransition(() => {
          router.replace(ROLE_HOME[user.role]);
          router.refresh();
        });
      }}
    />
  );
}
