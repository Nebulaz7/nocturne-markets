import Image from "next/image";
import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-800">
      <div className="flex items-center gap-0.5">
        <Image
          src="/nocturne-logo.png"
          alt="Nocture Logo"
          className="text-white rounded-lg"
          height={50}
          width={50}
        />
        <h1 className="text-xl font-bold text-white">Nocture Markets</h1>
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/markets"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Markets
        </Link>
        <Link
          href="/create"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Create
        </Link>
        <Link
          href="/docs"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Docs
        </Link>
        <button className="btn-monad-base bg-purple-500 btn-monad-primary h-9 px-4">
          <span>Connect Wallet</span>
        </button>

        <button className="btn-monad-base bg-purple-500 btn-monad-void h-8 px-3">
          <span>Audit Proof</span>
        </button>
        <button className="btn-monad-base v btn-monad-secondary h-8 px-3">
          <span>Explore Markets</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
