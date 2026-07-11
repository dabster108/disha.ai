import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-lg font-bold text-primary">DISHA AI</h1>
        <p className="mt-1 text-body-md text-secondary">
          Sign in to continue to your dashboard
        </p>
      </div>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
