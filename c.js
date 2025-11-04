// --- Add / replace these handlers in your bot file (replace the existing bot.on('error') block) ---
bot.on('connect', () => {
  console.error('[bot] tcp connected')
})

bot.on('error', (err) => {
  // common transient network error: connection reset by remote peer
  if (err && err.code === 'ECONNRESET') {
    console.error('[bot] error: ECONNRESET (connection reset by peer) — will reconnect shortly')
    try { cleanupAndReconnect() } catch (e) { console.error('[bot] reconnect failed:', e && e.message ? e.message : e) }
    return
  }

  // optional: handle other transient errors the same way
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'EHOSTUNREACH')) {
    console.error('[bot] transient network error:', err.code, '- reconnecting')
    try { cleanupAndReconnect() } catch (e) { console.error('[bot] reconnect failed:', e && e.message ? e.message : e) }
    return
  }

  console.error('[bot] error:', err && err.message ? err.message : String(err))
})

// catch unhandled promises so Node doesn't crash on transient errors
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason && reason.stack ? reason.stack : reason)
})
process.on('uncaughtException', (ex) => {
  console.error('[process] uncaughtException:', ex && ex.stack ? ex.stack : ex)
  // don't auto-exit; attempt graceful reconnect on socket-related errors
  if (ex && ex.code === 'ECONNRESET') try { cleanupAndReconnect() } catch (e) {}
})
