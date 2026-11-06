import { PluginType } from '@segment/analytics-core'
import { Context } from '../../../core/context'
import { Plugin } from '../../../core/plugin'
import { getCookie } from '../session-enrichment/session-manager'

/**
 * Copia o cookie `_fbp` da Meta para `context.fbp`, sem alterar o valor.
 *
 * O cookie é lido a cada evento porque quem o cria é o Pixel, que carrega depois
 * do SDK: os primeiros eventos da sessão podem sair sem o campo. Sem o cookie, o
 * evento segue sem `fbp`.
 */
export function fbpEnrichment(): Plugin {
  const enrich = (ctx: Context): Context => {
    const fbp = getCookie('_fbp')
    if (!fbp) {
      return ctx
    }
    ctx.updateEvent('context', { ...ctx.event.context, fbp })
    return ctx
  }

  return {
    name: 'fbp-enrichment',
    type: 'before' as PluginType,
    version: '0.1.0',
    isLoaded: () => true,
    load: () => Promise.resolve(),
    track: enrich,
    identify: enrich,
    page: enrich,
    screen: enrich,
    alias: enrich,
    group: enrich,
  }
}
