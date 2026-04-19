import fs from "node:fs";
import path from "node:path";

export function loadWidgetHtml(config: Record<string, unknown>) {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "chatgpt-widget-v2.html",
  );
  const template = fs.readFileSync(templatePath, "utf8");
  return template.replace(
    "__OTTLINE_CHATGPT_CONFIG__",
    JSON.stringify(config).replace(/</g, "\\u003c"),
  );
}
