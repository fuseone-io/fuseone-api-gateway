export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: form area */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>

      {/* Right: illustration (hidden on mobile) */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-[#0a1628] to-[#1a0a2e] p-12 lg:flex lg:w-[45%]">
        <div className="max-w-md">
          <img
            src="/hero-illustration.svg"
            alt="API Gateway"
            className="animate-float h-auto w-full"
          />
          <div className="mt-8 text-center">
            <h2 className="text-2xl font-bold text-white">
              <span className="text-blue-400">Fuse</span>
              <span className="font-light text-gray-300">One</span>
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Developer Portal — Discover, Connect & Integrate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
