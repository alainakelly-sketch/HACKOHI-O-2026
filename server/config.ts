// Exact Codespaces hostname, never a wildcard. Also makes the port-3001
// mistake recoverable without assuming a remote localhost address is public.
export function codespaceHost(port: number) {
  const name = process.env.CODESPACE_NAME,
    domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (
    !name ||
    !domain ||
    !/^[-a-z0-9]+$/.test(name) ||
    !/^[-a-z0-9.]+$/.test(domain) ||
    domain.includes('..')
  )
    return null;
  return `${name}-${port}.${domain}`;
}
