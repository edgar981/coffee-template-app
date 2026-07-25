import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Accepted pattern: mount-effect data fetching (load() in useEffect).
      // Scheduled to be replaced by TanStack Query at template-extraction phase.
      // Downgraded to warn so lint errors stay a real signal. Do not upgrade
      // back to error without doing that migration.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Known `any`s in vendored/auth typing — fix when typing the session
    // properly; rule stays error for all new code. Scoped to these exact
    // pre-existing files: vendored shadcn/ui (chart, use-toast) and the
    // next-auth `(session.user as any).role` gap (perfil, cuenta, role route).
    // Delete this override once the Session/User types are modeled.
    files: [
      "components/ui/chart.tsx",
      "components/ui/use-toast.ts",
      "app/(admin)/admin/perfil/page.tsx",
      "app/(storefront)/cuenta/page.tsx",
      "app/api/users/*/role/route.ts", // app/api/users/[id]/role/route.ts
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
