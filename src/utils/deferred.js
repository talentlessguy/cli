// @ts-check
export const createDeferred = () => {
  let resolveDeferred
  let rejectDeferred
  const promise = new Promise((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}
