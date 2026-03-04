import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        variables: {
          colorPrimary: "#6366F1",
          fontFamily: "var(--font-plus-jakarta-sans)",
        },
      }}
      afterSignInUrl="/"
    />
  );
}
