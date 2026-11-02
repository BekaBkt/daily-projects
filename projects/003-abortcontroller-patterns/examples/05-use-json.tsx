// 05 · AbortController as the cleanup of a data-fetching effect.
//
// Typecheck-only example (React isn't run here). Aborting in the cleanup does two jobs:
// it cancels the network request, and `signal.aborted` doubles as the "ignore this
// result" flag, so a slow old response can never overwrite a newer one.
import { useEffect, useState } from "react";

export type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

type Settled<T> = { url: string } & ({ ok: true; data: T } | { ok: false; error: Error });

export function useJson<T>(url: string | null): FetchState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const { signal } = controller;

    fetch(url, { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then(
        (data) => {
          if (!signal.aborted) setSettled({ url, ok: true, data });
        },
        (err: unknown) => {
          // Our own cleanup, StrictMode's double-invoke, or a newer url: not an error.
          if (signal.aborted) return;
          setSettled({ url, ok: false, error: err instanceof Error ? err : new Error(String(err)) });
        },
      );

    return () => controller.abort();
  }, [url]);

  // "Loading" is derived, not stored: the last settled result belongs to another url.
  if (url === null) return { status: "idle" };
  if (settled === null || settled.url !== url) return { status: "loading" };
  return settled.ok ? { status: "success", data: settled.data } : { status: "error", error: settled.error };
}

interface Repo {
  full_name: string;
  stargazers_count: number;
  description: string | null;
}

export function RepoCard({ name }: { name: string }) {
  // Typing quickly changes `name` on every key; each change aborts the previous request.
  const state = useJson<Repo>(name.includes("/") ? `https://api.github.com/repos/${name}` : null);

  switch (state.status) {
    case "idle":
      return <p>Type owner/repo</p>;
    case "loading":
      return <p aria-busy="true">Loading…</p>;
    case "error":
      return <p role="alert">Couldn't load {name}: {state.error.message}</p>;
    case "success":
      return (
        <article>
          <h2>{state.data.full_name}</h2>
          <p>{state.data.description ?? "No description"}</p>
          <p>★ {state.data.stargazers_count.toLocaleString()}</p>
        </article>
      );
  }
}
