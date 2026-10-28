import { useState, type PointerEvent } from 'react'
import type { TaskStatus } from './api'

type Drag = { taskId: number; from: TaskStatus; startX: number; startY: number; dx: number; dy: number; over: TaskStatus | null }

/** The column under a point: the nearest element there marked with `data-status`. */
function columnAt(x: number, y: number): TaskStatus | null {
  const column = document.elementsFromPoint(x, y).find((element) => element instanceof HTMLElement && element.dataset.status)
  return ((column as HTMLElement | undefined)?.dataset.status as TaskStatus | undefined) ?? null
}

/** Dragging Tasks between the board's columns, by touch, pen or mouse. Built on pointer events,
 * since the browser's own drag and drop does not work with touch. The columns are the elements
 * with `data-status`; `onDrop` is called when a Task is let go over another column. */
export function useTaskDrag(onDrop: (taskId: number, status: TaskStatus) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)

  /** For the drag handle of a Task in column `from`. */
  function handleProps(taskId: number, from: TaskStatus) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        // Every move and the release come to the handle, wherever the finger goes.
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ taskId, from, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, over: from })
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (drag?.taskId !== taskId) return
        setDrag({
          ...drag,
          dx: event.clientX - drag.startX,
          dy: event.clientY - drag.startY,
          over: columnAt(event.clientX, event.clientY),
        })
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        if (drag?.taskId !== taskId) return
        const over = columnAt(event.clientX, event.clientY)
        setDrag(null)
        if (over && over !== drag.from) onDrop(taskId, over)
      },
      onPointerCancel: () => setDrag(null),
    }
  }

  return {
    handleProps,
    /** The Task being dragged, with how far it moved, and the column it is over. */
    dragging: drag && { taskId: drag.taskId, dx: drag.dx, dy: drag.dy },
    over: drag?.over ?? null,
  }
}
