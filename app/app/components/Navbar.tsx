import Image from "next/image";
import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between px-6 py-3.5 bg-[#090706]/90 backdrop-blur-md border-b border-[#7c2d12]/30">
      <div className="flex items-center gap-2.5">
        <Image
          src="/nocturne-logo.png"
          alt="Nocturne Logo"
          className="rounded-md object-contain"
          height={36}
          width={36}
        />
        <h1 className="text-2xl font-medium font-heading text-[#fef3c7] tracking-tight">
          Nocturne <span className="text-[#fb923c]">Markets</span>
        </h1>

        <div className="flex items-center gap-6">
          <Link
            href="/markets"
            className="text-sm pt-2 px-0.5 text-[17px] text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/create"
            className="text-sm pt-2 px-0.5 text-[17px] text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors"
          >
            Create
          </Link>
          <Link
            href="/docs"
            className="text-sm pt-2 px-0.5 text-[17px] text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors"
          >
            Docs
          </Link>
        </div>
      </div>
      {/* Themed Monad-Style Radial Bloom Buttons */}
      {/* <button className="btn-monad-base btn-ember h-8 px-3.5">
        <span>Connect Wallet</span>
      </button>

      <button className="btn-monad-base btn-void h-8 px-3">
        <span>Audit Proof</span>
      </button>

      <button className="btn-monad-base btn-cream h-8 px-3">
        <span>Explore</span>
      </button> */}
    </nav>
  );
};

export default Navbar;
