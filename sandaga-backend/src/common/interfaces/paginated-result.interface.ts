export interface PaginatedResult<T, TMeta = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  meta?: TMeta;
}
