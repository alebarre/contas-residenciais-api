export type FieldError = { field: string; message: string };

export type ErrorResponse = {
  status: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
  code: string;
  fieldErrors?: FieldError[];
};
