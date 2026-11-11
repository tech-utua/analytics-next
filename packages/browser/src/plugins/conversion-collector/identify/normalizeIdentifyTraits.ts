import { isSha256Hex, sha256Hex } from './sha256'
import { normalizePhoneToE164 } from './phone'
import { normalizeNamePart, splitFullName } from './name'

// client_phone é a chave usada pelos quizzes do BR; sem ela na lista o telefone
// seguia em texto puro e não virava phone_hash.
const PHONE_TRAIT_KEYS = [
  'phone',
  'whatsapp',
  'telefone',
  'mobile',
  'client_phone',
] as const
const NAME_TRAIT_KEYS = ['name'] as const

export type NormalizeIdentifyTraitsOptions = {
  defaultPhoneCountryCode?: string
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function extractEmailDomain(email: string): string | undefined {
  const at = email.indexOf('@')
  if (at < 0) {
    return undefined
  }
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
  return domain.length > 0 ? domain : undefined
}

async function hashEmailTrait(rawEmail: string): Promise<string> {
  const normalized = rawEmail.trim().toLowerCase()
  if (!normalized) {
    return ''
  }
  if (isSha256Hex(normalized)) {
    return normalized.toLowerCase()
  }
  return sha256Hex(normalized)
}

async function hashPhoneTrait(
  rawPhone: string,
  defaultCountryCode: string
): Promise<string> {
  const trimmed = rawPhone.trim()
  if (!trimmed) {
    return ''
  }
  if (isSha256Hex(trimmed)) {
    return trimmed.toLowerCase()
  }
  const e164 = normalizePhoneToE164(trimmed, defaultCountryCode)
  if (!e164) {
    return ''
  }
  return sha256Hex(e164)
}

async function hashNameTrait(rawName: string): Promise<string> {
  const trimmed = rawName.trim()
  if (!trimmed) {
    return ''
  }
  if (isSha256Hex(trimmed)) {
    return trimmed.toLowerCase()
  }
  return sha256Hex(trimmed.toLowerCase())
}

/**
 * Primeiro nome e sobrenome para o `fn` / `ln` da Meta. `first_name` / `last_name`
 * explícitos têm prioridade; senão saem do `name` (primeira e última palavra). Um
 * `name` que já chegou como hash não dá para separar e não gera nada.
 */
function resolveNameParts(traits: Record<string, unknown>): {
  firstName: string
  lastName: string
} {
  const explicitFirst = asNonEmptyString(traits.first_name)
  const explicitLast = asNonEmptyString(traits.last_name)
  const fullName = asNonEmptyString(traits.name)
  const fromFullName =
    fullName && !isSha256Hex(fullName)
      ? splitFullName(fullName)
      : { firstName: '', lastName: '' }

  const pick = (explicit: string | undefined, fallback: string) => {
    if (!explicit) return fallback
    return isSha256Hex(explicit)
      ? explicit.toLowerCase()
      : normalizeNamePart(explicit)
  }

  return {
    firstName: pick(explicitFirst, fromFullName.firstName),
    lastName: pick(explicitLast, fromFullName.lastName),
  }
}

async function hashNamePart(normalized: string): Promise<string> {
  if (!normalized) return ''
  return isSha256Hex(normalized) ? normalized : sha256Hex(normalized)
}

export async function normalizeIdentifyTraits(
  traits: Record<string, unknown>,
  options: NormalizeIdentifyTraitsOptions = {}
): Promise<Record<string, unknown>> {
  const defaultPhoneCountryCode = options.defaultPhoneCountryCode ?? '55'
  const out: Record<string, unknown> = { ...traits }

  const rawEmail = asNonEmptyString(traits.email)
  if (rawEmail) {
    const domainFromEmail = extractEmailDomain(rawEmail)
    const hashedEmail = await hashEmailTrait(rawEmail)
    if (hashedEmail) {
      out.email = hashedEmail
      out.email_hash = hashedEmail
    }
    if (domainFromEmail && out.email_domain == null) {
      out.email_domain = domainFromEmail
    }
  }

  const explicitDomain = asNonEmptyString(traits.email_domain)
  if (explicitDomain) {
    out.email_domain = explicitDomain.toLowerCase()
  }

  for (const key of PHONE_TRAIT_KEYS) {
    const rawPhone = asNonEmptyString(traits[key])
    if (!rawPhone) {
      continue
    }
    const hashedPhone = await hashPhoneTrait(rawPhone, defaultPhoneCountryCode)
    if (hashedPhone) {
      out[key] = hashedPhone
      if (key === 'phone' || out.phone_hash == null) {
        out.phone_hash = hashedPhone
      }
    }
  }

  // Calculado sobre os traits originais, antes de `name` virar hash logo abaixo.
  const { firstName, lastName } = resolveNameParts(traits)
  const firstNameHash = await hashNamePart(firstName)
  const lastNameHash = await hashNamePart(lastName)
  if (firstNameHash) {
    out.first_name_hash = firstNameHash
    if (out.first_name != null) out.first_name = firstNameHash
  } else if (asNonEmptyString(traits.first_name)) {
    // Nunca deixa o first_name original seguir em texto puro.
    delete out.first_name
  }
  if (lastNameHash) {
    out.last_name_hash = lastNameHash
    if (out.last_name != null) out.last_name = lastNameHash
  } else if (asNonEmptyString(traits.last_name)) {
    delete out.last_name
  }

  for (const key of NAME_TRAIT_KEYS) {
    const rawName = asNonEmptyString(traits[key])
    if (!rawName) {
      continue
    }
    const hashedName = await hashNameTrait(rawName)
    if (hashedName) {
      out[key] = hashedName
    }
  }

  return out
}
