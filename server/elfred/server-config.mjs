export function serverConfig(config = process.env) {
  const port = Number(config.ELFRED_PORT || 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('ELFRED_PORT must be 1024–65535');
  const localOrigin = `http://127.0.0.1:${port}`;
  const url = new URL(config.ELFRED_PUBLIC_ORIGIN || localOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/')
    throw new Error('ELFRED_PUBLIC_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment');
  return { port, localOrigin, publicOrigin: url.origin };
}
