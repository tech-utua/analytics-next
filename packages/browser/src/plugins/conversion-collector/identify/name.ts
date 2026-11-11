/**
 * Normalização de nome para o `fn` / `ln` da Meta: minúsculas, sem espaços, sem
 * pontuação, sem dígitos e sem símbolos; letras de qualquer alfabeto (acentos, grego)
 * ficam como estão, em UTF-8.
 *
 * O pacote compila para ES5, então não dá para usar `\p{L}` com a flag `u`. A lista
 * abaixo remove o que não é letra nos blocos ASCII e Latin-1 e a pontuação geral do
 * Unicode; letras de outros alfabetos passam intactas.
 */
const NOT_A_NAME_CHAR_RE =
  // espaços e dígitos, pontuação/símbolos ASCII, Latin-1 que não é letra (espaço
  // duro até ¿, × e ÷), pontuação geral (aspas tipográficas, travessões, …) e
  // pontuação CJK
  /[\s0-9!-/:-@[-`{-~\u00A0-\u00BF\u00D7\u00F7\u2000-\u206F\u3000-\u303F]/g

/** Menos letras que isso não é nome que valha a pena enviar (iniciais, lixo). */
const MIN_NAME_PART_LENGTH = 2

function unicodeNormalize(value: string): string {
  return typeof value.normalize === 'function' ? value.normalize('NFC') : value
}

/** Normaliza uma parte do nome; devolve '' quando não sobra um nome aproveitável. */
export function normalizeNamePart(value: string): string {
  const normalized = unicodeNormalize(value)
    .toLowerCase()
    .replace(NOT_A_NAME_CHAR_RE, '')
  return normalized.length >= MIN_NAME_PART_LENGTH ? normalized : ''
}

export type NameParts = {
  firstName: string
  lastName: string
}

/**
 * Separa um nome completo em primeiro nome e sobrenome, já normalizados: a primeira
 * palavra aproveitável é o primeiro nome e a última é o sobrenome. Com uma palavra só,
 * não há sobrenome. Palavras que não sobrevivem à normalização ("-", "J.") são
 * ignoradas.
 */
export function splitFullName(fullName: string): NameParts {
  const parts = fullName
    .split(/\s+/)
    .map(normalizeNamePart)
    .filter((part) => part !== '')

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
  }
}
