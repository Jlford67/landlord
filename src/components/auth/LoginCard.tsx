import Image from "next/image";
import LoginFormClient from "@/app/login/LoginFormClient";

export default function LoginCard() {
  return (
    <div className="ll_card p-8 sm:p-10">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/landlord-logo.png"
          alt="Landlord"
          width={180}
          height={72}
          priority
          className="h-14 w-auto"
        />
        <h1 className="mt-6 text-[28px] font-extrabold text-gray-900">Sign in</h1>
        <p className="mt-2 text-sm text-gray-500">Use your email and password to continue.</p>
      </div>

      <div className="mt-8">
        <LoginFormClient />
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Private access for your portfolio.
      </p>
    </div>
  );
}
