import React from "react";
import { render } from "@testing-library/react";
import SemesterList from "./SemesterList";

let mockDragEnd;
jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ onDragEnd, children }) => { mockDragEnd = onDragEnd; return <div>{children}</div>; },
  Droppable: ({ children }) => children({ innerRef: jest.fn(), droppableProps: {}, placeholder: null }),
  Draggable: ({ children }) => children({ innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));

const slots = [
  { id: "sem-1", isTarc: false, courses: [] },
  { id: "sem-2", isTarc: false, courses: [] },
  { id: "tarc-stable-id", isTarc: true, courses: [] },
  { id: "sem-4", isTarc: false, courses: [] },
];

test("TARC drag sends its stable identity and destination to the canonical action boundary", () => {
  const onMoveTarc = jest.fn();
  render(<SemesterList semesterSlots={slots} getStatus={() => "locked"} canEdit={() => false} blocked={false} onMoveTarc={onMoveTarc} />);
  mockDragEnd({ draggableId: "tarc-stable-id", source: { index: 2 }, destination: { index: 3 } });
  expect(onMoveTarc).toHaveBeenCalledWith("tarc-stable-id", 3);
  expect(slots[2].id).toBe("tarc-stable-id");
});

test("cancelled, unchanged, and blocked drags produce no planner action", () => {
  const onMoveTarc = jest.fn();
  const props = { semesterSlots: slots, getStatus: () => "locked", canEdit: () => false, onMoveTarc };
  const { rerender } = render(<SemesterList {...props} blocked={false} />);
  mockDragEnd({ source: { index: 2 }, destination: null });
  mockDragEnd({ source: { index: 2 }, destination: { index: 2 } });
  rerender(<SemesterList {...props} blocked />);
  mockDragEnd({ draggableId: "tarc-stable-id", source: { index: 2 }, destination: { index: 3 } });
  expect(onMoveTarc).not.toHaveBeenCalled();
});
