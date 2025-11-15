# @tabbridge/use-multi-tab-detection

A lightweight React hook for detecting when your application is open in multiple browser tabs.

[![npm version](https://badge.fury.io/js/%40tabbridge%2Fuse-multi-tab-detection.svg)](https://www.npmjs.com/package/@tabbridge/use-multi-tab-detection)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- ✅ Native `BroadcastChannel` API for efficient inter-tab communication
- ✅ Fully type-safe with strict TypeScript
- ✅ Automatic cleanup of inactive tabs
- ✅ Configurable heartbeat intervals and thresholds
- ✅ Callback support for state changes
- ✅ Browser support detection
- ✅ Zero dependencies (except React peer dependency)
- ✅ Lightweight (~2KB gzipped)

## Installation

```bash
npm install @tabbridge/use-multi-tab-detection
```

## Quick Start

```tsx
import { useMultiTabDetection } from '@tabbridge/use-multi-tab-detection';

function App() {
  const { isMultiTab, tabCount } = useMultiTabDetection({
    channelName: 'my-app'
  });

  if (isMultiTab) {
    return <div>⚠️ Warning: This app is open in {tabCount} tabs</div>;
  }

  return <div>Your app content</div>;
}
```

## Usage

### Basic Implementation

Add the hook to your root layout or any component where you want to track multiple tabs:

```tsx
import { useMultiTabDetection } from '@tabbridge/use-multi-tab-detection';

export default function Layout() {
  const { isMultiTab, tabCount, tabId } = useMultiTabDetection({
    channelName: 'my-app-channel',
    debug: process.env.NODE_ENV === 'development'
  });

  return (
    <div>
      {isMultiTab && (
        <div className='warning-banner'>
          Multiple tabs detected ({tabCount} active)
        </div>
      )}
      {/* Your app content */}
    </div>
  );
}
```

### With Callbacks

React to multi-tab state changes with the `onMultiTabChange` callback:

```tsx
const { isMultiTab, tabCount, activeTabUrls } = useMultiTabDetection({
  channelName: 'my-app',
  onMultiTabChange: (isMultiTab, count, urls) => {
    console.log(`Multi-tab: ${isMultiTab}, Count: ${count}`);
    console.log('Active URLs:', Array.from(urls.values()));

    // Send analytics event
    if (isMultiTab) {
      analytics.track('multi_tab_detected', { tabCount: count });
    }
  }
});
```

## API Reference

### `useMultiTabDetection(options?)`

#### Options

| Option                | Type       | Default      | Description                                 |
| --------------------- | ---------- | ------------ | ------------------------------------------- |
| `channelName`         | `string`   | **Required** | Unique identifier for the BroadcastChannel  |
| `heartbeatInterval`   | `number`   | `10000`      | Interval (ms) between heartbeat messages    |
| `inactivityThreshold` | `number`   | `30000`      | Time (ms) before considering a tab inactive |
| `debug`               | `boolean`  | `false`      | Enable console logging for debugging        |
| `onMultiTabChange`    | `function` | `undefined`  | Callback when multi-tab state changes       |

#### onMultiTabChange Callback

```typescript
(isMultiTab: boolean, tabCount: number, activeTabUrls: Map<string, string>) => void
```

#### Return Value

| Property        | Type                  | Description                                  |
| --------------- | --------------------- | -------------------------------------------- |
| `isMultiTab`    | `boolean`             | Whether multiple tabs are currently detected |
| `tabCount`      | `number`              | Total count of active tabs                   |
| `tabId`         | `string`              | Unique identifier for the current tab        |
| `isSupported`   | `boolean`             | Whether BroadcastChannel API is supported    |
| `activeTabUrls` | `Map<string, string>` | Map of tab IDs to their URLs                 |

## How It Works

1. **Tab Registration**: Each tab creates a unique ID and joins a `BroadcastChannel`
2. **Heartbeat System**: Tabs send periodic heartbeat messages to announce they're active
3. **Tab Discovery**: New tabs broadcast a discovery message, and existing tabs respond
4. **Inactive Cleanup**: Tabs that haven't sent a heartbeat within the threshold are removed
5. **State Updates**: The hook tracks active tabs and updates state accordingly

```
Tab 1                    Tab 2
  |                        |
  |--[heartbeat]---------->|
  |<-------[heartbeat]-----|
  |                        |
  |--[heartbeat]---------->|
  |                        X (closed)
  |
  |--[cleanup after 30s]-->
  | (detects Tab 2 inactive)
```

## Browser Support

Uses the [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API):

- ✅ Chrome 54+
- ✅ Firefox 38+
- ✅ Safari 15.4+
- ✅ Edge 79+
- ❌ Internet Explorer (not supported)

The hook gracefully handles unsupported browsers by setting `isSupported: false`.

## Examples

### Analytics Tracking

```tsx
useMultiTabDetection({
  channelName: 'reporting-demo',
  onMultiTabChange: async (isMultiTab, count, urls) => {
    if (isMultiTab) {
      await fetch('/api/report-multi-tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabCount: count,
          urls: Array.from(urls.values())
        })
      });
    }
  }
});
```

### Custom Warning Banner

```tsx
function WarningBanner() {
  const { isMultiTab, tabCount } = useMultiTabDetection({
    channelName: 'banner-demo'
  });

  if (!isMultiTab) return null;

  return (
    <div className='bg-yellow-100 border-l-4 border-yellow-500 p-4'>
      <p className='font-bold'>⚠️ Multiple Tabs Detected</p>
      <p>
        You have {tabCount} tabs open. Please close extra tabs to avoid
        synchronization issues.
      </p>
    </div>
  );
}
```

## Testing

### Manual Testing

1. Open your app in one tab with `debug: true` enabled
2. Open the same page in a second tab
3. Check the browser console for debug messages
4. Verify `isMultiTab` becomes `true` and `tabCount` shows `2`
5. Close one tab and verify the count decreases after the inactivity threshold

## Troubleshooting

### Hook not detecting other tabs

- Ensure all tabs use the **same** `channelName`
- Verify `isSupported` is `true` in your browser
- Enable `debug: true` to see message flow in console
- Check browser console for errors

### False positives (detecting closed tabs)

- Increase `inactivityThreshold` if you have slow network conditions
- Default 30s threshold should work for most cases
- Verify cleanup is running with `debug: true`

### Performance concerns

- Default settings are already optimized for most use cases
- Increase `heartbeatInterval` to reduce message frequency if needed
- Avoid triggering expensive operations in `onMultiTabChange` callback
- Consider debouncing state updates that cause re-renders

## Performance Notes

⚠️ **Important**: While BroadcastChannel is lightweight, be mindful of:

- Triggering global context updates on every state change
- Re-rendering expensive components unnecessarily
- Triggering data refetches in the callback

**Best practices**:

- Use `onMultiTabChange` for side effects (analytics, logging)
- Memoize expensive computations based on `isMultiTab`
- Debounce UI updates if needed

## Security Considerations

- BroadcastChannel only communicates within the same origin (browser security)
- Messages cannot be accessed across different domains
- Tab IDs are randomly generated and not tied to user identity
- Avoid sending sensitive data through the channel

## Why BroadcastChannel?

We chose BroadcastChannel over alternatives for several reasons:

| Approach                | Pros                                              | Cons                                       |
| ----------------------- | ------------------------------------------------- | ------------------------------------------ |
| **BroadcastChannel**    | ✅ Native API<br>✅ No polling<br>✅ Auto cleanup | ❌ Limited browser support                 |
| **LocalStorage events** | ✅ Wider support                                  | ❌ Same-origin only<br>❌ No auto cleanup  |
| **SharedWorker**        | ✅ Powerful                                       | ❌ Complex setup<br>❌ Limited support     |
| **Server polling**      | ✅ Works everywhere                               | ❌ Network overhead<br>❌ Requires backend |

## TypeScript

This package is written in TypeScript and includes full type definitions:

```typescript
interface UseMultiTabDetectionOptions {
  channelName: string;
  heartbeatInterval?: number;
  inactivityThreshold?: number;
  debug?: boolean;
  onMultiTabChange?: (
    isMultiTab: boolean,
    tabCount: number,
    activeTabUrls: Map<string, string>
  ) => void;
}

interface UseMultiTabDetectionResult {
  isMultiTab: boolean;
  tabCount: number;
  tabId: string;
  isSupported: boolean;
  activeTabUrls: Map<string, string>;
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © TabBridge https://github.com/tabbridge

## Links

- [npm package](https://www.npmjs.com/package/@tabbridge/use-multi-tab-detection)
- [GitHub repository](https://github.com/tabbridge/useMultiTabDetection)
- [Report issues](https://github.com/tabbridge/useMultiTabDetection/issues)

---

Made with ❤️ by the TabBridge team
