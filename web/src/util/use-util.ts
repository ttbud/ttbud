import { useEffect } from "react";

interface UseAsyncEffectArgs<T> {
  effect: () => Promise<T>;
  deps?: any[];
  cleanup?: (effectResult: T) => void;
}

export function useAsyncEffect<T>(args: UseAsyncEffectArgs<T>) {
  const cleanup = args.cleanup || (() => {});

  useEffect(() => {
    const $result = args.effect();

    return () => {
      const cleanupWrapper = async () => {
        const result = await $result;
        cleanup(result);
      };
      // noinspection JSIgnoredPromiseFromCall
      cleanupWrapper();
    };
  }, [args, cleanup]);
}
