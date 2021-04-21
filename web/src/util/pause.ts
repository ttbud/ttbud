export default async function pause(timeMs: number): Promise<void> {
  return await new Promise((resolve) => setTimeout(resolve, timeMs));
}
