import { normalizeIdentifyTraits } from '../normalizeIdentifyTraits'
import { sha256Hex } from '../sha256'
import { normalizePhoneToE164 } from '../phone'

describe('normalizeIdentifyTraits', () => {
  it('hashes email (lowercase + trim) and keeps email_domain open', async () => {
    const email = '  Test@Example.COM '
    const expectedEmailHash = await sha256Hex('test@example.com')

    const traits = await normalizeIdentifyTraits({
      email,
      name: 'Maria',
    })

    expect(traits.email).toBe(expectedEmailHash)
    expect(String(traits.email)).toMatch(/^[a-f0-9]{64}$/)
    expect(traits.email).toBe(traits.email_hash)
    expect(traits.email_domain).toBe('example.com')
    expect(String(traits.name)).toMatch(/^[a-f0-9]{64}$/)
    expect(traits.name).not.toBe('Maria')
  })

  it('hashes phone after E.164 normalization', async () => {
    const e164 = normalizePhoneToE164('(11) 98765-4321')
    const expectedPhoneHash = await sha256Hex(e164)

    const traits = await normalizeIdentifyTraits({
      phone: '(11) 98765-4321',
    })

    expect(traits.phone).toBe(expectedPhoneHash)
    expect(traits.phone).toBe(traits.phone_hash)
    expect(String(traits.phone)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not re-hash values that are already SHA-256 hex', async () => {
    const existing = 'a'.repeat(64)
    const traits = await normalizeIdentifyTraits({
      email: existing,
      phone: existing,
    })
    expect(traits.email).toBe(existing)
    expect(traits.phone).toBe(existing)
  })

  it('keeps the existing name hash untouched (full name, lowercase)', async () => {
    const traits = await normalizeIdentifyTraits({
      name: '  Maria Papadopoulou ',
    })
    expect(traits.name).toBe(await sha256Hex('maria papadopoulou'))
  })

  it('adds first_name_hash and last_name_hash split from name', async () => {
    const traits = await normalizeIdentifyTraits({ name: 'Maria  da Silva' })
    expect(traits.first_name_hash).toBe(await sha256Hex('maria'))
    expect(traits.last_name_hash).toBe(await sha256Hex('silva'))
    expect(traits.first_name).toBeUndefined()
    expect(traits.last_name).toBeUndefined()
  })

  it('keeps accents and Greek letters, strips punctuation', async () => {
    const traits = await normalizeIdentifyTraits({
      name: 'ΜΑΡΙΑ  Παπαδοπούλου-Κώστα.',
    })
    expect(traits.first_name_hash).toBe(await sha256Hex('μαρια'))
    expect(traits.last_name_hash).toBe(await sha256Hex('παπαδοπούλουκώστα'))

    const br = await normalizeIdentifyTraits({ name: "João D'Ávila" })
    expect(br.first_name_hash).toBe(await sha256Hex('joão'))
    expect(br.last_name_hash).toBe(await sha256Hex('dávila'))
  })

  it('sends only first_name_hash for a single word', async () => {
    const traits = await normalizeIdentifyTraits({ name: 'Maria' })
    expect(traits.first_name_hash).toBe(await sha256Hex('maria'))
    expect(traits.last_name_hash).toBeUndefined()
  })

  it('skips junk names', async () => {
    for (const name of ['x', '123', '-- .', 'J.']) {
      const traits = await normalizeIdentifyTraits({ name })
      expect(traits.first_name_hash).toBeUndefined()
      expect(traits.last_name_hash).toBeUndefined()
    }
  })

  it('ignores initials when picking first and last name', async () => {
    const traits = await normalizeIdentifyTraits({ name: 'J. Maria S.' })
    expect(traits.first_name_hash).toBe(await sha256Hex('maria'))
    expect(traits.last_name_hash).toBeUndefined()
  })

  it('cannot split a name that is already hashed', async () => {
    const existing = 'b'.repeat(64)
    const traits = await normalizeIdentifyTraits({ name: existing })
    expect(traits.name).toBe(existing)
    expect(traits.first_name_hash).toBeUndefined()
    expect(traits.last_name_hash).toBeUndefined()
  })

  it('prefers explicit first_name / last_name and hashes them in place', async () => {
    const traits = await normalizeIdentifyTraits({
      name: 'Maria Silva',
      first_name: ' Ana ',
      last_name: 'Souza',
    })
    expect(traits.first_name_hash).toBe(await sha256Hex('ana'))
    expect(traits.last_name_hash).toBe(await sha256Hex('souza'))
    expect(traits.first_name).toBe(traits.first_name_hash)
    expect(traits.last_name).toBe(traits.last_name_hash)
  })

  it('never lets an unusable explicit first_name go out in plain text', async () => {
    const traits = await normalizeIdentifyTraits({ first_name: 'J' })
    expect(traits.first_name).toBeUndefined()
    expect(traits.first_name_hash).toBeUndefined()
  })

  it('hashes client_phone and uses it as phone_hash when there is no phone', async () => {
    const expected = await sha256Hex(
      normalizePhoneToE164('+55 (11) 98765-4321')
    )
    const traits = await normalizeIdentifyTraits({
      client_phone: '+55 (11) 98765-4321',
    })
    expect(traits.client_phone).toBe(expected)
    expect(traits.phone_hash).toBe(expected)
  })

  it('keeps phone as the phone_hash source when both phone and client_phone exist', async () => {
    const traits = await normalizeIdentifyTraits({
      phone: '+5511900000001',
      client_phone: '+5511900000002',
    })
    expect(traits.phone_hash).toBe(await sha256Hex('+5511900000001'))
    expect(traits.client_phone).toBe(await sha256Hex('+5511900000002'))
  })

  it('leaves traits without name or phone exactly as before', async () => {
    const input = { email: 'a@b.com', lotame: { x: 1 }, terms_of_service: true }
    const traits = await normalizeIdentifyTraits(input)
    expect(Object.keys(traits).sort()).toEqual(
      [
        'email',
        'email_domain',
        'email_hash',
        'lotame',
        'terms_of_service',
      ].sort()
    )
  })
})
