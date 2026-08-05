import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4 text-muted-foreground animate-in fade-in duration-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-80" />
        <p className="text-sm font-medium tracking-wide">Loading...</p>
      </div>
    </div>
  );
}
