function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, "0");
}

export function randSuffix() {
  const arr = new Uint8Array(5 / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}
