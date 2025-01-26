import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export type NextFunction<N = unknown> = (nextParams?: N) => void;
export type ApiMiddleware<T extends Promise<unknown>, N = unknown> = (
  request: NextRequest,
  { params }: { params: T },
  next: NextFunction<N>,
) => Promise<NextResponse | void | Response>;
