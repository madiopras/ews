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
      "discardTemplate", "backupDeleted", "plannerResultRollout",
      "plannerResultCards", "plannerStructuredResults", "plannerStructuredRollout",
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

  test("Planner result cards have complete labels", () => {
    const requiredPlannerKeys = [
      "destinationsInTrip", "destinationsInTripSub", "destinationCardsLoadError",
      "partnerTypes", "matchReasons", "recommendedPartners", "organicMatch",
      "featuredDisclosure", "matches",
    ];
    for (const language of ["id", "en"]) {
      for (const key of requiredPlannerKeys) expect(TRANSLATIONS[language].planner[key]).toBeTruthy();
      expect(TRANSLATIONS[language].partners.types.culinary).toBeTruthy();
    }
  });

  test("Culinary partner onboarding and admin labels are bilingual", () => {
    const culinaryFieldKeys = [
      "culinaryCategories", "culinarySpecialties", "culinaryServiceModes",
      "culinaryDietaryTags", "culinaryOpeningInfo", "culinaryReservationNote",
    ];
    for (const language of ["id", "en"]) {
      expect(TRANSLATIONS[language].partners.types.culinary).toBeTruthy();
      expect(TRANSLATIONS[language].mitra.typeDescriptions.culinary).toBeTruthy();
      expect(TRANSLATIONS[language].mitra.fieldNames.culinary_specialties).toBeTruthy();
      for (const key of culinaryFieldKeys) {
        expect(TRANSLATIONS[language].mitra.fields[key]).toBeTruthy();
        expect(TRANSLATIONS[language].admin.partnerForm[key]).toBeTruthy();
      }
    }
  });
});
