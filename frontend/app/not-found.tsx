import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-z flex flex-col items-center py-32 text-center">
      <div className="num text-5xl font-semibold text-white">404</div>
      <p className="mt-3 text-sm text-mist-400">This page doesn&apos;t exist.</p>
      <Button href="/explore" className="mt-6">Explore projects</Button>
    </div>
  );
}
