/** Android WebView exposes its platform in the user agent; no native plugin is needed. */
export function isAndroid(userAgent = navigator.userAgent): boolean {
  return /Android/i.test(userAgent);
}
