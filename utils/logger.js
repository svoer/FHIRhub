/**
 * Module de journalisation simple pour FHIRHub
 * Transfert tous les appels de journalisation vers la console
 */

function debug(...args) {
  console.debug(...args);
}

function info(...args) {
  console.info(...args);
}

function warn(...args) {
  console.warn(...args);
}

function error(...args) {
  console.error(...args);
}

function setLogLevel(level) {
  // Non implémenté - utilise les niveaux de log par défaut de la console
  console.info(`Log level set to: ${level}`);
}

module.exports = {
  debug,
  info,
  warn,
  error,
  setLogLevel
};