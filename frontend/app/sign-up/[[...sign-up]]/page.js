import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-lg font-bold text-primary">DISHA AI</h1>
        <p className="mt-1 text-body-md text-secondary">
          Create your account to get started
        </p>
      </div>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
