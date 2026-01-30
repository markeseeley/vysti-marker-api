let buildId = "";
const events = [];
let lastError = null;

const pushEvent = (entry) => {
  events.push(entry);
  if (events.length > 50) {
    events.shift();
  }
};

export function initLogger(config) {
  buildId = config?.buildId || "";
}

export function logEvent(type, details = {}) {
  pushEvent({
    type,
    details,
    buildId,
    at: new Date().toISOString()
  });
}

export function logError(message, details = {}) {
  lastError = {
    message,
    ...details,
    at: new Date().toISOString(),
    buildId
  };
  logEvent("error", { message, ...details });
}

export function getDebugInfo() {
  return {
    buildId,
    lastError,
    recentEvents: events.slice(-12)
  };
}
