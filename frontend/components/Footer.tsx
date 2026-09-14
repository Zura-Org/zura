import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-800">
      <div className="container-z flex flex-col gap-4 py-8 text-sm text-mist-400 sm:flex-row sm:items-center sm:justify-between">
        <p>Zura · Contributor rewards infrastructure for the ARC ecosystem</p>
        <div className="flex gap-5">
          <a href="https://github.com/Zura-Org/zura" className="hover:text-white">GitHub</a>
          <a href="https://testnet.arcscan.app" className="hover:text-white">ARC Explorer</a>
          <a href="https://faucet.circle.com" className="hover:text-white">USDC Faucet</a>
          <Link href="/projects/new" className="hover:text-white">Submit a project</Link>
        </div>
      </div>
    </footer>
  );
}
