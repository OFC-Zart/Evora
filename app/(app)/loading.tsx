import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-72" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}
