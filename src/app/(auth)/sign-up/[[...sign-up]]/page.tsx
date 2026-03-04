import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        variables: {
          colorPrimary: "#6366F1",
          fontFamily: "var(--font-plus-jakarta-sans)",
        },
      }}
      afterSignUpUrl="/"
    />
  );
}
