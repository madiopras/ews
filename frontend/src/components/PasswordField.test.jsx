import { passwordStrength } from "./PasswordField.jsx";

describe("password strength guidance", () => {
  test("scores length, case mix, number, and symbol independently", () => {
    expect(passwordStrength("short")).toBe(0);
    expect(passwordStrength("longpassword")).toBe(1);
    expect(passwordStrength("LongPassword1!")).toBe(4);
  });
});
