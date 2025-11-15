import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  MessageType,
  TabInfo,
  TabMessage,
  UseMultiTabDetectionOptions,
  UseMultiTabDetectionReturn
} from './types';

/**
 * Custom React hook to detect when a user has multiple tabs open.
 * Uses the BroadcastChannel API for inter-tab communication.
 * Implements leader election so only one tab fires callbacks.
 *
 * @example
 * ```tsx
 * export default function Component() {
 *   const { isMultiTab, tabCount, tabId } = useMultiTabDetection({
 *     channelName: 'my-app',
 *     onMultiTabChange: (isMultiTab, count) => {
 *       console.log(`Multi-tab: ${isMultiTab}, Count: ${count}`);
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       {isMultiTab && <Warning>Multiple tabs detected!</Warning>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
 */
export function useMultiTabDetection(
  options: UseMultiTabDetectionOptions
): UseMultiTabDetectionReturn {
  const {
    channelName,
    debug = false,
    heartbeatInterval = 10000, // Defaults to 10 seconds
    inactivityThreshold = 30000, // Defaults to 30 seconds
    onMultiTabChange
  } = options;

  /**
   * Generates a unique identifier for a tab session
   */
  const generateTabId = useCallback((): string => {
    return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Stable tab ID for this instance (persists across re-renders)
  const tabIdRef = useRef<string>(generateTabId());

  // BroadcastChannel instance
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Map of active tabs (tabId -> TabInfo)
  const activeTabsRef = useRef<Map<string, TabInfo>>(new Map());

  // Timers
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaderElectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // State
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isMultiTab, setIsMultiTab] = useState<boolean>(false);
  const [tabCount, setTabCount] = useState<number>(1);
  const [activeTabUrls, setActiveTabUrls] = useState<Map<string, string>>(
    new Map()
  );

  // Leader election state
  // Leader is determined by the tab with the lowest tabId (lexicographically)
  const isLeaderRef = useRef<boolean>(true); // Assume leader until proven otherwise

  // Previous multi-tab state for change detection
  const prevIsMultiTabRef = useRef<boolean>(false);
  const prevTabCountRef = useRef<number>(1);

  /**
   * Debug logger
   */
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log(`[MultiTab:${tabIdRef.current.slice(0, 8)}]`, ...args);
      }
    },
    [debug]
  );

  /**
   * Determine if this tab should be the leader
   * Leader is the tab with the lexicographically smallest tabId
   */
  const determineLeadership = useCallback(() => {
    const allTabIds = Array.from(activeTabsRef.current.keys());
    allTabIds.push(tabIdRef.current); // Include current tab

    // Sort tab IDs and check if current tab is the smallest
    allTabIds.sort();
    const shouldBeLeader = allTabIds[0] === tabIdRef.current;

    const wasLeader = isLeaderRef.current;
    isLeaderRef.current = shouldBeLeader;

    if (wasLeader !== shouldBeLeader) {
      log(
        shouldBeLeader
          ? 'This tab is now the leader'
          : 'This tab is now a follower'
      );
    }

    return shouldBeLeader;
  }, [log]);

  /**
   * Update the tab count and multi-tab state
   */
  const updateTabState = useCallback(() => {
    const now = Date.now();
    const activeTabs = Array.from(activeTabsRef.current.entries()).filter(
      ([, info]) => now - info.lastHeartbeat < inactivityThreshold
    );
    const currentUrl =
      typeof window !== 'undefined' ? window.location.href : '';

    // Update the active tabs map
    activeTabsRef.current = new Map(activeTabs);

    // Always include this tab
    activeTabsRef.current.set(tabIdRef.current, {
      tabId: tabIdRef.current,
      lastHeartbeat: now,
      url: currentUrl
    });

    const newTabCount = activeTabsRef.current.size;
    const newIsMultiTab = newTabCount > 1;

    const urlMap = new Map<string, string>();
    activeTabsRef.current.forEach((info, tabId) => {
      urlMap.set(tabId, info.url);
    });

    log('Active tabs:', Array.from(activeTabsRef.current.keys()));
    log('Active URLs:', Array.from(urlMap.entries()));

    setTabCount(newTabCount);
    setIsMultiTab(newIsMultiTab);
    setActiveTabUrls(urlMap);

    // Determine leadership based on current active tabs
    const isLeader = determineLeadership();

    // Only fire callback if:
    // 1. This tab is the leader
    // 2. The state has actually changed
    // 3. A callback is provided
    if (
      isLeader &&
      onMultiTabChange &&
      (prevIsMultiTabRef.current !== newIsMultiTab ||
        prevTabCountRef.current !== newTabCount)
    ) {
      log('Leader firing onMultiTabChange callback');
      onMultiTabChange(newIsMultiTab, newTabCount, urlMap);
      prevIsMultiTabRef.current = newIsMultiTab;
      prevTabCountRef.current = newTabCount;
    } else if (!isLeader && onMultiTabChange) {
      log('Follower suppressing callback (leader will handle it)');
    }
    /**
     * Disable exhaustive-deps to avoid re-creating the function
     * on every render due to changing references.
     *
     * The `onMultiTabChange` callback may not be memoized by feature consumer
     */
  }, [inactivityThreshold, determineLeadership, log]);

  /**
   * Send a message to all other tabs
   */
  const sendMessage = useCallback(
    (type: MessageType): void => {
      if (channelRef.current) {
        const currentUrl =
          typeof window !== 'undefined' ? window.location.href : '';

        const message: TabMessage = {
          type,
          tabId: tabIdRef.current,
          timestamp: Date.now(),
          url: currentUrl
        };

        try {
          channelRef.current.postMessage(message);
          log('Sent message:', message);
        } catch (error) {
          console.error('[MultiTab] Error sending message:', error);
        }
      }
    },
    [log]
  );

  /**
   * Handle incoming messages from other tabs
   */
  const handleMessage = useCallback(
    (event: MessageEvent<TabMessage>) => {
      const message = event.data;

      // Ignore messages from this tab
      if (message.tabId === tabIdRef.current) {
        return;
      }

      log('Received message:', message);

      switch (message.type) {
        case 'heartbeat':
        case 'request-active-tabs':
          // Update or add the tab to active tabs
          activeTabsRef.current.set(message.tabId, {
            tabId: message.tabId,
            lastHeartbeat: message.timestamp,
            url: message.url || '' // Store the URL from the message
          });

          // If another tab is requesting active tabs, respond with our heartbeat
          if (message.type === 'request-active-tabs') {
            sendMessage('heartbeat');
          }

          updateTabState();
          break;

        case 'tab-closed':
          // Remove the tab from active tabs
          activeTabsRef.current.delete(message.tabId);
          updateTabState();
          break;

        case 'request-leader':
          // Another tab is requesting leader election
          // Respond with our presence so leadership can be re-determined
          sendMessage('heartbeat');
          // Re-evaluate leadership after a short delay to let all tabs respond
          if (leaderElectionTimerRef.current) {
            clearTimeout(leaderElectionTimerRef.current);
          }
          leaderElectionTimerRef.current = setTimeout(() => {
            determineLeadership();
          }, 100); // Small delay to collect all responses
          break;

        default: {
          const _exhaustiveCheck: never = message.type;
          log('Unknown message type:', _exhaustiveCheck);
          break;
        }
      }
    },
    [sendMessage, updateTabState, determineLeadership, log]
  );

  /**
   * Cleanup inactive tabs periodically
   */
  const cleanupInactiveTabs = useCallback(() => {
    const now = Date.now();
    let hasChanges = false;

    activeTabsRef.current.forEach((info, tabId) => {
      if (
        tabId !== tabIdRef.current &&
        now - info.lastHeartbeat >= inactivityThreshold
      ) {
        log('Removing inactive tab:', tabId);
        activeTabsRef.current.delete(tabId);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      updateTabState();
    }
  }, [inactivityThreshold, updateTabState, log]);

  useEffect(() => {
    // Check if BroadcastChannel is supported
    const supported = typeof BroadcastChannel !== 'undefined';
    setIsSupported(supported);

    if (!supported) {
      console.warn(
        '[MultiTab] BroadcastChannel API is not supported in this browser'
      );
      return;
    }

    log('Initializing multi-tab detection');

    try {
      // Create BroadcastChannel
      channelRef.current = new BroadcastChannel(channelName);
      channelRef.current.addEventListener('message', handleMessage);

      // Request active tabs from any existing tabs
      sendMessage('request-active-tabs');

      // Start heartbeat
      heartbeatTimerRef.current = setInterval(() => {
        sendMessage('heartbeat');
      }, heartbeatInterval);

      // Start cleanup timer
      cleanupTimerRef.current = setInterval(() => {
        cleanupInactiveTabs();
      }, inactivityThreshold / 2);

      // Send initial heartbeat immediately
      sendMessage('heartbeat');
      updateTabState();

      // Cleanup on unmount or page unload
      const handleUnload = (): void => {
        sendMessage('tab-closed');
      };

      window.addEventListener('beforeunload', handleUnload);

      return () => {
        log('Cleaning up multi-tab detection');

        // Send tab-closed message
        sendMessage('tab-closed');

        // Clear timers
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
        }
        if (cleanupTimerRef.current) {
          clearInterval(cleanupTimerRef.current);
        }
        if (leaderElectionTimerRef.current) {
          clearTimeout(leaderElectionTimerRef.current);
        }

        // Close channel
        if (channelRef.current) {
          channelRef.current.removeEventListener('message', handleMessage);
          channelRef.current.close();
        }

        // Remove unload listener
        window.removeEventListener('beforeunload', handleUnload);
      };
    } catch (error) {
      console.error('[MultiTab] Error initializing:', error);
      setIsSupported(false);
    }
  }, [
    channelName,
    cleanupInactiveTabs,
    handleMessage,
    heartbeatInterval,
    inactivityThreshold,
    sendMessage,
    updateTabState,
    log
  ]);

  return {
    isMultiTab,
    tabCount,
    tabId: tabIdRef.current,
    isSupported,
    activeTabUrls
  };
}

export type {
  UseMultiTabDetectionOptions,
  UseMultiTabDetectionReturn,
  MessageType,
  TabMessage,
  TabInfo
} from './types';
