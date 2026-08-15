import { LoginForm } from "@/components/forms/login-form";

export const dynamic = "force-static";

export default function LoginPage() {
  return (
    <div className="rounded-[20px] border border-[#E4E4E7] bg-white p-8 shadow-sm ">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#18181B] ">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your admin account</p>
      </div>
      <LoginForm />
    </div>
  );
}
