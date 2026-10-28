import { useState, type PointerEvent } from 'react'

type Drag<Target> = { id: number; startX: number; startY: number; dx: number; dy: number; over: Target | null }

/** Dragging things (by ID) onto targets, by touch, pen or mouse. Built on pointer events, since
 * the browser's own drag and drop does not work with touch. `targetAt` says which target is
 * under a point while dragging `id` (null for none); `onDrop` is called when it is let go over
 * one. */
export function usePointerDrag<Target>(
  targetAt: (x: number, y: number, id: number) => Target | null,
  onDrop: (id: number, target: Target) => void,
) {
  const [drag, setDrag] = useState<Drag<Target> | null>(null)

  /** For the drag handle of the thing with this ID. */
  function handleProps(id: number) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        // Every move and the release come to the handle, wherever the finger goes.
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ id, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, over: null })
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (drag?.id !== id) return
        setDrag({
          ...drag,
          dx: event.clientX - drag.startX,
          dy: event.clientY - drag.startY,
          over: targetAt(event.clientX, event.clientY, id),
        })
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        if (drag?.id !== id) return
        const over = targetAt(event.clientX, event.clientY, id)
        setDrag(null)
        if (over !== null) onDrop(id, over)
      },
      onPointerCancel: () => setDrag(null),
    }
  }

  return {
    handleProps,
    /** What is being dragged, with how far it moved and the target it is over. */
    dragging: drag && { id: drag.id, dx: drag.dx, dy: drag.dy, over: drag.over },
  }
}

/** The value of `data-<key>` on the first element under a point that has one, other than
 * `except` (e.g. the thing being dragged, which follows the finger, so is under it too). */
export function dataAt(x: number, y: number, key: string, except?: string): string | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const value = element instanceof HTMLElement ? element.dataset[key] : undefined
    if (value !== undefined && value !== except) return value
  }
  return null
}
