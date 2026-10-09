/** Dutch greeting by time of day, with its Chinese meaning. */
export function greetingFor(hour: number): { nl: string; zh: string } {
  if (hour >= 5 && hour < 12) return { nl: "Goedemorgen!", zh: "早上好" };
  if (hour >= 12 && hour < 18) return { nl: "Goedemiddag!", zh: "下午好" };
  return { nl: "Goedenavond!", zh: "晚上好" };
}
