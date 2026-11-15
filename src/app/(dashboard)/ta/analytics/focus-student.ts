// lets other parts of the analytics page (top 3 boxes, max/min names) jump to a
// student in the performance table: it searches their roll number, opens their
// row and scrolls to it
export const FOCUS_STUDENT_EVENT = "tams:focus-student";

export function focusStudent(rollNumber: string) {
  window.dispatchEvent(new CustomEvent<string>(FOCUS_STUDENT_EVENT, { detail: rollNumber }));
}
