type ActionSuccess<T> = { success: true; message?: string; data: T };
type ActionFailure = { success: false; message: string; fieldErrors?: Record<string, string[]> };

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function fail(message: string, fieldErrors?: Record<string, string[]>): ActionFailure {
  return { success: false, message, fieldErrors };
}
