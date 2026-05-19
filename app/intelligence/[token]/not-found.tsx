import { RouteNotFound } from '@/components/errors/RouteNotFound';

export default function NotFound() {
  return <RouteNotFound subject="token" />;
}
