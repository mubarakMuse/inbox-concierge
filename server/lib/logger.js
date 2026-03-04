const LEVELS = { info: 'info', error: 'error' };

function format(level, message, meta = null) {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
  };
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    entry.meta = meta;
  }
  return JSON.stringify(entry);
}

export const logger = {
  info(message, meta = null) {
    process.stdout.write(format(LEVELS.info, message, meta) + '\n');
  },
  error(message, err = null, meta = null) {
    const safeMeta = { ...(meta || {}) };
    if (err instanceof Error) {
      safeMeta.error_message = err.message;
    }
    process.stderr.write(format(LEVELS.error, message, safeMeta) + '\n');
  },
};
