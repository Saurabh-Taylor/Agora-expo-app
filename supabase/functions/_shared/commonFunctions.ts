import {
  TEMP_PASSWORD_CHARSET,
  TEMP_PASSWORD_DIGIT_CHARSET,
  TEMP_PASSWORD_LENGTH,
  TEMP_PASSWORD_LOWERCASE_CHARSET,
  TEMP_PASSWORD_UPPERCASE_CHARSET,
} from "./commonConstants.ts";

function passwordCharacter(characterSet: string, randomByte: number) {
  return characterSet[randomByte % characterSet.length];
}

export function generateTemporaryPassword(
  randomBytes = crypto.getRandomValues(new Uint8Array(TEMP_PASSWORD_LENGTH)),
) {
  if (randomBytes.length !== TEMP_PASSWORD_LENGTH) {
    throw new Error(`Temporary passwords require exactly ${TEMP_PASSWORD_LENGTH} random bytes`);
  }

  const password = [
    passwordCharacter(TEMP_PASSWORD_UPPERCASE_CHARSET, randomBytes[0]),
    passwordCharacter(TEMP_PASSWORD_LOWERCASE_CHARSET, randomBytes[1]),
    passwordCharacter(TEMP_PASSWORD_DIGIT_CHARSET, randomBytes[2]),
    ...Array.from(randomBytes.slice(3), (byte) => passwordCharacter(TEMP_PASSWORD_CHARSET, byte)),
  ];

  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes[index] % (index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }

  const result = password.join("");
  if (
    result.length !== TEMP_PASSWORD_LENGTH ||
    !/[A-Z]/.test(result) ||
    !/[a-z]/.test(result) ||
    !/\d/.test(result)
  ) {
    throw new Error("Temporary password generation failed its strength invariant");
  }
  return result;
}
