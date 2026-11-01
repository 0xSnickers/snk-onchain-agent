import { ArrowUpRight, ScanLine, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
export function ResearchCard() {
  const { t } = useTranslation();
  return (
    <section className="research-card">
      <span className="research-emblem">
        <Sparkles size={23} />
      </span>
      <span className="eyebrow">RESEARCH WITH CONFIDENCE</span>
      <h2>{t('design.research')}</h2>
      <p className="muted">{t('design.researchBody')}</p>
      <ul>
        {[ScanLine, ShieldCheck, ArrowUpRight].map((Icon, i) => (
          <li key={i}>
            <Icon size={14} />
            {t(`design.step${i + 1}`)}
          </li>
        ))}
      </ul>
      <Link to="/activity#mint" className="research-cta">
        {t('design.monitor')}
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
