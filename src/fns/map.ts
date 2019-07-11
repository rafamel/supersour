import fu from '~/fu';
import { TFu } from '~/types';
import { map as _map } from 'rxjs/operators';

export default function withMap<A, B extends A>(
  map: (self: A) => B
): TFu<A, B> {
  return fu((instance) => ({
    initial: map(instance.initial),
    subscriber: instance.subscriber.pipe(_map((a) => map(a)))
  }));
}
