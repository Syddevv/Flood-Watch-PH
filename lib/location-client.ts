export type LocationSearchResult = {
  name: string;
  latitude: number;
  longitude: number;
};

export async function searchLocation(query: string) {
  const params = new URLSearchParams({ query });
  const response = await fetch(`/api/location/search?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | { data: LocationSearchResult }
    | { error: string };

  if (!response.ok || !("data" in payload)) {
    throw new Error(
      "error" in payload ? payload.error : "Unable to search for that location.",
    );
  }

  return payload.data;
}
