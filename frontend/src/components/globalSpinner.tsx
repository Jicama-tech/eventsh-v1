import { useLoading } from "@/context/loadingContext";

export function GlobalSpinner() {
  const { loading } = useLoading();
  if (!loading) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      {/* You can replace with an animated spinner icon */}
      <div className="loader">Loading...</div>
    </div>
  );
}
