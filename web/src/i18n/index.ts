import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLocale, getCurrentLocale } from './config';
import { delegationMessages } from './delegation';
import { resources } from './resources';
import { socialMessages } from './social';
import { marketMessages } from './market';
import { designMessages } from './design';
import { agentMessages } from './agent';
import { onchainMessages } from './onchain';
import { sniperMessages } from './sniper';
for (const locale of ['zh-CN', 'en-US'] as const)
  Object.assign(resources[locale].translation, {
    onchain: onchainMessages[locale],
    sniper: sniperMessages[locale],
    agent: agentMessages[locale],
    design: designMessages[locale],
    market: marketMessages[locale],
    social: socialMessages[locale],
    delegation: delegationMessages[locale],
  });

i18n.use(initReactI18next).init({
  resources,
  lng: getCurrentLocale(),
  fallbackLng: defaultLocale,
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
