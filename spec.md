# SWELL

## Current State

The app has two drag-to-reorder systems:
1. **Today's Conditions tiles** (wave, wind, direction, waterTemp, airTemp, tide, forecast) -- uses HTML5 `draggable` + `onDragStart`/`onDrop` events with a `dragTileRef`
2. **Preset spot buttons in Settings** -- uses HTML5 `draggable` + React drag events (`onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`)

Both systems rely exclusively on HTML5 Drag and Drop API, which **does not fire on iOS Safari or Android Chrome**. Touch devices use touch/pointer events, not drag events. As a result, neither drag system works on iPhones or Android phones.

## Requested Changes (Diff)

### Add
- A reusable `useTouchDrag` hook (or inline pointer-event logic) that handles both mouse and touch drag using `onPointerDown`, `onPointerMove`, `onPointerUp`
- Visual drag ghost/clone that follows the finger on mobile during drag
- Drop zone highlighting during active drag on mobile

### Modify
- **Today's Conditions tile wrapper divs**: Replace HTML5 drag attributes (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) with pointer-event-based drag logic that works on both desktop and mobile
- **PresetBar**: Replace HTML5 drag attributes on preset button wrappers with pointer-event-based drag logic
- Both systems should still work on desktop (mouse pointer events also fire for mouse)

### Remove
- `dragTileRef` (useRef for tile drag) -- replace with pointer event state
- HTML5 `draggable` attribute and drag event handlers from tile wrappers
- HTML5 `draggable` + `handleDragStart`/`handleDragOver`/`handleDragLeave`/`handleDrop`/`handleDragEnd` from PresetBar

## Implementation Plan

1. Create a `useSortableList` hook that:
   - Takes: `items` array, `onReorder` callback, `containerRef`
   - Uses `onPointerDown` to start drag, `onPointerMove` to track position and find drop target, `onPointerUp` to commit reorder
   - Uses `setPointerCapture` to prevent scroll interference on mobile
   - Returns per-item drag handlers and active drag state
   - Works for both small tiles (2-column grid) and wide tiles (full-width)

2. Apply hook to **Today's Conditions** tile grid -- all 7 tile types (wave, wind, direction, waterTemp, airTemp, tide, forecast)

3. Apply same approach to **PresetBar** preset button list

4. Ensure dragging does not accidentally trigger button clicks -- use a minimum drag distance threshold (e.g. 8px) before activating drag mode

5. Provide visual feedback: dragged tile gets 0.5 opacity + scale(0.97), drop target gets a highlight border
