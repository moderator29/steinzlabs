export interface ApiError {
  message: string;
  status: number;
}

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  409: 'Conflict',
  422: 'Unprocessable entity',
  429: 'Too many requests',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
};

export function createApiError(status: number, message?: string): ApiError {
  return {
    message: message || ERROR_MESSAGES[status] || 'An unexpected error occurred',
    status,
  };
}

export function handleApiError(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  const isDev = process.env.NODE_ENV === 'development';

  if (error instanceof Error) {

  } else {

  }

  return new Response(
    JSON.stringify({
      error: 'Internal server error',
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export function apiResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function apiErrorResponse(status: number, message?: string): Response {
  const err = createApiError(status, message);
  return new Response(JSON.stringify({ error: err.message }), {
    status: err.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
