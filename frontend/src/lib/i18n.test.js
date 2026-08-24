import { TRANSLATIONS } from "./i18n.js";

function keyPaths(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? keyPaths(child, path)
      : [path];
  }).sort();
}

describe("translation completeness", () => {
  test("Indonesian and English expose the same translation keys", () => {
    expect(keyPaths(TRANSLATIONS.id)).toEqual(keyPaths(TRANSLATIONS.en));
  });

  test("Milestone 7 admin settings and logs have no missing labels", () => {
    const requiredSettings = [
      "generalTitle", "integrationsTitle", "llmTitle", "templateTitle", "backupTitle",
      "apiKeyHint", "keepKey", "replaceKey", "removeKey", "useEnvironment",
      "discardTemplate", "backupDeleted",
    ];
    const requiredLogs = [
      "auditTitle", "aiTitle", "systemTitle", "search", "dateFrom", "dateTo",
      "viewDetails", "loadError",
    ];
    for (const language of ["id", "en"]) {
      for (const key of requiredSettings) expect(TRANSLATIONS[language].admin.settings[key]).toBeTruthy();
      for (const key of requiredLogs) expect(TRANSLATIONS[language].admin.logs[key]).toBeTruthy();
    }
  });
});
