import { fu } from '~/abstracts';
import { TFu } from '~/types';
import {
  IMutationResponse,
  TMutationOptions,
  TMutationOnResponse,
  IMutationExecuteOptions
} from './types';
import { createRequest } from 'urql';
import { pipe as wonkaPipe, toPromise as wonkaToPromise } from 'wonka';
import noOp from './utils/no-op';
import getClient from './utils/get-client';
import { tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { mapTo, combine } from '~/utils';

export default withMutation;

function withMutation<A, T = any>(
  options: TMutationOptions<T> | ((self: A) => TMutationOptions<T>),
  onResponse?: TMutationOnResponse<A, T>
): TFu<A, A & IMutationResponse<T>>;
function withMutation<A>(
  options: TMutationOptions<any> | ((self: A) => TMutationOptions<any>),
  onResponse?: TMutationOnResponse<A, any>
): TFu<A, A & IMutationResponse<any>>;
function withMutation<A, K extends string, T = any>(
  key: K,
  options: TMutationOptions<T> | ((self: A) => TMutationOptions<T>),
  onResponse?: TMutationOnResponse<A, T>
): TFu<A, A & { [P in K]: IMutationResponse<T> }>;
function withMutation<A, K extends string>(
  key: K,
  options: TMutationOptions<any> | ((self: A) => TMutationOptions<any>),
  onResponse?: TMutationOnResponse<A, any>
): TFu<A, A & { [P in K]: IMutationResponse<any> }>;

function withMutation<A, K extends string, T = any>(
  a: TMutationOptions<T> | ((self: A) => TMutationOptions<T>) | K,
  b?:
    | TMutationOnResponse<A, T>
    | TMutationOptions<T>
    | ((self: A) => TMutationOptions<T>),
  c?: TMutationOnResponse<A, T>
): TFu<A, A & (IMutationResponse<T> | { [P in K]: IMutationResponse<T> })> {
  const hasKey = typeof a === 'string';
  const key = hasKey ? (a as K) : null;
  const options = (hasKey ? b : a) as
    | TMutationOptions<T>
    | ((self: A) => TMutationOptions<T>);
  const onResponse = hasKey ? c : (b as TMutationOnResponse<A, T>);
  const mapper = mapTo<A, IMutationResponse<T>, K>(key);

  return fu((instance) => {
    let self: A = instance.initial;
    const subject = new BehaviorSubject({ ...noOp(), execute });

    function execute<V = object>(
      execOpts: IMutationExecuteOptions<V> = {}
    ): void {
      const opts = typeof options === 'function' ? options(self) : options;
      const request = createRequest(opts.query, execOpts.variables as any);
      const client = getClient(opts, self);
      wonkaPipe(client.executeMutation(request), wonkaToPromise).then(
        async ({ data, error }) => {
          const update: IMutationResponse<T> = {
            fetching: false,
            execute,
            data,
            error
          };
          if (
            !onResponse ||
            (await onResponse(update, {
              self,
              current: subject.value
            }))
          ) {
            subject.next(update);
          }
        }
      );
    }

    return combine(
      [instance.initial, subject.value],
      [instance.subscriber.pipe(tap((a) => (self = a))), subject],
      mapper
    );
  });
}
