/// Shared config constants for the BattleMe overlay bridge.
///
/// Import from this file everywhere instead of duplicating URLs/ports.

/// Base URL of the Rust HTTP bridge (tiny_http, port 38021).
export const BRIDGE_URL = 'http://localhost:38021'

/// Full URL to the overlay page served by the bridge (production use).
export const BRIDGE_OVERLAY_URL = `${BRIDGE_URL}/overlay`

/// Fetch poll interval in milliseconds.
export const POLL_INTERVAL = 1000
