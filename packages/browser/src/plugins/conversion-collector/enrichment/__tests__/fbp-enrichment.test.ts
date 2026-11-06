import { Analytics } from '../../../../core/analytics'
import { Context } from '../../../../core/context'
import { contextToCollectEvent } from '../../context-to-collect-event'
import { conversionPipelinePlugins } from '../../pipeline-plugins'
import { fbpEnrichment } from '../fbp-enrichment'

const FBP = 'fb.1.1730000000000.1234567890'

function clearFbpCookie(): void {
  document.cookie = '_fbp=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

function enrich(eventContext: Record<string, unknown> = {}): Context {
  const ctx = new Context({
    type: 'track',
    event: 'CompleteRegistration',
    context: eventContext,
  })
  return fbpEnrichment().track?.(ctx) as Context
}

describe('fbpEnrichment', () => {
  afterEach(clearFbpCookie)

  it('copia o cookie _fbp para context.fbp sem alterar o valor', () => {
    document.cookie = `_fbp=${FBP}; path=/`

    expect(enrich().event.context?.fbp).toBe(FBP)
  })

  it('preserva os demais campos do context', () => {
    document.cookie = `_fbp=${FBP}; path=/`

    const enriched = enrich({ campaign: { fbclid: 'fb' } })

    expect(enriched.event.context).toMatchObject({
      campaign: { fbclid: 'fb' },
      fbp: FBP,
    })
  })

  it('não cria o campo quando o cookie não existe', () => {
    expect(enrich().event.context).not.toHaveProperty('fbp')
  })

  it('lê o cookie criado depois do primeiro evento', () => {
    expect(enrich().event.context).not.toHaveProperty('fbp')

    document.cookie = `_fbp=${FBP}; path=/`

    expect(enrich().event.context?.fbp).toBe(FBP)
  })

  it('leva context.fbp até o payload enviado ao collector', () => {
    document.cookie = `_fbp=${FBP}; path=/`

    const payload = contextToCollectEvent(enrich(), {} as Analytics)

    expect(payload?.context).toMatchObject({ fbp: FBP })
  })

  it('faz parte dos plugins do pipeline', () => {
    const names = conversionPipelinePlugins({
      endpoint: '/cp',
    } as Parameters<typeof conversionPipelinePlugins>[0]).map((p) => p.name)

    expect(names).toContain('fbp-enrichment')
  })
})
