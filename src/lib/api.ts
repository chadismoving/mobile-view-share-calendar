export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  const headers = new Headers(options.headers);
  if (typeof options.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApiError(
      "Connection lost. Your draft is kept on this device. Reconnect or reload to sign in again.",
      0,
    );
  }
  const data = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!data)
    throw new ApiError(
      "Your session may have expired. Reload to sign in again; your draft is kept on this device.",
      response.status,
    );
  if (!response.ok)
    throw new ApiError(
      typeof data.error === "string"
        ? data.error
        : "Something went wrong. Please try again.",
      response.status,
      data,
    );
  return data as T;
}
