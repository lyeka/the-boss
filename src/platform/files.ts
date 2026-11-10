import { isMyGo } from "mygo-runtime";
import { Desktop } from "./mygo";

export { isMyGo as isDesktop };

export async function exportGameFile(name: string, data: string) {
  if (isMyGo()) return Desktop.exportSave(name, data);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing its URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function importGameFile() {
  return Desktop.importSave();
}
