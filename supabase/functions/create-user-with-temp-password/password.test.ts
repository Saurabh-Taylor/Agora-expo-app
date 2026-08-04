import { describe, expect, test } from "bun:test";

import { TEMP_PASSWORD_LENGTH } from "../_shared/commonConstants.ts";
import { generateTemporaryPassword } from "../_shared/commonFunctions.ts";

describe("generateTemporaryPassword", () => {
  test("keeps the required length and character classes for every first-byte value", () => {
    for (let firstByte = 0; firstByte <= 255; firstByte += 1) {
      const randomBytes = new Uint8Array(TEMP_PASSWORD_LENGTH);
      randomBytes[0] = firstByte;
      randomBytes[1] = 255 - firstByte;
      randomBytes[2] = firstByte;
      randomBytes.fill(firstByte, 3);

      const password = generateTemporaryPassword(randomBytes);

      expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
    }
  });

  test("rejects an invalid random-byte count", () => {
    expect(() => generateTemporaryPassword(new Uint8Array(TEMP_PASSWORD_LENGTH - 1))).toThrow(
      `Temporary passwords require exactly ${TEMP_PASSWORD_LENGTH} random bytes`,
    );
  });
});
