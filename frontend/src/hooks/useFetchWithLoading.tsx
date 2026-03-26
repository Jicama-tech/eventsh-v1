import { useLoading } from "../context/loadingContext";

export function useFetchWithLoading() {
  const { setLoading } = useLoading();

  async function fetchWithLoading(input: RequestInfo, init?: RequestInit) {
    try {
      setLoading(true);
      const response = await fetch(input, init);
      setLoading(false);
      return response;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }

  return { fetchWithLoading };
}
