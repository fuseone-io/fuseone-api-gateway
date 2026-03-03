import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.svg" alt="FuseOne" className="h-6 w-6" />
            <span className="text-sm font-semibold text-foreground">
              <span className="text-primary">Fuse</span>
              <span className="font-light">One</span>
            </span>
            <span className="text-xs tracking-wider text-muted-foreground">
              API GATEWAY
            </span>
          </div>

          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/apis" className="transition-colors hover:text-foreground">
              API Catalog
            </Link>
            <Link href="/register" className="transition-colors hover:text-foreground">
              Sign Up
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign In
            </Link>
          </nav>

          <p className="text-xs text-muted-foreground">
            Powered by FuseOne API Gateway
          </p>
        </div>
      </div>
    </footer>
  );
}
