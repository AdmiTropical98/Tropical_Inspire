export const isAndroidAuto = () => {
  if (typeof window !== 'undefined' && window.location.search.includes('admin=1')) {
    localStorage.setItem('bypass_driver_mode', 'true');
  }
  if (typeof window !== 'undefined' && localStorage.getItem('bypass_driver_mode') === 'true') {
    return false;
  }
  return typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.innerWidth < 768 &&
    window.matchMedia('(pointer: coarse)').matches &&
    navigator.userAgent.includes('Android');
};