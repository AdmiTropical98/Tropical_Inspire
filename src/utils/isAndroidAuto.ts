export const isAndroidAuto = () =>
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches &&
  navigator.userAgent.includes('Android');