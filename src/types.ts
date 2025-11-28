/**
 * Configuration options for the multi-tab detection hook
 */
export interface UseMultiTabDetectionOptions {
  /**
   * Unique channel name for the BroadcastChannel
   * Should be specific to your feature to avoid conflicts
   */
  channelName: string;

  /**
   * Enable debug logging to console
   * Useful for development and troubleshooting
   * @default false
   */
  debug?: boolean;

  /**
   * Interval (in ms) to send heartbeat messages
   * @default 1000
   */
  heartbeatInterval?: number;

  /**
   * Time (in ms) before considering a tab inactive/closed
   * Should be higher than heartbeatInterval
   * @default 3000
   */
  inactivityThreshold?: number;

  /**
   * Callback when multi-tab state changes
   */
  onMultiTabChange?: (
    isMultiTab: boolean,
    tabCount: number,
    activeTabUrls: Map<string, string>
  ) => void;
}

/**
 * Return type for the multi-tab detection hook
 */
export interface UseMultiTabDetectionReturn {
  /**
   * Whether multiple tabs are currently detected
   */
  isMultiTab: boolean;

  /**
   * Current count of active tabs
   */
  tabCount: number;

  /**
   * Unique identifier for this tab instance
   */
  tabId: string;

  /**
   * Whether the BroadcastChannel API is supported
   */
  isSupported: boolean;

  /**
   * Map of all active tab URLs
   * Key: tabId, Value: current URL of that tab
   */
  activeTabUrls: Map<string, string>;
}

/**
 * Message types for inter-tab communication
 */
export type MessageType =
  | 'heartbeat'
  | 'tab-closed'
  | 'request-active-tabs'
  | 'request-leader';

/**
 * Structure of messages sent between tabs via BroadcastChannel
 * @internal
 */
export interface TabMessage {
  /**
   * Type of message being sent
   */
  type: MessageType;

  /**
   * Unique identifier of the sending tab
   */
  tabId: string;

  /**
   * Unix timestamp (ms) when the message was sent
   */
  timestamp: number;

  /**
   * Current URL of the sending tab (optional for backward compatibility)
   */
  url?: string;
}

/**
 * Information about an active tab tracked by the hook
 * @internal
 */
export interface TabInfo {
  /**
   * Unique identifier of the tab
   */
  tabId: string;

  /**
   * Unix timestamp (ms) of the last received heartbeat
   */
  lastHeartbeat: number;

  /**
   * Current URL of the tab
   */
  url: string;
}
